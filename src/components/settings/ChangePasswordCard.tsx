"use client";

import { useEffect, useState, useTransition } from "react";
import Button from "@/components/ui/Button";
import SafeInput from "@/components/ui/SafeInput";
import { changePassword } from "@/app/(shell)/settings/actions";

type MessageState = { tone: "success" | "error"; text: string };

export default function ChangePasswordCard() {
  const [mounted, setMounted] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<MessageState | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <section className="ll_card" aria-hidden="true">
        <div className="ll_card_title">Change Password</div>
        <div className="mt-4 space-y-3">
          <div className="h-4 w-40 rounded bg-gray-100" />
          <div className="h-11 w-full rounded-lg bg-gray-100" />
          <div className="h-4 w-32 rounded bg-gray-100" />
          <div className="h-11 w-full rounded-lg bg-gray-100" />
          <div className="h-4 w-44 rounded bg-gray-100" />
          <div className="h-11 w-full rounded-lg bg-gray-100" />
          <div className="h-11 w-40 rounded-lg bg-gray-100" />
        </div>
      </section>
    );
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);

    startTransition(async () => {
      const result = await changePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });

      setMessage({ tone: result.ok ? "success" : "error", text: result.message });

      if (result.ok) {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    });
  };

  const messageClass =
    message?.tone === "success" ? "text-emerald-600" : message?.tone === "error" ? "text-rose-600" : "";

  return (
    <section className="ll_card">
      <div className="ll_card_title">Change Password</div>
      <p className="mt-2 text-sm text-slate-500">
        Update your password to keep your account secure.
      </p>

      <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
        <label className="ll_label" htmlFor="current-password">
          Current password
        </label>
        <SafeInput
          id="current-password"
          name="current-password"
          type="password"
          autoComplete="current-password"
          className="ll_input"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          required
        />

        <label className="ll_label" htmlFor="new-password">
          New password
        </label>
        <SafeInput
          id="new-password"
          name="new-password"
          type="password"
          autoComplete="new-password"
          className="ll_input"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          minLength={12}
          required
        />

        <label className="ll_label" htmlFor="confirm-password">
          Confirm new password
        </label>
        <SafeInput
          id="confirm-password"
          name="confirm-password"
          type="password"
          autoComplete="new-password"
          className="ll_input"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          minLength={12}
          required
        />

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="warning" size="md" disabled={isPending} mountGate>
            {isPending ? "Updating..." : "Update password"}
          </Button>
          <span className="text-xs text-slate-500">Minimum 12 characters.</span>
        </div>
      </form>

      {message ? (
        <div className={`mt-3 text-sm ${messageClass}`} role="status">
          {message.text}
        </div>
      ) : null}
    </section>
  );
}
