import type { AppointmentRecord } from "./clinic-types";

export interface QueuePlace {
  /** Booked patients in this clinic who will be seen before this visit. */
  ahead: number;
  /** Booked patients still waiting, including this visit when it is booked. */
  waiting: number;
  /** 1-based place among people still booked. Null once this visit is no longer waiting. */
  position: number | null;
}

/** Same doctor, same day, and the same consulting session when both visits name one. */
export function sameClinicQueue(a: AppointmentRecord, b: AppointmentRecord): boolean {
  if (a.doctorId !== b.doctorId || a.date !== b.date) return false;
  if (a.sessionId && b.sessionId && a.sessionId !== b.sessionId) return false;
  return true;
}

function before(a: AppointmentRecord, b: AppointmentRecord): boolean {
  if (a.time !== b.time) return a.time < b.time;
  const tokenA = a.token ?? 0;
  const tokenB = b.token ?? 0;
  if (tokenA !== tokenB) return tokenA < tokenB;
  return a.id < b.id;
}

/** Where a visit sits among the patients still booked in that clinic. */
export function queuePlace(visit: AppointmentRecord, roster: readonly AppointmentRecord[]): QueuePlace {
  const waiting = roster.filter((item) => item.status === "booked" && sameClinicQueue(item, visit));
  const ahead = waiting.filter((item) => item.id !== visit.id && before(item, visit)).length;
  const inQueue = visit.status === "booked";
  return {
    ahead,
    waiting: waiting.length,
    position: inQueue ? ahead + 1 : null,
  };
}

export function queuePath(appointmentId: string): string {
  return `/appointments/${appointmentId}/queue`;
}
