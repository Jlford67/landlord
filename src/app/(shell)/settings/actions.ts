"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationEventType,
  NotificationSettings,
} from "@prisma/client";

const DEFAULT_OFFSETS = "60,30,14,7,1";

const DEFAULT_SETTINGS: Omit<NotificationSettings, "id" | "updatedAt"> = {
  enabled: true,
  inAppEnabled: true,
  emailEnabled: true,
  emailAddress: null,
  emailSendTimeLocal: "08:00",
  insuranceEnabled: true,
  insuranceStartDays: 60,
  insuranceOffsetsCsv: DEFAULT_OFFSETS,
  insuranceOverdueDaily: true,
  propertyTaxEnabled: true,
  propertyTaxStartDays: 60,
  propertyTaxOffsetsCsv: DEFAULT_OFFSETS,
  propertyTaxOverdueDaily: true,
  lastGeneratedAt: null,
};

export type NotificationSettingsInput = {
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

type NotificationSeed = {
  type: NotificationEventType;
  channel: NotificationChannel;
  propertyId: string | null;
  relatedEntityId: string | null;
  dueDate: Date;
  message: string;
  dedupeKey: string;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatMonthDayUTC(d: Date) {
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

function dateKeyUTC(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfDayUTC(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function parseOffsets(csv: string) {
  return csv
    .split(",")
    .map((v) => Number.parseInt(v.trim(), 10))
    .filter((v) => Number.isFinite(v))
    .sort((a, b) => b - a);
}

function formatOffsetsCsv(offsets: number[]) {
  return offsets
    .map((v) => Number.parseInt(String(v), 10))
    .filter((v) => Number.isFinite(v))
    .sort((a, b) => b - a)
    .join(",");
}

function dayDiffUTC(a: Date, b: Date) {
  const msDay = 24 * 60 * 60 * 1000;
  return Math.round((startOfDayUTC(a).getTime() - startOfDayUTC(b).getTime()) / msDay);
}

function propertyLabel(property: { nickname: string | null; street: string }) {
  return property.nickname?.trim() || property.street;
}

async function getOrCreateSettings() {
  const existing = await prisma.notificationSettings.findFirst();
  if (existing) return existing;

  return prisma.notificationSettings.create({ data: DEFAULT_SETTINGS });
}

async function sendNotificationEmail(to: string, subject: string, html: string) {
  console.log("Sending notification email", { to, subject, html });
  return { ok: true };
}

async function createNotificationEvent(seed: NotificationSeed) {
  const existing = await prisma.notificationEvent.findUnique({ where: { dedupeKey: seed.dedupeKey } });
  if (existing) return null;

  return prisma.notificationEvent.create({
    data: {
      channel: seed.channel,
      type: seed.type,
      propertyId: seed.propertyId,
      relatedEntityId: seed.relatedEntityId,
      dueDate: seed.dueDate,
      message: seed.message,
      dedupeKey: seed.dedupeKey,
      status: seed.channel === "inapp" ? NotificationDeliveryStatus.sent : NotificationDeliveryStatus.queued,
      sentAt: seed.channel === "inapp" ? new Date() : null,
    },
  });
}

function buildMessage(
  type: NotificationEventType,
  propertyName: string,
  dueDate: Date,
  daysUntilDue: number
) {
  const dueLabel = formatMonthDayUTC(dueDate);
  const subject = type === "insurance_due" ? "Insurance" : "Property tax";

  if (daysUntilDue < 0) {
    return `${subject} payment overdue for ${propertyName} (was due ${dueLabel}).`;
  }

  if (daysUntilDue === 0) {
    return `${subject} payment due today for ${propertyName}.`;
  }

  return `${subject} payment due ${dueLabel} for ${propertyName}.`;
}

export async function getSettings() {
  await requireUser();
  return getOrCreateSettings();
}

export async function saveSettings(input: NotificationSettingsInput) {
  await requireUser();
  const settings = await getOrCreateSettings();

  const updated = await prisma.notificationSettings.update({
    where: { id: settings.id },
    data: {
      enabled: input.enabled,
      inAppEnabled: input.inAppEnabled,
      emailEnabled: input.emailEnabled,
      emailAddress: input.emailAddress?.trim() || null,
      emailSendTimeLocal: input.emailSendTimeLocal,
      insuranceEnabled: input.insuranceEnabled,
      insuranceStartDays: input.insuranceStartDays,
      insuranceOffsetsCsv: formatOffsetsCsv(input.insuranceOffsets),
      insuranceOverdueDaily: input.insuranceOverdueDaily,
      propertyTaxEnabled: input.propertyTaxEnabled,
      propertyTaxStartDays: input.propertyTaxStartDays,
      propertyTaxOffsetsCsv: formatOffsetsCsv(input.propertyTaxOffsets),
      propertyTaxOverdueDaily: input.propertyTaxOverdueDaily,
    },
  });

  revalidatePath("/settings");
  return updated;
}

export async function sendTestEmail(emailAddress: string | null) {
  await requireUser();
  const to = emailAddress?.trim();
  if (!to) {
    return { ok: false, message: "Add an email address to send a test." };
  }

  const result = await sendNotificationEmail(to, "Test notification", "<p>This is a test reminder email.</p>");
  return result.ok
    ? { ok: true, message: "Test email sent." }
    : { ok: false, message: "Test email failed to send." };
}

export async function acknowledgeNotification(id: string) {
  await requireUser();
  await prisma.notificationEvent.update({
    where: { id },
    data: { acknowledgedAt: new Date() },
  });

  revalidatePath("/settings");
  return { ok: true };
}

export async function getTodayInAppNotifications() {
  await requireUser();
  const now = new Date();
  const start = startOfDayUTC(now);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  return prisma.notificationEvent.findMany({
    where: {
      channel: NotificationChannel.inapp,
      acknowledgedAt: null,
      createdAt: { gte: start, lt: end },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function generateNotificationsIfNeeded() {
  await requireUser();

  const settings = await getOrCreateSettings();
  const now = new Date();
  const todayKey = dateKeyUTC(now);
  const lastGeneratedKey = settings.lastGeneratedAt ? dateKeyUTC(settings.lastGeneratedAt) : null;

  if (lastGeneratedKey === todayKey) return;

  if (!settings.enabled) {
    await prisma.notificationSettings.update({
      where: { id: settings.id },
      data: { lastGeneratedAt: now },
    });
    return;
  }

  const insuranceOffsets = parseOffsets(settings.insuranceOffsetsCsv);
  const propertyTaxOffsets = parseOffsets(settings.propertyTaxOffsetsCsv);

  const [insurancePolicies, taxAccounts] = await Promise.all([
    settings.insuranceEnabled
      ? prisma.insurancePolicy.findMany({
          where: { dueDate: { not: null }, paidDate: null },
          include: { property: { select: { nickname: true, street: true } } },
        })
      : Promise.resolve([]),
    settings.propertyTaxEnabled
      ? prisma.propertyTaxAccount.findMany({
          where: { dueDate: { not: null }, lastPaid: null },
          include: { property: { select: { nickname: true, street: true } } },
        })
      : Promise.resolve([]),
  ]);

  const channels: NotificationChannel[] = [];
  if (settings.inAppEnabled) channels.push(NotificationChannel.inapp);
  if (settings.emailEnabled && settings.emailAddress?.trim()) channels.push(NotificationChannel.email);

  for (const policy of insurancePolicies) {
    if (!policy.dueDate) continue;
    const daysUntilDue = dayDiffUTC(policy.dueDate, now);
    const isOffsetDay = insuranceOffsets.includes(daysUntilDue);
    const isWithinWindow = daysUntilDue >= 0 && daysUntilDue <= settings.insuranceStartDays && isOffsetDay;
    const isOverdue = daysUntilDue <= 0 && settings.insuranceOverdueDaily;

    if (!isWithinWindow && !isOverdue) continue;

    const propertyName = propertyLabel(policy.property);
    const message = buildMessage(NotificationEventType.insurance_due, propertyName, policy.dueDate, daysUntilDue);

    for (const channel of channels) {
      const dedupeKey = `insurance_due:${channel}:${policy.id}:${todayKey}`;
      const event = await createNotificationEvent({
        type: NotificationEventType.insurance_due,
        channel,
        propertyId: policy.propertyId,
        relatedEntityId: policy.id,
        dueDate: policy.dueDate,
        message,
        dedupeKey,
      });

      if (channel === NotificationChannel.email && event) {
        const result = await sendNotificationEmail(
          settings.emailAddress?.trim() || "",
          `Insurance due for ${propertyName}`,
          `<p>${message}</p>`
        );

        await prisma.notificationEvent.update({
          where: { id: event.id },
          data: {
            status: result.ok ? NotificationDeliveryStatus.sent : NotificationDeliveryStatus.failed,
            sentAt: result.ok ? new Date() : null,
          },
        });
      }
    }
  }

  for (const account of taxAccounts) {
    if (!account.dueDate) continue;
    const daysUntilDue = dayDiffUTC(account.dueDate, now);
    const isOffsetDay = propertyTaxOffsets.includes(daysUntilDue);
    const isWithinWindow = daysUntilDue >= 0 && daysUntilDue <= settings.propertyTaxStartDays && isOffsetDay;
    const isOverdue = daysUntilDue <= 0 && settings.propertyTaxOverdueDaily;

    if (!isWithinWindow && !isOverdue) continue;

    const propertyName = propertyLabel(account.property);
    const message = buildMessage(NotificationEventType.property_tax_due, propertyName, account.dueDate, daysUntilDue);

    for (const channel of channels) {
      const dedupeKey = `property_tax_due:${channel}:${account.id}:${todayKey}`;
      const event = await createNotificationEvent({
        type: NotificationEventType.property_tax_due,
        channel,
        propertyId: account.propertyId,
        relatedEntityId: account.id,
        dueDate: account.dueDate,
        message,
        dedupeKey,
      });

      if (channel === NotificationChannel.email && event) {
        const result = await sendNotificationEmail(
          settings.emailAddress?.trim() || "",
          `Property tax due for ${propertyName}`,
          `<p>${message}</p>`
        );

        await prisma.notificationEvent.update({
          where: { id: event.id },
          data: {
            status: result.ok ? NotificationDeliveryStatus.sent : NotificationDeliveryStatus.failed,
            sentAt: result.ok ? new Date() : null,
          },
        });
      }
    }
  }

  await prisma.notificationSettings.update({
    where: { id: settings.id },
    data: { lastGeneratedAt: now },
  });
}
