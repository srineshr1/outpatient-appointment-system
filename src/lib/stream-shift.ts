/**
 * A session grows into the start of a neighbouring stream: the stream starts later, and the booked
 * patients in the part it gives up move to its earliest free later slots that day (planStreamShift).
 * This writes the change in one store call and then tells each patient their time moved.
 */
import { actorOf, recordEvent, visitSummary } from "./audit";
import type { AppointmentRecord, ConsultSession, PublicUser, SessionTrim, ShiftMove } from "./clinic-types";
import { now } from "./clock";
import { rescheduleReminders } from "./notifications/service";
import { canMove, notifyRescheduled, placementLabel } from "./reschedule";
import { slotId, type ShiftableVisit, type StreamMove } from "./sessions";
import { getStore } from "./store";

/** The reason given to patients and in the history line. */
export const SHIFT_REASON = "The clinic session times changed";

/** Visits the shift may look at: everything that holds a place. Booked ones that have not started may move. */
export function shiftCandidates(appointments: readonly AppointmentRecord[], today: string): ShiftableVisit[] {
  return appointments
    .filter((visit) => visit.date >= today && (visit.status === "booked" || visit.status === "pending_payment" || visit.status === "completed"))
    .map((visit) => ({ id: visit.id, status: visit.status, date: visit.date, time: visit.time, endTime: visit.endTime ?? null, sessionId: visit.sessionId ?? null }));
}

/** Whether a booked visit may still be moved by the shift: it has not started. */
export function shiftMovable(appointments: readonly AppointmentRecord[]): (visit: ShiftableVisit) => boolean {
  const byId = new Map(appointments.map((visit) => [visit.id, visit]));
  return (visit) => {
    const record = byId.get(visit.id);
    return Boolean(record && canMove(record));
  };
}

/** "Asha 12:00 → 12:40" lines for the confirmation. */
export function shiftLines(moves: readonly StreamMove[], appointments: readonly AppointmentRecord[]): string[] {
  const byId = new Map(appointments.map((visit) => [visit.id, visit]));
  return moves.map((move) => `${byId.get(move.visitId)?.patientName ?? "Patient"} ${move.fromTime} → ${move.toTime}`);
}

export async function shiftAndSave(
  actor: PublicUser,
  session: ConsultSession,
  trims: readonly SessionTrim[],
  moves: readonly StreamMove[],
  appointments: readonly AppointmentRecord[],
): Promise<{ ok: true; moved: AppointmentRecord[] } | { ok: false; reason: "stale" | "taken" }> {
  const store = await getStore();
  const byId = new Map(appointments.map((visit) => [visit.id, visit]));
  const at = now().toISOString();
  const writes: ShiftMove[] = [];
  const moved: AppointmentRecord[] = [];
  for (const move of moves) {
    const visit = byId.get(move.visitId);
    if (!visit || visit.status !== "booked") return { ok: false, reason: "stale" };
    const to = {
      slotId: slotId(visit.doctorId, move.date, move.toTime),
      date: move.date,
      time: move.toTime,
      endTime: move.toEndTime,
      sessionId: move.sessionId,
      token: null,
      waveCapacity: null,
    };
    writes.push({
      appointmentId: visit.id,
      fromSlotId: visit.slotId,
      to,
      history: {
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
        fromToken: null,
        toSlotId: to.slotId,
        toDate: to.date,
        toTime: to.time,
        toToken: null,
        reason: SHIFT_REASON,
        at,
      },
    });
    moved.push({ ...visit, ...to });
  }
  const outcome = await store.saveSessionShifting(session, trims, writes);
  if (outcome !== "ok") return { ok: false, reason: outcome };
  for (const [index, visit] of moved.entries()) {
    const history = writes[index]!.history;
    await recordEvent({
      actor: actorOf(actor),
      action: "appointment.rescheduled",
      subjectType: "appointment",
      subjectId: visit.id,
      summary: `${visitSummary(visit)} · was ${placementLabel({ date: history.fromDate, time: history.fromTime })}`,
      reason: SHIFT_REASON,
    });
    // The old reminders were for the old time; then email and text the patient (old and new time).
    await rescheduleReminders(visit);
    await notifyRescheduled(actor, visit, history);
  }
  return { ok: true, moved };
}
