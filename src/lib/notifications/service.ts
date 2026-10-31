/**
 * The notification service: an outbox with a dedupe key per message, a dispatcher that sends what is
 * due through a channel, and the reminder schedule. Nothing here throws into the caller: a notice
 * is a courtesy and the change it describes has already happened.
 */
import { after } from "next/server";
import type { AppointmentRecord } from "../clinic-types";
import { now } from "../clock";
import { findDoctor } from "../data";
import { formatShortDate } from "../format";
import { getOps } from "../ops";
import type { NotificationRecord, OpsStore } from "../ops/types";
import { slotStart } from "../schedule";
import { getStore } from "../store";
import { channelFor } from "./channels";
import { reminderSchedule, resolveOffsets } from "./reminders";
import { renderNotice } from "./templates";
import type { ChannelName, NoticeData, NotificationKind } from "./types";

export const REMINDER_KIND: NotificationKind = "reminder";

function whenLabel(visit: Pick<AppointmentRecord, "date" | "time">): string {
  return `${formatShortDate(visit.date)}, ${visit.time}`;
}

/** The data a template needs for a visit. */
export function noticeData(visit: AppointmentRecord, firstName: string, extra: Partial<NoticeData> = {}): NoticeData {
  return {
    firstName,
    patientName: visit.patientName,
    reference: visit.reference,
    doctorName: findDoctor(visit.doctorId)?.name ?? "your doctor",
    when: whenLabel(visit),
    token: visit.token ?? null,
    startsAt: slotStart(visit).toISOString(),
    ...extra,
  };
}

async function activeChannels(ops: OpsStore): Promise<ChannelName[]> {
  const raw = await ops.getSetting("notification_channels");
  const list = Array.isArray(raw) ? raw.filter((value): value is ChannelName => value === "email" || value === "sms" || value === "whatsapp") : [];
  return list.length > 0 ? list : ["email"];
}

interface Contact {
  firstName: string;
  email: string | null;
}

async function contactFor(visit: AppointmentRecord): Promise<Contact | null> {
  if (!visit.patientUserId) return null;
  const user = await (await getStore()).getUserById(visit.patientUserId);
  if (!user) return null;
  return { firstName: user.name.split(" ")[0] || user.name, email: user.email };
}

export interface NoticeOptions {
  /** Unique per message: queueing the same key twice sends once. */
  dedupe: string;
  scheduledFor?: Date;
  extra?: Partial<NoticeData>;
}

/** Queue a notice to the visit's patient on every active channel. Returns whether anything was queued. */
export async function queueNotice(kind: NotificationKind, visit: AppointmentRecord, options: NoticeOptions): Promise<boolean> {
  try {
    const contact = await contactFor(visit);
    if (!contact) return false;
    const ops = await getOps();
    let queued = false;
    for (const channel of await activeChannels(ops)) {
      const recipient = channel === "email" ? contact.email : visit.patientMobile;
      if (!recipient) continue;
      const result = await ops.enqueueNotification({
        dedupeKey: `${options.dedupe}:${channel}`,
        kind,
        channel,
        recipient,
        appointmentId: visit.id,
        payload: noticeData(visit, contact.firstName, options.extra) as unknown as Record<string, unknown>,
        scheduledFor: (options.scheduledFor ?? now()).toISOString(),
      });
      if (result === "queued") queued = true;
    }
    return queued;
  } catch (error) {
    console.error(`[notice] Could not queue ${kind} for ${visit.reference}: ${error instanceof Error ? error.message : "unknown error"}`);
    return false;
  }
}

/**
 * Send what is due soon after the response has gone out. Outside a request (tests, scripts) there is no
 * "after the response", so nothing is sent here: the cron sends it within five minutes, or the caller
 * runs dispatchDue itself.
 */
export function dispatchSoon(): Promise<void> {
  try {
    after(() => dispatchDue().then(() => undefined));
  } catch {
    // not in a request
  }
  return Promise.resolve();
}

export interface DispatchSummary {
  sent: number;
  skipped: number;
  failed: number;
  cancelled: number;
}

/**
 * Send every notification that is due. A reminder first re-checks the visit: it must still be booked and
 * still start when the reminder was planned for, otherwise the reminder is cancelled instead of sent.
 */
export async function dispatchDue(limit = 25): Promise<DispatchSummary> {
  const summary: DispatchSummary = { sent: 0, skipped: 0, failed: 0, cancelled: 0 };
  const ops = await getOps();
  const store = await getStore();
  const rows = await ops.claimDueNotifications(limit, now());
  for (const row of rows) {
    try {
      const outcome = await deliver(row, ops, store);
      summary[outcome] += 1;
    } catch (error) {
      summary.failed += 1;
      await ops.finishNotification(row.id, "failed", error instanceof Error ? error.message : "unknown error").catch(() => undefined);
    }
  }
  return summary;
}

async function deliver(row: NotificationRecord, ops: OpsStore, store: Awaited<ReturnType<typeof getStore>>): Promise<keyof DispatchSummary> {
  const data = row.payload as unknown as NoticeData;
  if (row.kind === REMINDER_KIND) {
    const visit = row.appointmentId ? await store.getAppointment(row.appointmentId) : null;
    const stillValid = visit && visit.status === "booked" && slotStart(visit).getTime() > now().getTime() && slotStart(visit).toISOString() === data.startsAt;
    if (!stillValid) {
      await ops.finishNotification(row.id, "cancelled", "The visit is no longer booked at this time.");
      return "cancelled";
    }
  }
  const channel = channelFor(row.channel);
  if (!channel) {
    await ops.finishNotification(row.id, "skipped", `Unknown channel ${row.channel}`);
    return "skipped";
  }
  const result = await channel.send(row.recipient, renderNotice(row.kind as NotificationKind, data));
  if (result === "sent") {
    await ops.finishNotification(row.id, "sent");
    return "sent";
  }
  if (result === "skipped") {
    await ops.finishNotification(row.id, "skipped", "Not deliverable or not connected.");
    return "skipped";
  }
  await ops.finishNotification(row.id, "failed", "The channel could not send it.");
  return "failed";
}

// --- Reminders -------------------------------------------------------------------------------

export async function reminderOffsets(): Promise<number[]> {
  return resolveOffsets(await (await getOps()).getSetting("reminder_offsets_minutes"));
}

/** Stop the visit's reminders that have not been sent yet. */
export async function cancelReminders(appointmentId: string): Promise<number> {
  try {
    return await (await getOps()).cancelNotifications(appointmentId, REMINDER_KIND);
  } catch (error) {
    console.error(`[notice] Could not cancel reminders: ${error instanceof Error ? error.message : "unknown error"}`);
    return 0;
  }
}

/** Schedule the reminders for a booked visit. Safe to call twice: the dedupe key includes the start time. */
export async function scheduleReminders(visit: AppointmentRecord): Promise<number> {
  if (visit.status !== "booked") return 0;
  const startsAt = slotStart(visit);
  const plan = reminderSchedule(startsAt, await reminderOffsets(), now());
  let queued = 0;
  for (const reminder of plan) {
    const ok = await queueNotice(REMINDER_KIND, visit, {
      dedupe: `reminder:${visit.id}:${startsAt.toISOString()}:${reminder.offsetMinutes}`,
      scheduledFor: reminder.at,
      extra: { offsetMinutes: reminder.offsetMinutes },
    });
    if (ok) queued += 1;
  }
  return queued;
}

/** A visit moved: drop the old reminders and plan new ones from the new start. */
export async function rescheduleReminders(visit: AppointmentRecord): Promise<number> {
  await cancelReminders(visit.id);
  return scheduleReminders(visit);
}

/** What happens once a visit is confirmed (booked online and paid, or booked for payment at the desk). */
export async function onBookingConfirmed(visit: AppointmentRecord, extra: Partial<NoticeData> = {}): Promise<void> {
  await queueNotice("booking_confirmed", visit, { dedupe: `booking_confirmed:${visit.id}`, extra });
  await scheduleReminders(visit);
}

/** Confirm a booking for payment at the desk: the same follow-ups, sent after the response. */
export async function onBookingConfirmedSoon(visit: AppointmentRecord, extra: Partial<NoticeData> = {}): Promise<void> {
  await onBookingConfirmed(visit, extra);
  await dispatchSoon();
}
