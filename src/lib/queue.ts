import type { AppointmentRecord } from "./clinic-types";

/**
 * Where a booked visit is on the day. "seeing": the doctor has called the patient in. "arrived": checked
 * in and waiting. "expected": booked but not here yet. Anything that is not booked is out of the queue.
 */
export type QueueStage = "seeing" | "arrived" | "expected";

export interface QueuePlace {
  /** Patients in this clinic who will be seen before this visit, including anyone with the doctor now. */
  ahead: number;
  /** Booked patients still in this queue, including this visit when it is booked. */
  waiting: number;
  /** 1-based place among people still in the queue. Null once this visit is no longer waiting. */
  position: number | null;
  /** Where this visit is on the day. Null once it is completed, cancelled, a no-show, or otherwise closed. */
  stage: QueueStage | null;
}

/** Same doctor, same day, and the same consulting session when both visits name one. */
export function sameClinicQueue(a: AppointmentRecord, b: AppointmentRecord): boolean {
  if (a.doctorId !== b.doctorId || a.date !== b.date) return false;
  if (a.sessionId && b.sessionId && a.sessionId !== b.sessionId) return false;
  return true;
}

export function queueStage(visit: AppointmentRecord): QueueStage | null {
  if (visit.status !== "booked") return null;
  if (visit.consultStartedAt) return "seeing";
  if (visit.checkedInAt) return "arrived";
  return "expected";
}

const STAGE_RANK: Record<QueueStage, number> = { seeing: 0, arrived: 1, expected: 2 };

/**
 * Queue order: whoever is with the doctor, then patients who have checked in, then those not here yet.
 * Within each group, booking order: time, then token, then id. Someone who arrives late joins the back of
 * the checked-in patients only if their slot is later; a patient who never arrives never holds anyone up.
 */
export function compareQueue(a: AppointmentRecord, b: AppointmentRecord): number {
  const rank = STAGE_RANK[queueStage(a) ?? "expected"] - STAGE_RANK[queueStage(b) ?? "expected"];
  if (rank !== 0) return rank;
  if (a.time !== b.time) return a.time < b.time ? -1 : 1;
  const tokenA = a.token ?? 0;
  const tokenB = b.token ?? 0;
  if (tokenA !== tokenB) return tokenA - tokenB;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Where a visit sits among the patients still booked in that clinic. */
export function queuePlace(visit: AppointmentRecord, roster: readonly AppointmentRecord[]): QueuePlace {
  const waiting = roster.filter((item) => item.status === "booked" && sameClinicQueue(item, visit));
  const stage = queueStage(visit);
  const ahead = waiting.filter((item) => item.id !== visit.id && compareQueue(item, visit) < 0).length;
  return {
    ahead,
    waiting: waiting.length,
    position: stage ? ahead + 1 : null,
    stage,
  };
}

export interface ClinicQueue {
  key: string;
  doctorId: string;
  sessionId: string | null;
  date: string;
  /** When the first visit in this queue is booked (HH:MM). */
  start: string;
  /** With the doctor now. Usually one patient. */
  seeing: AppointmentRecord[];
  /** Everyone still to be seen, in queue order: checked-in patients first. */
  upNext: AppointmentRecord[];
  arrived: number;
  completed: number;
  noShows: number;
}

/** Today's queues, one per doctor and session, in the order the clinics start. */
export function clinicQueues(visits: readonly AppointmentRecord[], date: string): ClinicQueue[] {
  const queues = new Map<string, ClinicQueue>();
  for (const visit of visits) {
    if (visit.date !== date) continue;
    if (visit.status !== "booked" && visit.status !== "completed" && visit.status !== "no_show") continue;
    const key = `${visit.doctorId}|${visit.sessionId ?? ""}`;
    let queue = queues.get(key);
    if (!queue) {
      queue = { key, doctorId: visit.doctorId, sessionId: visit.sessionId ?? null, date, seeing: [], upNext: [], arrived: 0, completed: 0, noShows: 0, start: visit.time };
      queues.set(key, queue);
    }
    if (visit.time < queue.start) queue.start = visit.time;
    if (visit.status === "completed") queue.completed += 1;
    else if (visit.status === "no_show") queue.noShows += 1;
    else if (queueStage(visit) === "seeing") queue.seeing.push(visit);
    else {
      queue.upNext.push(visit);
      if (visit.checkedInAt) queue.arrived += 1;
    }
  }
  return [...queues.values()]
    .filter((queue) => queue.seeing.length + queue.upNext.length > 0 || queue.completed + queue.noShows > 0)
    .sort((a, b) => a.start.localeCompare(b.start) || a.key.localeCompare(b.key))
    .map((queue) => ({
      ...queue,
      seeing: [...queue.seeing].sort(compareQueue),
      upNext: [...queue.upNext].sort(compareQueue),
    }));
}

export function queuePath(appointmentId: string): string {
  return `/appointments/${appointmentId}/queue`;
}
