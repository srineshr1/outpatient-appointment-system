/**
 * Moving a booked visit to another time with the same doctor. Patients move their own visits,
 * doctors move visits on their book, and reception or an admin can move any. The reference, the
 * patient, the fee and the doctor stay. Capacity is checked again inside the store, so two people
 * moving into the last place can't both succeed.
 */
import { actorOf, recordEvent, visitSummary } from "./audit";
import { forgetBlockedSlots } from "./blocked-slots";
import type { AppointmentRecord, Placement, PublicUser, RescheduleRecord } from "./clinic-types";
import { now } from "./clock";
import { findDoctor, practice } from "./data";
import { formatShortDate } from "./format";
import { sendNotice } from "./mailer";
import { rescheduleReminders } from "./notifications/service";
import { releaseExpiredHolds } from "./payments/holds";
import { rescheduleEmail } from "./reschedule-email";
import { getSlot, getSlots } from "./repository";
import { slotStart, slotStatus } from "./schedule";
import { baseSlotId, freeToken, heldId, tokenOfHeld } from "./sessions";
import { seesWholeBook } from "./visits";
import { getStore } from "./store";

export type RescheduleFailure =
  | "missing" // no such visit or time
  | "forbidden" // not this person's visit
  | "closed" // cancelled, completed or already past
  | "same" // the time it is already at
  | "elsewhere" // the time belongs to another doctor
  | "past" // the new time has passed or closed
  | "teaching"
  | "taken" // the new time or wave is full
  | "stale"; // the visit changed while moving it

export type RescheduleOutcome = { ok: true; visit: AppointmentRecord; history: RescheduleRecord } | { ok: false; reason: RescheduleFailure };

export const RESCHEDULE_MESSAGES: Record<RescheduleFailure, string> = {
  missing: "That visit or time is no longer on the book.",
  forbidden: "You can only move your own visits.",
  closed: "This visit can’t be moved any more. It is cancelled, finished or has already started.",
  same: "That is the time the visit already has. Pick a different one.",
  elsewhere: "Pick one of this doctor’s times.",
  past: "That time has passed or closed for online booking.",
  teaching: "That time isn’t open for booking.",
  taken: "That time has just been taken. Pick another.",
  stale: "This visit changed while you were moving it. Open it again and retry.",
};

/** Who may move a visit. */
export function mayReschedule(actor: Pick<PublicUser, "id" | "role" | "doctorId">, visit: Pick<AppointmentRecord, "patientUserId" | "doctorId">): boolean {
  if (actor.role === "patient") return actor.id === visit.patientUserId;
  if (actor.role === "doctor") return actor.doctorId === visit.doctorId;
  return seesWholeBook(actor);
}

/** Whether a visit can still be moved: it is booked and has not started. */
export function canMove(visit: Pick<AppointmentRecord, "status" | "date" | "time">, instant: Date = now()): boolean {
  return visit.status === "booked" && slotStart(visit).getTime() > instant.getTime();
}

export function placementOf(visit: AppointmentRecord): Placement {
  return {
    slotId: visit.slotId,
    date: visit.date,
    time: visit.time,
    sessionId: visit.sessionId ?? null,
    token: visit.token ?? null,
    waveCapacity: visit.waveCapacity ?? null,
    endTime: visit.endTime ?? null,
  };
}

/** The doctor's times a visit can move to now: open ones other than where it already is. */
export async function openTimesFor(visit: AppointmentRecord): Promise<Awaited<ReturnType<typeof getSlots>>> {
  const instant = now();
  const here = baseSlotId(visit.slotId);
  return (await getSlots(visit.doctorId)).filter((slot) => slot.id !== here && slotStatus(slot, [], instant) === "open");
}

/** "Thu 29 Oct, 09:40" or "Thu 29 Oct, 14:00 · token 3". */
export function placementLabel(place: { date: string; time: string; token?: number | null }): string {
  return `${formatShortDate(place.date)}, ${place.time}${place.token ? ` · token ${place.token}` : ""}`;
}

export async function rescheduleVisit(
  actor: PublicUser,
  appointmentId: string,
  targetSlotId: string,
  reason = "",
): Promise<RescheduleOutcome> {
  const store = await getStore();
  const visit = await store.getAppointment(appointmentId);
  if (!visit) return { ok: false, reason: "missing" };
  if (!mayReschedule(actor, visit)) return { ok: false, reason: "forbidden" };
  if (!canMove(visit)) return { ok: false, reason: "closed" };

  const target = await getSlot(baseSlotId(targetSlotId));
  if (!target) return { ok: false, reason: "missing" };
  if (target.doctorId !== visit.doctorId) return { ok: false, reason: "elsewhere" };
  if (target.id === baseSlotId(visit.slotId)) return { ok: false, reason: "same" };
  const status = slotStatus(target, [], now());
  if (status !== "open") return { ok: false, reason: status === "past" ? "past" : status === "teaching" ? "teaching" : "taken" };

  await releaseExpiredHolds();
  let held = await store.listBlockedSlotIds();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const token = target.mode === "wave" ? freeToken(target.id, target.capacity ?? 1, held) : null;
    if (target.mode === "wave" && token === null) return { ok: false, reason: "taken" };
    const to: Placement = {
      slotId: token === null ? target.id : heldId(target.id, token),
      date: target.date,
      time: target.time,
      sessionId: target.sessionId ?? null,
      token,
      waveCapacity: target.mode === "wave" ? (target.capacity ?? 1) : null,
      endTime: target.endTime ?? null,
    };
    const history: RescheduleRecord = {
      id: crypto.randomUUID(),
      appointmentId: visit.id,
      reference: visit.reference,
      doctorId: visit.doctorId,
      patientUserId: visit.patientUserId,
      byUserId: actor.id,
      byName: actor.name,
      byRole: actor.role,
      fromSlotId: visit.slotId,
      fromDate: visit.date,
      fromTime: visit.time,
      fromToken: visit.token ?? tokenOfHeld(visit.slotId),
      toSlotId: to.slotId,
      toDate: to.date,
      toTime: to.time,
      toToken: token,
      reason: reason.trim().slice(0, 200),
      at: now().toISOString(),
    };
    const outcome = await store.rescheduleAppointment(visit.id, visit.slotId, to, history);
    forgetBlockedSlots();
    if (outcome === "stale") return { ok: false, reason: "stale" };
    if (outcome === "ok") {
      const moved: AppointmentRecord = { ...visit, ...to };
      await recordEvent({
        actor: actorOf(actor),
        action: "appointment.rescheduled",
        subjectType: "appointment",
        subjectId: visit.id,
        summary: `${visitSummary(moved)} · was ${placementLabel({ date: visit.date, time: visit.time, token: history.fromToken })}`,
        reason: history.reason,
      });
      // The old reminders were for the old time: drop them and plan new ones from the new start.
      await rescheduleReminders(moved);
      return { ok: true, visit: moved, history };
    }
    // "taken": someone holds that place. A wave may have another free token; a stream slot has none.
    if (target.mode !== "wave") return { ok: false, reason: "taken" };
    held = await store.listBlockedSlotIds();
  }
  return { ok: false, reason: "taken" };
}

/**
 * Tell the other side that a visit moved: the patient when the doctor or desk moved it, the doctor
 * when the patient did. Addresses that can't receive mail (sample accounts, throwaway domains) are
 * skipped. Never throws.
 */
export async function notifyRescheduled(actor: PublicUser, visit: AppointmentRecord, history: RescheduleRecord): Promise<void> {
  try {
    const store = await getStore();
    const recipients = new Map<string, string>();
    const users = await store.listUsers();
    if (actor.role !== "patient" && visit.patientUserId) {
      const patient = users.find((user) => user.id === visit.patientUserId);
      if (patient) recipients.set(patient.email, patient.name);
    }
    if (actor.role !== "doctor") {
      for (const user of users) {
        if (user.role === "doctor" && !user.disabledAt && user.doctorId === visit.doctorId) recipients.set(user.email, user.name);
      }
    }
    recipients.delete(actor.email);
    const doctor = findDoctor(visit.doctorId)?.name ?? "the doctor";
    for (const [email, name] of recipients) {
      await sendNotice(
        email,
        rescheduleEmail({
          recipientName: name.split(" ")[0] || name,
          byName: actor.name,
          reference: visit.reference,
          patientName: visit.patientName,
          doctorName: doctor,
          from: placementLabel({ date: history.fromDate, time: history.fromTime }),
          to: placementLabel({ date: history.toDate, time: history.toTime }),
          token: history.toToken ? `token ${history.toToken}` : undefined,
          reason: history.reason || undefined,
          practiceName: practice.name,
          address: practice.address,
        }),
      );
    }
  } catch (error) {
    console.error(`[notice] Could not notify about ${visit.reference}: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}
