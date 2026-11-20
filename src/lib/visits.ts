import { actorOf, recordEvent, visitSummary } from "./audit";
import { settleCancelledVisit } from "./billing";
import type { AppointmentRecord, AppointmentStatus, ConsultSession, PublicUser, RescheduleRecord } from "./clinic-types";
import { patientPlace } from "./sessions";
import { forgetBlockedSlots } from "./blocked-slots";
import { cancelReminders, dispatchSoon, notifyDoctorCancelled, queueNotice } from "./notifications/service";
import { refundForCancellation, type CancellationRefund } from "./payments/service";
import { getStore } from "./store";
import { now, todayIso } from "./clock";

export type VisitChange = "ok" | "missing" | "forbidden" | "closed";

export function sortVisits(visits: readonly AppointmentRecord[]): AppointmentRecord[] {
  return [...visits].sort((a, b) => (a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)));
}

/** Reception and admins see every doctor's book. */
export function seesWholeBook(user: Pick<PublicUser, "role">): boolean {
  return user.role === "reception" || user.role === "admin";
}

export type PlacedVisit = AppointmentRecord & { sessionWindow: string | null; queueToken: number | null };

function decorateVisit(visit: AppointmentRecord, sessions: readonly ConsultSession[]): PlacedVisit {
  const session = visit.sessionId ? (sessions.find((item) => item.id === visit.sessionId) ?? null) : null;
  const place = patientPlace(visit, session);
  return { ...visit, sessionWindow: place.window, queueToken: place.token };
}

async function withPlaces(visits: AppointmentRecord[], store: Awaited<ReturnType<typeof getStore>>): Promise<PlacedVisit[]> {
  const sessions = await store.listConsultSessions().catch(() => [] as ConsultSession[]);
  return visits.map((visit) => decorateVisit(visit, sessions));
}

export async function visitsFor(user: PublicUser): Promise<PlacedVisit[]> {
  const store = await getStore();
  // Ask the store for just this person's book rather than reading every visit and filtering here.
  if (seesWholeBook(user)) return withPlaces(sortVisits(await store.listAppointments()), store);
  if (user.role === "doctor") {
    if (!user.doctorId) return [];
    return withPlaces(sortVisits(await store.listAppointments({ doctorId: user.doctorId })), store);
  }
  return withPlaces(sortVisits(await store.listAppointments({ patientUserId: user.id })), store);
}

export async function changeAppointmentStatus(
  actor: PublicUser,
  id: string,
  status: Extract<AppointmentStatus, "completed" | "cancelled">,
  reason = "",
): Promise<VisitChange> {
  const store = await getStore();
  const visit = await store.getAppointment(id);
  if (!visit) return "missing";
  // A held place that is waiting for payment can be given up; nothing else is open except a booked visit.
  if (visit.status !== "booked" && visit.status !== "pending_payment") return "closed";
  if (visit.status === "pending_payment" && status === "completed") return "closed";

  const owns = actor.id === visit.patientUserId;
  const doctor = actor.role === "doctor" && actor.doctorId === visit.doctorId;
  const desk = seesWholeBook(actor);
  if (status === "completed" && !(doctor || desk)) return "forbidden";
  if (status === "cancelled" && !(owns || doctor || desk)) return "forbidden";

  // Move from the status we read, so two people cancelling at once (or a payment landing) change it once.
  if ((await store.transitionStatus(id, visit.status, status)) !== "ok") return "closed";
  forgetBlockedSlots();
  const who = actorOf(actor);
  await recordEvent({
    actor: who,
    action: status === "cancelled" ? "appointment.cancelled" : "appointment.completed",
    subjectType: "appointment",
    subjectId: visit.id,
    summary: visitSummary(visit),
    reason: reason.trim().slice(0, 200),
  });
  // Reminders only make sense for a visit that is still going to happen.
  await cancelReminders(visit.id);
  if (status === "cancelled" && visit.status === "booked") {
    const cancelledBy = owns && !doctor && !desk ? "patient" : "clinic";
    // Paid through the payment system: the refund policy decides. Otherwise the older desk and demo flow applies.
    const real: CancellationRefund | null | "error" = await refundForCancellation(visit, cancelledBy, who.name).catch((error: unknown) => {
      console.error(`[payments] Could not refund ${visit.reference}: ${error instanceof Error ? error.message : "unknown error"}`);
      return "error" as const;
    });
    if (real === null) {
      await settleCancelledVisit(visit, who).catch((error: unknown) => {
        console.error(`[billing] Could not refund ${visit.reference}: ${error instanceof Error ? error.message : "unknown error"}`);
      });
    }
    const refund = real && real !== "error" ? real : null;
    const refunding = refund?.refund && refund.refund.status !== "failed" ? refund.refund.amountMinor : refund ? 0 : undefined;
    await queueNotice("appointment_cancelled", visit, {
      dedupe: `appointment_cancelled:${visit.id}`,
      extra: {
        cancelledBy,
        ...(doctor ? { actorName: actor.name } : {}),
        ...(refunding !== undefined ? { refundMinor: refunding, refundPercent: refund?.decision.percent, detail: refund?.decision.explanation } : {}),
        ...(real === "error" ? { detail: "Any refund due is being looked at by the practice and you will hear from us." } : {}),
      },
    });
    // The doctor hears about every cancellation of a confirmed visit except their own.
    await notifyDoctorCancelled(visit, actor, cancelledBy, reason.trim().slice(0, 200));
    await dispatchSoon();
  }
  return "ok";
}

/** What staff do as the day runs: check a patient in, call them in, or close a visit nobody came to. */
export type QueueStep = "check_in" | "start_consult" | "no_show";

/** "already": that step was done before (a second check-in changes nothing). "not_today": only on the day. */
export type QueueStepResult = "ok" | "already" | "missing" | "forbidden" | "closed" | "not_today";

/**
 * Checking in, calling in, and no-shows are the front desk's job: reception and admins only.
 * Doctors (even on their own clinic) and patients are refused; a doctor still marks their visit completed.
 */
export function canRunQueue(actor: Pick<PublicUser, "role" | "doctorId">, _visit?: Pick<AppointmentRecord, "doctorId">): boolean {
  return seesWholeBook(actor);
}

const STEP_ACTIONS: Record<QueueStep, string> = {
  check_in: "appointment.checked_in",
  start_consult: "appointment.consult_started",
  no_show: "appointment.no_show",
};

export async function runQueueStep(actor: PublicUser, id: string, step: QueueStep): Promise<QueueStepResult> {
  const store = await getStore();
  const visit = await store.getAppointment(id);
  if (!visit) return "missing";
  if (!canRunQueue(actor, visit)) return "forbidden";
  if (step === "check_in" && visit.checkedInAt) return "already";
  if (step === "start_consult" && visit.consultStartedAt) return "already";
  if (step === "no_show" && visit.status === "no_show") return "already";
  if (visit.status !== "booked") return "closed";
  const at = now();
  const today = todayIso(at);
  // Check-in and calling in happen on the day. A no-show can also close a visit left open from an earlier day.
  if (step === "no_show" ? visit.date > today : visit.date !== today) return "not_today";

  const stamp = at.toISOString();
  if (step === "check_in") {
    const outcome = await store.markVisit(id, "checked_in", stamp);
    if (outcome !== "ok") return outcome === "already" ? "already" : outcome === "missing" ? "missing" : "closed";
  } else if (step === "start_consult") {
    // Calling in someone the desk did not check in also records them as arrived.
    if (!visit.checkedInAt) {
      const arrived = await store.markVisit(id, "checked_in", stamp);
      if (arrived !== "ok" && arrived !== "already") return arrived === "missing" ? "missing" : "closed";
    }
    const outcome = await store.markVisit(id, "consult_started", stamp);
    if (outcome !== "ok") return outcome === "already" ? "already" : outcome === "missing" ? "missing" : "closed";
  } else {
    // Someone who checked in is here: finish or cancel their visit instead.
    if (visit.checkedInAt) return "closed";
    if ((await store.transitionStatus(id, "booked", "no_show")) !== "ok") return "closed";
    forgetBlockedSlots();
    await cancelReminders(visit.id);
  }
  await recordEvent({
    actor: actorOf(actor),
    action: STEP_ACTIONS[step],
    subjectType: "appointment",
    subjectId: visit.id,
    summary: visitSummary(visit),
  });
  return "ok";
}

/** The moves made to the visits `user` can see, oldest first, grouped by visit. */
export async function reschedulesFor(user: PublicUser): Promise<Record<string, RescheduleRecord[]>> {
  const store = await getStore();
  let moves: RescheduleRecord[];
  if (seesWholeBook(user)) moves = await store.listReschedules();
  else if (user.role === "doctor") moves = user.doctorId ? await store.listReschedules({ doctorId: user.doctorId }) : [];
  else moves = await store.listReschedules({ patientUserId: user.id });
  const grouped: Record<string, RescheduleRecord[]> = {};
  for (const move of moves) (grouped[move.appointmentId] ??= []).push(move);
  return grouped;
}
