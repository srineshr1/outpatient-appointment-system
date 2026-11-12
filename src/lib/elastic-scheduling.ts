/** Booking snapshots are immutable when a session's availability is resized. */
import type { AppointmentRecord, ConsultSession, Placement, RebookingOffer, SessionTrim } from "./clinic-types";
import type { Slot } from "./data";
import { applyHeld, baseSlotId, fromMinutes, heldId, overriddenDates, slotsForSession, toMinutes } from "./sessions";

export function occupiesTime(visit: Pick<AppointmentRecord, "status">): boolean {
  return visit.status === "booked" || visit.status === "pending_payment" || visit.status === "completed";
}

/** Hours, name and room may change; a booked session's recurrence/mode/step/capacity may not. */
export function sessionStructureChanged(a: ConsultSession, b: ConsultSession): boolean {
  return a.mode !== b.mode || (a.onDate ?? null) !== (b.onDate ?? null) ||
    (a.startDate ?? null) !== (b.startDate ?? null) || (a.endDate ?? null) !== (b.endDate ?? null) ||
    [...a.weekdays].sort().join(",") !== [...b.weekdays].sort().join(",") ||
    a.slotMinutes !== b.slotMinutes || a.waveMinutes !== b.waveMinutes || a.waveCapacity !== b.waveCapacity;
}

/**
 * Whether a reserved visit keeps a valid place in the changed session: the session still runs on its
 * date, its slot (or wave) still starts at the same time with the same length, and a wave still has
 * room for its token. A visit that does not fit must be moved (displaced) before a structural change.
 */
export function stillFits(
  visit: Pick<AppointmentRecord, "slotId" | "date" | "time"> & { endTime?: string | null; token?: number | null },
  next: ConsultSession,
): boolean {
  if (next.archivedAt) return false;
  const slot = slotsForSession(next, next.doctorId, visit.date, visit.date).find((item) => item.id === baseSlotId(visit.slotId));
  if (!slot || slot.time !== visit.time) return false;
  if (visit.endTime && slot.endTime && visit.endTime !== slot.endTime) return false;
  const token = visit.token ?? null;
  if (next.mode === "wave") return token !== null && token >= 1 && token <= (next.waveCapacity ?? 0);
  return token === null;
}

export type Reservation = Pick<AppointmentRecord, "id" | "doctorId" | "date" | "time" | "endTime" | "slotId" | "status" | "sessionId">;

/**
 * Places held for displaced patients (pending rebooking offers), as reservations: they count like a
 * booking for every placement check until the offer is accepted, cancelled or expired.
 */
export function holdReservations(offers: readonly RebookingOffer[]): Reservation[] {
  return offers
    .filter((offer) => offer.status === "pending")
    .flatMap((offer) => offer.slots.map((slot) => ({
      id: `hold:${offer.id}:${slot.slotId}`,
      doctorId: offer.doctorId,
      date: slot.date,
      time: slot.time,
      endTime: slot.endTime,
      slotId: slot.slotId,
      status: "booked" as const,
      sessionId: slot.sessionId,
    })));
}

function overlaps(slot: Slot, visit: Reservation): boolean {
  if (slot.doctorId !== visit.doctorId || slot.date !== visit.date) return false;
  // Old rows without a duration are protected conservatively for the rest of the clinic day.
  return toMinutes(slot.time) < toMinutes(visit.endTime ?? "23:59") &&
    toMinutes(visit.time) < toMinutes(slot.endTime ?? "23:59");
}

/**
 * Exact IDs still count wave tokens. Differently aligned slots and resized waves must also
 * respect the original promised interval. A resized wave with a different interval is closed
 * on dates with overlapping reservations, rather than silently moving patients or reusing tokens.
 */
export function applyReservations(slots: readonly Slot[], visits: readonly Reservation[], sessions: readonly ConsultSession[] = []): Slot[] {
  const active = visits.filter(occupiesTime).map(visit => {
    if (visit.endTime) return visit;
    // Stream duration cannot change while reserved, so it is safe to recover older snapshots.
    // Whole-wave durations depend on the edited bounds and must NOT be inferred from those bounds.
    const session = sessions.find(s => s.id === visit.sessionId && s.doctorId === visit.doctorId);
    const step = session?.mode === "stream" ? session.slotMinutes : session?.waveMinutes;
    return step ? { ...visit, endTime: fromMinutes(toMinutes(visit.time) + step) } : visit;
  });
  return applyHeld(slots, active.map((visit) => visit.slotId)).map((slot) => {
    const conflict = active.some((visit) => {
      if (!overlaps(slot, visit)) return false;
      const sameWave = slot.mode === "wave" && visit.slotId.includes("#") &&
        baseSlotId(visit.slotId) === slot.id && visit.time === slot.time && visit.endTime === slot.endTime;
      return !sameWave;
    });
    return conflict ? { ...slot, taken: true } : slot;
  });
}

/** Validate a placement against current sessions, not the client's stale calendar/cache. */
export function placementIsCurrent(
  doctorId: string, place: Placement, sessions: readonly ConsultSession[], trims: readonly SessionTrim[] = [],
): boolean {
  // Legacy appointments without session IDs predate session-driven availability.
  if (!place.sessionId) return true;
  const session = sessions.find((item) => item.id === place.sessionId && item.doctorId === doctorId);
  if (!session) return false;
  const own = sessions.filter((item) => item.doctorId === doctorId);
  const overridden = overriddenDates(own);
  const slot = slotsForSession(session, doctorId, place.date, place.date, overridden, trims, own)
    .find((item) => item.id === baseSlotId(place.slotId));
  return Boolean(slot && slot.time === place.time && slot.endTime === place.endTime &&
    (slot.mode === "wave" ? place.token !== null && place.token >= 1 && place.token <= (slot.capacity ?? 1) && place.waveCapacity === slot.capacity && place.slotId === heldId(slot.id, place.token) : place.token === null && place.slotId === slot.id));
}

/** Called inside the store's write transaction, with its latest reservations. */
export function placementConflicts(
  doctorId: string, place: Placement, visits: readonly Reservation[], excludeId?: string, sessions: readonly ConsultSession[] = [],
): boolean {
  const slot: Slot = { id: baseSlotId(place.slotId), doctorId, date: place.date, time: place.time,
    endTime: place.endTime ?? undefined, mode: place.token === null ? "stream" : "wave",
    capacity: place.waveCapacity ?? undefined };
  const others = visits.filter((visit) => visit.id !== excludeId && occupiesTime(visit));
  return others.some((visit) => visit.slotId === place.slotId) ||
    Boolean(applyReservations([slot], others, sessions)[0]?.taken);
}
