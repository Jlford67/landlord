export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import NotificationsSettingsClient from "./NotificationsSettingsClient";
import NotificationsToastClient from "@/components/notifications/NotificationsToastClient";
import { generateNotificationsIfNeeded, getSettings, getTodayInAppNotifications } from "./actions";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatMonthDayUTC(d: Date) {
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

function startOfDayUTC(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function dayDiffUTC(a: Date, b: Date) {
  const msDay = 24 * 60 * 60 * 1000;
  return Math.round((startOfDayUTC(a).getTime() - startOfDayUTC(b).getTime()) / msDay);
}

function parseOffsets(csv: string) {
  return csv
    .split(",")
    .map((v) => Number.parseInt(v.trim(), 10))
    .filter((v) => Number.isFinite(v))
    .sort((a, b) => b - a);
}

function propertyLabel(property: { nickname: string | null; street: string }) {
  return property.nickname?.trim() || property.street;
}

type UpcomingItem = {
  id: string;
  propertyName: string;
  typeLabel: string;
  dueLabel: string;
  firstReminderIn: number;
};

export default async function SettingsPage() {
  await requireUser();
  await generateNotificationsIfNeeded();

  const settings = await getSettings();
  const now = new Date();

  const [insurancePolicies, taxAccounts, recentEvents, inboxEvents, todayInApp] = await Promise.all([
    prisma.insurancePolicy.findMany({
      where: { dueDate: { not: null }, paidDate: null },
      include: { property: { select: { nickname: true, street: true } } },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
    prisma.propertyTaxAccount.findMany({
      where: { dueDate: { not: null }, lastPaid: null },
      include: { property: { select: { nickname: true, street: true } } },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
    prisma.notificationEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.notificationEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    getTodayInAppNotifications(),
  ]);

  const upcoming: UpcomingItem[] = [];

  for (const policy of insurancePolicies) {
    if (!policy.dueDate) continue;
    const daysUntilDue = dayDiffUTC(policy.dueDate, now);
    upcoming.push({
      id: policy.id,
      propertyName: propertyLabel(policy.property),
      typeLabel: "Insurance Due",
      dueLabel: formatMonthDayUTC(policy.dueDate),
      firstReminderIn: Math.max(0, daysUntilDue - settings.insuranceStartDays),
    });
  }

  for (const account of taxAccounts) {
    if (!account.dueDate) continue;
    const daysUntilDue = dayDiffUTC(account.dueDate, now);
    upcoming.push({
      id: account.id,
      propertyName: propertyLabel(account.property),
      typeLabel: "Property Tax Due",
      dueLabel: formatMonthDayUTC(account.dueDate),
      firstReminderIn: Math.max(0, daysUntilDue - settings.propertyTaxStartDays),
    });
  }

  const upcomingSorted = upcoming.sort((a, b) => a.firstReminderIn - b.firstReminderIn).slice(0, 5);

  const settingsProps = {
    enabled: settings.enabled,
    inAppEnabled: settings.inAppEnabled,
    emailEnabled: settings.emailEnabled,
    emailAddress: settings.emailAddress,
    emailSendTimeLocal: settings.emailSendTimeLocal,
    insuranceEnabled: settings.insuranceEnabled,
    insuranceStartDays: settings.insuranceStartDays,
    insuranceOffsets: parseOffsets(settings.insuranceOffsetsCsv),
    insuranceOverdueDaily: settings.insuranceOverdueDaily,
    propertyTaxEnabled: settings.propertyTaxEnabled,
    propertyTaxStartDays: settings.propertyTaxStartDays,
    propertyTaxOffsets: parseOffsets(settings.propertyTaxOffsetsCsv),
    propertyTaxOverdueDaily: settings.propertyTaxOverdueDaily,
  };

  const inboxRows = inboxEvents.map((event) => ({
    id: event.id,
    message: event.message,
    channel: event.channel,
    status: event.status,
    createdAtLabel: formatMonthDayUTC(event.createdAt),
    acknowledged: Boolean(event.acknowledgedAt),
  }));

  const recentRows = recentEvents.map((event) => ({
    id: event.id,
    dateLabel: formatMonthDayUTC(event.createdAt),
    message: event.message,
    channelLabel: event.channel === "email" ? "Email" : "In-App",
  }));

  const toastEvents = todayInApp.map((event) => ({ id: event.id, message: event.message }));

  return (
    <div className="ll_page">
      <NotificationsToastClient events={toastEvents} inboxHref="/settings#notifications-inbox" />
      <div className="mb-6">
        <div className="text-sm text-slate-500">Settings</div>
        <h1 className="text-2xl font-semibold text-slate-900">Notifications Settings</h1>
        <p className="mt-2 text-sm text-slate-500">
          Manage reminders for upcoming insurance and property tax dues.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <NotificationsSettingsClient settings={settingsProps} inbox={inboxRows} />

        <aside className="space-y-6">
          <section className="ll_card">
            <div className="ll_card_title">Upcoming Reminders</div>
            <div className="mt-4 space-y-4">
              {upcomingSorted.length === 0 ? (
                <div className="text-sm text-slate-500">No upcoming reminders yet.</div>
              ) : (
                upcomingSorted.map((item) => (
                  <div key={item.id} className="border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
                    <div className="text-sm font-semibold text-slate-900">{item.propertyName}</div>
                    <div className="text-sm text-slate-600">
                      {item.typeLabel} {item.dueLabel}
                    </div>
                    <div className="text-xs text-slate-500">
                      First reminder in {item.firstReminderIn} days
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="ll_card">
            <div className="flex items-center justify-between">
              <div className="ll_card_title">Recent Notifications</div>
              <Link className="text-sm text-blue-600" href="/settings#notifications-inbox">
                View All
              </Link>
            </div>
            <div className="mt-4 space-y-3 text-sm">
              {recentRows.length === 0 ? (
                <div className="text-sm text-slate-500">No notifications yet.</div>
              ) : (
                recentRows.map((row) => (
                  <div key={row.id} className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2">
                    <div>
                      <div className="text-xs text-slate-400">{row.dateLabel}</div>
                      <div className="text-sm text-slate-700">{row.message}</div>
                    </div>
                    <div className="text-xs text-slate-500">Sent: {row.channelLabel}</div>
                  </div>
                ))
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
