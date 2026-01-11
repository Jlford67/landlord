"use client";

import { useMemo, useState, useTransition } from "react";
import SafeInput from "@/components/ui/SafeInput";
import SafeSelect from "@/components/ui/SafeSelect";
import HydrationSafeButton from "@/components/ui/HydrationSafeButton";
import {
  acknowledgeNotification,
  saveSettings,
  sendTestEmail,
  type NotificationSettingsInput,
} from "./actions";

const FREQUENCY_OPTIONS = [60, 30, 14, 7, 1];
const START_DAY_OPTIONS = [90, 60, 45, 30, 14];
const SEND_TIME_OPTIONS = [
  { value: "06:00", label: "6:00 AM" },
  { value: "07:00", label: "7:00 AM" },
  { value: "08:00", label: "8:00 AM" },
  { value: "09:00", label: "9:00 AM" },
  { value: "10:00", label: "10:00 AM" },
];

type InboxRow = {
  id: string;
  message: string;
  channel: string;
  status: string;
  createdAtLabel: string;
  acknowledged: boolean;
};

type SettingsClientProps = {
  settings: {
    enabled: boolean;
    inAppEnabled: boolean;
    emailEnabled: boolean;
    emailAddress: string | null;
    emailSendTimeLocal: string;
    insuranceEnabled: boolean;
    insuranceStartDays: number;
    insuranceOffsets: number[];
    insuranceOverdueDaily: boolean;
    propertyTaxEnabled: boolean;
    propertyTaxStartDays: number;
    propertyTaxOffsets: number[];
    propertyTaxOverdueDaily: boolean;
  };
  inbox: InboxRow[];
};

function ToggleSwitch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <label className={`flex items-center justify-between gap-4 ${disabled ? "opacity-60" : ""}`}>
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <span className="relative inline-flex h-6 w-11 items-center">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          disabled={disabled}
        />
        <span className="h-5 w-10 rounded-full bg-slate-200 transition peer-checked:bg-emerald-500" />
        <span className="absolute left-0.5 h-4 w-4 rounded-full bg-white transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

function FrequencyPicker({
  selected,
  disabled,
  onChange,
}: {
  selected: number[];
  disabled?: boolean;
  onChange: (next: number[]) => void;
}) {
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  return (
    <div className={`flex flex-wrap gap-3 ${disabled ? "opacity-60" : ""}`}>
      {FREQUENCY_OPTIONS.map((value) => {
        const isChecked = selectedSet.has(value);
        return (
          <label key={value} className="flex items-center gap-2 text-sm text-slate-700">
            <SafeInput
              type="checkbox"
              checked={isChecked}
              onChange={(event) => {
                const next = new Set(selected);
                if (event.target.checked) next.add(value);
                else next.delete(value);
                onChange(Array.from(next).sort((a, b) => b - a));
              }}
              disabled={disabled}
            />
            {value} days before due
          </label>
        );
      })}
    </div>
  );
}

export default function NotificationsSettingsClient({ settings, inbox }: SettingsClientProps) {
  const [formState, setFormState] = useState(settings);
  const [inboxRows, setInboxRows] = useState(inbox);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const controlsDisabled = !formState.enabled;

  const savePayload = (): NotificationSettingsInput => ({
    enabled: formState.enabled,
    inAppEnabled: formState.inAppEnabled,
    emailEnabled: formState.emailEnabled,
    emailAddress: formState.emailAddress,
    emailSendTimeLocal: formState.emailSendTimeLocal,
    insuranceEnabled: formState.insuranceEnabled,
    insuranceStartDays: formState.insuranceStartDays,
    insuranceOffsets: formState.insuranceOffsets,
    insuranceOverdueDaily: formState.insuranceOverdueDaily,
    propertyTaxEnabled: formState.propertyTaxEnabled,
    propertyTaxStartDays: formState.propertyTaxStartDays,
    propertyTaxOffsets: formState.propertyTaxOffsets,
    propertyTaxOverdueDaily: formState.propertyTaxOverdueDaily,
  });

  const handleSave = () => {
    setStatusMessage(null);
    startTransition(async () => {
      const updated = await saveSettings(savePayload());
      setFormState((prev) => ({
        ...prev,
        enabled: updated.enabled,
        inAppEnabled: updated.inAppEnabled,
        emailEnabled: updated.emailEnabled,
        emailAddress: updated.emailAddress,
        emailSendTimeLocal: updated.emailSendTimeLocal,
        insuranceEnabled: updated.insuranceEnabled,
        insuranceStartDays: updated.insuranceStartDays,
        insuranceOffsets: updated.insuranceOffsetsCsv
          .split(",")
          .map((value) => Number.parseInt(value.trim(), 10))
          .filter((value) => Number.isFinite(value)),
        insuranceOverdueDaily: updated.insuranceOverdueDaily,
        propertyTaxEnabled: updated.propertyTaxEnabled,
        propertyTaxStartDays: updated.propertyTaxStartDays,
        propertyTaxOffsets: updated.propertyTaxOffsetsCsv
          .split(",")
          .map((value) => Number.parseInt(value.trim(), 10))
          .filter((value) => Number.isFinite(value)),
        propertyTaxOverdueDaily: updated.propertyTaxOverdueDaily,
      }));
      setStatusMessage("Settings saved.");
    });
  };

  const handleTestEmail = () => {
    setTestMessage(null);
    startTransition(async () => {
      const result = await sendTestEmail(formState.emailAddress);
      setTestMessage(result.message);
    });
  };

  const acknowledgeRow = (id: string) => {
    startTransition(async () => {
      await acknowledgeNotification(id);
      setInboxRows((prev) =>
        prev.map((row) => (row.id === id ? { ...row, acknowledged: true } : row))
      );
    });
  };

  return (
    <div className="space-y-6">
      <section className="ll_card">
        <div className="ll_card_title">Notifications Preferences</div>
        <div className="mt-4 space-y-4">
          <ToggleSwitch
            label="Enable Notifications"
            checked={formState.enabled}
            onChange={(value) => setFormState((prev) => ({ ...prev, enabled: value }))}
          />
          <ToggleSwitch
            label="In-App Alerts"
            checked={formState.inAppEnabled}
            onChange={(value) => setFormState((prev) => ({ ...prev, inAppEnabled: value }))}
            disabled={controlsDisabled}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ToggleSwitch
              label="Email Alerts"
              checked={formState.emailEnabled}
              onChange={(value) => setFormState((prev) => ({ ...prev, emailEnabled: value }))}
              disabled={controlsDisabled}
            />
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <SafeInput
                className="ll_input min-w-[220px] flex-1"
                type="email"
                placeholder="user@example.com"
                value={formState.emailAddress ?? ""}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, emailAddress: event.target.value }))
                }
                suppressHydrationWarning
                disabled={controlsDisabled || !formState.emailEnabled}
              />
              <HydrationSafeButton
                type="button"
                className="ll_btn ll_btnSecondary"
                onClick={handleTestEmail}
                disabled={controlsDisabled || !formState.emailEnabled}
              >
                Test Email
              </HydrationSafeButton>
            </div>
          </div>
          {testMessage ? <div className="text-xs text-slate-500">{testMessage}</div> : null}
          <label className="flex items-center justify-between gap-4 text-sm text-slate-500">
            <span>SMS Alerts (Coming Soon)</span>
            <SafeInput type="checkbox" disabled checked={false} />
          </label>
        </div>
      </section>

      <section className="ll_card">
        <div className="ll_card_title">Insurance Reminders</div>
        <div className="mt-4 space-y-4 text-sm text-slate-700">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-medium">Start Reminders:</span>
            <SafeSelect
              className="ll_input"
              value={String(formState.insuranceStartDays)}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  insuranceStartDays: Number.parseInt(event.target.value, 10),
                }))
              }
              disabled={controlsDisabled}
            >
              {START_DAY_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </SafeSelect>
            <span className="text-slate-500">days before due date</span>
          </div>
          <div>
            <div className="font-medium">Reminder Frequency:</div>
            <div className="mt-2">
              <FrequencyPicker
                selected={formState.insuranceOffsets}
                onChange={(next) => setFormState((prev) => ({ ...prev, insuranceOffsets: next }))}
                disabled={controlsDisabled}
              />
            </div>
          </div>
          <label className="flex items-center gap-2">
            <SafeInput
              type="checkbox"
              checked={formState.insuranceOverdueDaily}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, insuranceOverdueDaily: event.target.checked }))
              }
              disabled={controlsDisabled}
            />
            Daily until marked paid
          </label>
        </div>
      </section>

      <section className="ll_card">
        <div className="ll_card_title">Property Tax Reminders</div>
        <div className="mt-4 space-y-4 text-sm text-slate-700">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-medium">Start Reminders:</span>
            <SafeSelect
              className="ll_input"
              value={String(formState.propertyTaxStartDays)}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  propertyTaxStartDays: Number.parseInt(event.target.value, 10),
                }))
              }
              disabled={controlsDisabled}
            >
              {START_DAY_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </SafeSelect>
            <span className="text-slate-500">days before due date</span>
          </div>
          <div>
            <div className="font-medium">Reminder Frequency:</div>
            <div className="mt-2">
              <FrequencyPicker
                selected={formState.propertyTaxOffsets}
                onChange={(next) => setFormState((prev) => ({ ...prev, propertyTaxOffsets: next }))}
                disabled={controlsDisabled}
              />
            </div>
          </div>
          <label className="flex items-center gap-2">
            <SafeInput
              type="checkbox"
              checked={formState.propertyTaxOverdueDaily}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, propertyTaxOverdueDaily: event.target.checked }))
              }
              disabled={controlsDisabled}
            />
            Daily until marked paid
          </label>
        </div>
      </section>

      <section className="ll_card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-sm font-medium text-slate-700">
            <span>Email Settings:</span>
            <SafeSelect
              className="ll_input"
              value={formState.emailSendTimeLocal}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, emailSendTimeLocal: event.target.value }))
              }
              disabled={controlsDisabled}
            >
              {SEND_TIME_OPTIONS.map((time) => (
                <option key={time.value} value={time.value}>
                  {time.label}
                </option>
              ))}
            </SafeSelect>
          </div>
          <HydrationSafeButton
            type="button"
            className="ll_btn ll_btnPrimary"
            onClick={handleSave}
            disabled={isPending}
          >
            {isPending ? "Saving..." : "Save Changes"}
          </HydrationSafeButton>
        </div>
        {statusMessage ? <div className="mt-3 text-xs text-emerald-600">{statusMessage}</div> : null}
      </section>

      <section className="ll_card" id="notifications-inbox">
        <div className="flex items-center justify-between">
          <div className="ll_card_title">Notifications Inbox</div>
          <span className="text-xs text-slate-500">Recent notification events</span>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="ll_table ll_table_zebra">
            <thead>
              <tr>
                <th>Message</th>
                <th>Channel</th>
                <th>Status</th>
                <th>Created</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {inboxRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-slate-500">
                    No notifications yet.
                  </td>
                </tr>
              ) : (
                inboxRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.message}</td>
                    <td className="capitalize">{row.channel}</td>
                    <td className="capitalize">{row.status}</td>
                    <td>{row.createdAtLabel}</td>
                    <td className="text-right">
                      {row.acknowledged ? (
                        <span className="text-xs text-slate-500">Acknowledged</span>
                      ) : (
                        <HydrationSafeButton
                          type="button"
                          className="ll_btn ll_btnSecondary"
                          onClick={() => acknowledgeRow(row.id)}
                          disabled={isPending}
                        >
                          Acknowledge
                        </HydrationSafeButton>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
