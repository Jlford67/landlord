"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { acknowledgeNotification } from "@/app/(shell)/settings/actions";
import HydrationSafeButton from "@/components/ui/HydrationSafeButton";

export type ToastNotification = {
  id: string;
  message: string;
};

export default function NotificationsToastClient({
  events,
  inboxHref,
}: {
  events: ToastNotification[];
  inboxHref: string;
}) {
  const [open, setOpen] = useState(events.length > 0);
  const [isPending, startTransition] = useTransition();

  if (!open || events.length === 0) return null;

  const handleAcknowledgeAll = () => {
    startTransition(async () => {
      await Promise.all(events.map((event) => acknowledgeNotification(event.id)));
      setOpen(false);
    });
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[320px] rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-900">New notifications</div>
        <HydrationSafeButton
          type="button"
          className="text-xs text-slate-500"
          onClick={() => setOpen(false)}
        >
          Dismiss
        </HydrationSafeButton>
      </div>
      <ul className="mt-3 space-y-2 text-sm text-slate-600">
        {events.slice(0, 3).map((event) => (
          <li key={event.id} className="rounded-lg bg-slate-50 px-3 py-2">
            {event.message}
          </li>
        ))}
      </ul>
      <div className="mt-4 flex items-center justify-end gap-2">
        <Link className="ll_btn ll_btnSecondary" href={inboxHref}>
          View inbox
        </Link>
        <HydrationSafeButton
          type="button"
          className="ll_btn ll_btnPrimary"
          onClick={handleAcknowledgeAll}
          disabled={isPending}
        >
          {isPending ? "Saving..." : "Acknowledge"}
        </HydrationSafeButton>
      </div>
    </div>
  );
}
