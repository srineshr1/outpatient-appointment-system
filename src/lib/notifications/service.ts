/**
 * The notification service: an outbox with a dedupe key per message, a dispatcher that sends what is
 * due through a channel, and the reminder schedule. Nothing here throws into the caller: a notice
 * is a courtesy and the change it describes has already happened.
 */
import { after } from "next/server";
import type { AppointmentRecord } from "../clinic-types";
import { practiceWallClock, now } from "../clock";
import { findDoctor, reasons } from "../data";
import { formatShortDate } from "../format";
import { salutation } from "../names";
import { getOps } from "../ops";
import type { NotificationRecord, OpsStore } from "../ops/types";
import { slotStart } from "../schedule";
import { rebookLinks } from "../rebook-links";
import { getStore } from "../store";
import { channelFor } from "./channels";
import { getDoctorPrefs, prefForKind } from "./doctor-prefs";
import { reminderSchedule, resolveOffsets } from "./reminders";
import { SMS_KINDS, indianMobile, renderSms, smsMode } from "./sms";
import { renderNotice, siteUrl } from "./templates";
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
  const active: ChannelName[] = list.length > 0 ? list : ["email"];
  // Text messages follow SMS_MODE (mock by default, so nothing is spent) unless switched off.
  if (smsMode() !== "off" && !active.includes("sms")) active.push("sms");
  return smsMode() === "off" ? active.filter((name) => name !== "sms") : active;
}

interface Contact {
  firstName: string;
  email: string | null;
  mobile: string | null;
}

async function contactFor(visit: AppointmentRecord): Promise<Contact | null> {
  if (!visit.patientUserId) return null;
  const user = await (await getStore()).getUserById(visit.patientUserId);
  if (!user) return null;
  return { firstName: salutation(user.name), email: user.email, mobile: user.mobile || null };
}

// --- In-app inbox ----------------------------------------------------------------------------

/** What lands in the bell, and the words for it. Only visit changes for now. */
function inboxText(kind: NotificationKind, visit: AppointmentRecord, extra: Partial<NoticeData> = {}): { title: string; body: string } | null {
  const doctor = findDoctor(visit.doctorId)?.name ?? "your doctor";
  const when = whenLabel(visit);
  switch (kind) {
    case "booking_confirmed":
      return { title: "Appointment confirmed", body: `${doctor}, ${when}. Reference ${visit.reference}.` };
    case "appointment_cancelled":
      return { title: "Appointment cancelled", body: `Your visit with ${doctor} on ${when} was cancelled.` };
    case "appointment_rescheduled":
      return { title: "Appointment moved", body: `Your visit with ${doctor} is now ${when}.` };
    case "rebooking_offer":
      return { title: "Please pick a new time", body: `${doctor} changed their hours, so your visit on ${when} needs a new time. Check your email or texts for the times held for you.` };
    case "rebooking_confirmed":
      return { title: "New time booked", body: `Your visit with ${doctor} is now ${when}. Reference ${visit.reference}.` };
    case "rebooking_closed":
      return { title: "Appointment cancelled", body: `Your visit with ${doctor} on ${extra.previousWhen ?? when} was cancelled. Anything you paid is refunded in full.` };
    case "doctor_booking":
      return { title: "New booking", body: `${visit.patientName}, ${when}. Reference ${visit.reference}.` };
    case "doctor_cancelled":
      return {
        title: "Visit cancelled",
        body: `${visit.patientName}, ${when}${extra.cancelledBy === "patient" ? ", cancelled by the patient" : ""}.`,
      };
    case "doctor_rescheduled":
      return { title: "Visit moved", body: `${visit.patientName} is now ${when}.` };
    default:
      return null;
  }
}

/** Add a visit change to someone's inbox. The dedupe key keeps a retry from adding it twice. Never throws. */
async function addToInbox(userId: string, kind: NotificationKind, visit: AppointmentRecord, dedupe: string, href: string, extra?: Partial<NoticeData>): Promise<void> {
  const text = inboxText(kind, visit, extra);
  if (!text) return;
  try {
    await (await getOps()).createInboxItem({ id: `${dedupe}:${userId}`, userId, kind, ...text, href, appointmentId: visit.id });
  } catch (error) {
    console.error(`[inbox] Could not add ${kind} for ${visit.reference}: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

export interface NoticeOptions {
  /** Unique per message: queueing the same key twice sends once. */
  dedupe: string;
  scheduledFor?: Date;
  extra?: Partial<NoticeData>;
}

/** Texts cost money, so only some notices go by SMS, and only the last (shortest) reminder. */
async function smsWanted(kind: NotificationKind, options: NoticeOptions): Promise<boolean> {
  if (!SMS_KINDS.includes(kind)) return false;
  if (kind !== REMINDER_KIND) return true;
  const offsets = await reminderOffsets();
  return offsets.length > 0 && options.extra?.offsetMinutes === Math.min(...offsets);
}

/** Queue a notice to the visit's patient on every active channel. Returns whether anything was queued. */
export async function queueNotice(kind: NotificationKind, visit: AppointmentRecord, options: NoticeOptions): Promise<boolean> {
  if (visit.patientUserId) await addToInbox(visit.patientUserId, kind, visit, options.dedupe, "/appointments", options.extra);
  try {
    const contact = await contactFor(visit);
    if (!contact) return false;
    const ops = await getOps();
    let queued = false;
    for (const channel of await activeChannels(ops)) {
      if (channel === "sms" && !(await smsWanted(kind, options))) continue;
      const recipient = channel === "email" ? contact.email : visit.patientMobile || contact.mobile;
      if (!recipient) continue;
      // Fast2SMS reaches Indian mobiles only; everyone else gets the email alone.
      if (channel === "sms" && !indianMobile(recipient)) continue;
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

// --- Doctors ---------------------------------------------------------------------------------

export interface DoctorContact {
  userId: string;
  name: string;
  email: string;
}

/** The accounts that run a doctor's book: normally one, and none are mailed once disabled. */
export async function doctorContacts(doctorId: string): Promise<DoctorContact[]> {
  const users = await (await getStore()).listUsers();
  return users
    .filter((user) => user.role === "doctor" && !user.disabledAt && user.doctorId === doctorId)
    .map((user) => ({ userId: user.id, name: user.name, email: user.email }));
}

export const reasonLabel = (reasonId: string): string => reasons.find((reason) => reason.id === reasonId)?.label ?? "";

export interface DoctorNoticeOptions {
  /** Unique per message and doctor account: the doctor's user id is added. */
  dedupe: string;
  /** The person who made the change. A doctor is not emailed about their own action. */
  actorUserId?: string | null;
  extra?: Partial<NoticeData>;
}

/**
 * Queue an email to the visit's doctor (email only), unless they switched that kind off or made the
 * change themselves. Returns how many were queued. Never throws.
 */
export async function queueDoctorNotice(kind: NotificationKind, visit: AppointmentRecord, options: DoctorNoticeOptions): Promise<number> {
  try {
    const ops = await getOps();
    let queued = 0;
    for (const doctor of await doctorContacts(visit.doctorId)) {
      if (options.actorUserId && options.actorUserId === doctor.userId) continue;
      // The bell gets every visit change, even when the doctor has switched that email off.
      await addToInbox(doctor.userId, kind, visit, options.dedupe, "/dashboard", options.extra);
      const pref = prefForKind(kind);
      if (pref && !(await getDoctorPrefs(doctor.userId))[pref]) continue;
      const data = noticeData(visit, salutation(doctor.name), {
        reasonLabel: reasonLabel(visit.reasonId),
        patientMobile: visit.patientMobile || undefined,
        ...options.extra,
      });
      const result = await ops.enqueueNotification({
        dedupeKey: `${options.dedupe}:${doctor.userId}:email`,
        kind,
        channel: "email",
        recipient: doctor.email,
        appointmentId: visit.id,
        payload: data as unknown as Record<string, unknown>,
        scheduledFor: now().toISOString(),
      });
      if (result === "queued") queued += 1;
    }
    return queued;
  } catch (error) {
    console.error(`[notice] Could not queue ${kind} for the doctor of ${visit.reference}: ${error instanceof Error ? error.message : "unknown error"}`);
    return 0;
  }
}

/** A patient cancelled, or someone cancelled for them: tell the doctor and say who did it. */
export async function notifyDoctorCancelled(visit: AppointmentRecord, actor: { id: string; name: string }, cancelledBy: "patient" | "clinic", reason = ""): Promise<void> {
  await queueDoctorNotice("doctor_cancelled", visit, {
    dedupe: `doctor_cancelled:${visit.id}`,
    actorUserId: actor.id,
    extra: { cancelledBy, actorName: cancelledBy === "patient" ? visit.patientName : actor.name, ...(reason ? { reason } : {}) },
  });
}

const IST = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Calcutta", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** The hour (India time) the daily schedule goes out, from the settings table. 7 unless changed. */
export const SUMMARY_HOUR_SETTING = "doctor_summary_hour_ist";
const SUMMARY_LATEST_HOUR = 18;

/**
 * Queue each doctor's schedule for today, once per doctor per day. It runs on every cron tick, and
 * does nothing before the summary hour (7:00 India time by default), after the working day, or for a
 * doctor with no visits today or who switched the email off. The dedupe key makes the repeat ticks free.
 */
export async function queueDailySummaries(instant: Date = now()): Promise<number> {
  const ops = await getOps();
  const configured = await ops.getSetting(SUMMARY_HOUR_SETTING);
  const hour = typeof configured === "number" && Number.isInteger(configured) && configured >= 0 && configured < 24 ? configured : 7;
  const parts = Object.fromEntries(IST.formatToParts(instant).map((part) => [part.type, part.value]));
  const istHour = Number(parts.hour);
  if (istHour < hour || istHour >= Math.max(SUMMARY_LATEST_HOUR, hour + 1)) return 0;

  const date = practiceWallClock(instant).date;
  const store = await getStore();
  const visits = (await store.listAppointments()).filter((visit) => visit.date === date && visit.status === "booked");
  const byDoctor = new Map<string, AppointmentRecord[]>();
  for (const visit of visits) byDoctor.set(visit.doctorId, [...(byDoctor.get(visit.doctorId) ?? []), visit]);

  let queued = 0;
  for (const [doctorId, list] of byDoctor) {
    const sorted = [...list].sort((a, b) => a.time.localeCompare(b.time) || (a.token ?? 0) - (b.token ?? 0));
    const items = sorted.map((visit) => ({
      time: visit.time,
      patientName: visit.patientName,
      reasonLabel: reasonLabel(visit.reasonId),
      reference: visit.reference,
      token: visit.token ?? null,
    }));
    for (const doctor of await doctorContacts(doctorId)) {
      if (!(await getDoctorPrefs(doctor.userId)).dailySummary) continue;
      const result = await ops.enqueueNotification({
        dedupeKey: `doctor_daily:${doctor.userId}:${date}:email`,
        kind: "doctor_daily_summary",
        channel: "email",
        recipient: doctor.email,
        appointmentId: null,
        payload: {
          firstName: salutation(doctor.name),
          patientName: "",
          reference: "",
          doctorName: findDoctor(doctorId)?.name ?? doctor.name,
          when: "",
          dateLabel: formatShortDate(date),
          items,
        } satisfies NoticeData as unknown as Record<string, unknown>,
        scheduledFor: instant.toISOString(),
      });
      if (result === "queued") queued += 1;
    }
  }
  return queued;
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
  let data = row.payload as unknown as NoticeData;
  if (row.kind === "rebooking_offer") {
    // The offer must still be open, and the link is rebuilt here so the token itself is never stored.
    const visit = row.appointmentId ? await store.getAppointment(row.appointmentId) : null;
    if (!visit || visit.status !== "displaced" || !data.offerId) {
      await ops.finishNotification(row.id, "cancelled", "The patient already answered this offer.");
      return "cancelled";
    }
    data = { ...data, rebookLinks: rebookLinks(siteUrl(), data.offerId, data.offerSlots ?? []) };
  }
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
  const message = renderNotice(row.kind as NotificationKind, data);
  if (row.channel === "sms") message.sms = renderSms(row.kind as NotificationKind, data);
  const result = await channel.send(row.recipient, message);
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
  // The doctor hears once the visit is confirmed: a held place waiting for payment sends nothing.
  await queueDoctorNotice("doctor_booking", visit, { dedupe: `doctor_booking:${visit.id}` });
  await scheduleReminders(visit);
}

/** Confirm a booking for payment at the desk: the same follow-ups, sent after the response. */
export async function onBookingConfirmedSoon(visit: AppointmentRecord, extra: Partial<NoticeData> = {}): Promise<void> {
  await onBookingConfirmed(visit, extra);
  await dispatchSoon();
}
