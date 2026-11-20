import type { AppointmentRecord, AppointmentStatus, ConsultSession, PublicUser } from "./clinic-types";
import { addDays } from "./clock";
import { reasons } from "./data";
import { queueClock } from "./queue";
import { patientPlace } from "./sessions";

/** One earlier visit by the same patient with this doctor. */
export interface PastVisit {
  id: string;
  reference: string;
  date: string;
  time: string;
  reason: string;
  status: AppointmentStatus;
  /** What the patient wrote for that visit ("Anything the doctor should know"). */
  note: string;
  /** The patient's rating of that visit, 1 to 5, when they gave one. */
  rating: number | null;
}

/** What the doctor sees about a patient booked into one of their sessions, with their earlier visits. */
export interface PatientDetails {
  visitId: string;
  reference: string;
  name: string;
  /** ISO date of birth, or "" when not given. */
  dob: string;
  /** Whole years on the day of the visit, or null without a date of birth. */
  age: number | null;
  mobile: string;
  chi: string;
  token: number | null;
  date: string;
  time: string;
  reason: string;
  note: string;
  status: AppointmentStatus;
  checkedInLabel: string | null;
  consultStartedLabel: string | null;
  payment: string;
  pastVisits: PastVisit[];
}

/** How many earlier visits the history lists. */
export const PAST_VISIT_LIMIT = 10;

/** How far ahead the sessions page looks for booked patients (matches its eight-week session lookahead). */
export const DETAILS_LOOKAHEAD_DAYS = 56;

function reasonLabel(id: string): string {
  return reasons.find((reason) => reason.id === id)?.label ?? "Appointment";
}

/** Whole years between an ISO date of birth and an ISO day. Null when either is missing or nonsense. */
export function ageOn(dob: string, day: string): number | null {
  const birth = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
  const at = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!birth || !at) return null;
  let years = Number(at[1]) - Number(birth[1]);
  if (at[2]! < birth[2]! || (at[2] === birth[2] && at[3]! < birth[3]!)) years -= 1;
  return years >= 0 && years < 150 ? years : null;
}

function normalise(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * The same person on another visit: the same patient account when both visits have one, otherwise
 * the same CHI number, otherwise the same name and date of birth (desk bookings have no account).
 */
export function samePatient(a: AppointmentRecord, b: AppointmentRecord): boolean {
  if (a.patientUserId && b.patientUserId) return a.patientUserId === b.patientUserId;
  if (a.patientChi.trim() && b.patientChi.trim()) return a.patientChi.replace(/\s+/g, "") === b.patientChi.replace(/\s+/g, "");
  return Boolean(a.patientDob) && a.patientDob === b.patientDob && normalise(a.patientName) === normalise(b.patientName);
}

/** Visits by the same patient before this one in the given book, newest first. Later visits are left out. */
export function pastVisitsOf(visit: AppointmentRecord, book: readonly AppointmentRecord[]): PastVisit[] {
  return book
    .filter((other) => other.id !== visit.id && samePatient(visit, other))
    .filter((other) => other.date < visit.date || (other.date === visit.date && other.time < visit.time))
    .filter((other) => other.status !== "pending_payment" && other.status !== "expired")
    .sort((a, b) => (a.date === b.date ? b.time.localeCompare(a.time) : b.date.localeCompare(a.date)))
    .slice(0, PAST_VISIT_LIMIT)
    .map((other) => ({
      id: other.id,
      reference: other.reference,
      date: other.date,
      time: other.time,
      reason: reasonLabel(other.reasonId),
      status: other.status,
      note: other.note,
      rating: other.ratingScore ?? null,
    }));
}

/** Who may see a patient's details and history: the visit's own doctor, reception and admins. */
export function canViewPatientDetails(
  actor: Pick<PublicUser, "role" | "doctorId">,
  visit: Pick<AppointmentRecord, "doctorId">,
): boolean {
  if (actor.role === "reception" || actor.role === "admin") return true;
  return actor.role === "doctor" && Boolean(actor.doctorId) && actor.doctorId === visit.doctorId;
}

/** One visit's details, with the patient's earlier visits taken from `book` (this doctor's visits only). */
export function patientDetailsOf(
  visit: AppointmentRecord,
  book: readonly AppointmentRecord[],
  sessions: readonly ConsultSession[],
  payments: Record<string, string>,
): PatientDetails {
  const session = visit.sessionId ? sessions.find((item) => item.id === visit.sessionId) ?? null : null;
  return {
    visitId: visit.id,
    reference: visit.reference,
    name: visit.patientName,
    dob: visit.patientDob,
    age: ageOn(visit.patientDob, visit.date),
    mobile: visit.patientMobile,
    chi: visit.patientChi,
    // The token patients see: the wave token, or the slot's place in a fixed-slot session.
    token: patientPlace(visit, session).token ?? visit.token ?? null,
    date: visit.date,
    time: visit.time,
    reason: reasonLabel(visit.reasonId),
    note: visit.note,
    status: visit.status,
    checkedInLabel: visit.checkedInAt ? queueClock(visit.checkedInAt) : null,
    consultStartedLabel: visit.consultStartedAt ? queueClock(visit.consultStartedAt) : null,
    payment: payments[visit.id] ?? "",
    pastVisits: pastVisitsOf(visit, book),
  };
}

/**
 * Details for every patient booked into the doctor's sessions from today up to eight weeks out,
 * keyed by visit id. Only visits the actor may see; history comes from the same doctor's book.
 */
export function sessionPatientDetails(
  actor: Pick<PublicUser, "role" | "doctorId">,
  book: readonly AppointmentRecord[],
  sessions: readonly ConsultSession[],
  payments: Record<string, string>,
  today: string,
): Record<string, PatientDetails> {
  const end = addDays(today, DETAILS_LOOKAHEAD_DAYS);
  const details: Record<string, PatientDetails> = {};
  for (const visit of book) {
    if (visit.date < today || visit.date > end) continue;
    if (visit.status !== "booked" && visit.status !== "completed" && visit.status !== "pending_payment") continue;
    if (!canViewPatientDetails(actor, visit)) continue;
    details[visit.id] = patientDetailsOf(visit, book, sessions, payments);
  }
  return details;
}
