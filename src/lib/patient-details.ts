import { paymentLabels } from "./billing";
import type { AppointmentRecord, AppointmentStatus, PublicUser } from "./clinic-types";
import { reasons } from "./data";
import { GENDERS, readPatientProfile } from "./profiles";
import { queueClock } from "./queue";
import { patientPlace } from "./sessions";
import { getStore } from "./store";
import { canRunQueue } from "./visits";

/** One earlier visit by the same patient, as the doctor sees it in the details panel. */
export interface PastVisit {
  id: string;
  reference: string;
  date: string;
  time: string;
  reason: string;
  status: AppointmentStatus;
}

/** Everything the doctor sees about the patient in front of them. Built on the server for one visit. */
export interface PatientDetails {
  visitId: string;
  reference: string;
  name: string;
  /** ISO date of birth, or "" when not given. */
  dob: string;
  /** Whole years on the day of the visit, or null without a date of birth. */
  age: number | null;
  /** The patient's own words from their profile ("Female", "Prefer not to say"), or "" when not stored. */
  sex: string;
  mobile: string;
  email: string;
  chi: string;
  token: number | null;
  date: string;
  time: string;
  reason: string;
  /** "Anything the doctor should know" from the booking form. */
  note: string;
  status: AppointmentStatus;
  checkedInAt: string | null;
  checkedInLabel: string | null;
  consultStartedAt: string | null;
  consultStartedLabel: string | null;
  payment: string;
  pastVisits: PastVisit[];
}

export type PatientDetailsResult = { ok: true; details: PatientDetails } | { ok: false; reason: "signed_out" | "missing" | "forbidden" };

/** How many earlier visits the panel lists. */
export const PAST_VISIT_LIMIT = 10;

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
    }));
}

/** Who may open a patient's details: the visit's own doctor, reception and admins. Never patients or other doctors. */
export function canViewPatientDetails(
  actor: Pick<PublicUser, "role" | "doctorId">,
  visit: Pick<AppointmentRecord, "doctorId">,
): boolean {
  return canRunQueue(actor, visit);
}

function genderLabel(id: string): string {
  return GENDERS.find((item) => item.id === id)?.label ?? "";
}

/** Load one visit's patient details for the signed-in staff member, checking they may see them. */
export async function loadPatientDetails(actor: PublicUser | null, visitId: string): Promise<PatientDetailsResult> {
  if (!actor) return { ok: false, reason: "signed_out" };
  if (!visitId) return { ok: false, reason: "missing" };
  const store = await getStore();
  const visit = await store.getAppointment(visitId);
  if (!visit) return { ok: false, reason: "missing" };
  if (!canViewPatientDetails(actor, visit)) return { ok: false, reason: "forbidden" };

  const [account, profile, book, payments, session] = await Promise.all([
    visit.patientUserId ? store.getUserById(visit.patientUserId) : Promise.resolve(null),
    visit.patientUserId ? store.getProfile(visit.patientUserId).catch(() => null) : Promise.resolve(null),
    // Only this doctor's book: a doctor never sees what the patient booked with someone else.
    store.listAppointments({ doctorId: visit.doctorId }),
    paymentLabels([visit]).catch(() => ({}) as Record<string, string>),
    visit.sessionId ? store.getConsultSession(visit.sessionId).catch(() => null) : Promise.resolve(null),
  ]);
  const patientAccount = account?.role === "patient" ? account : null;
  const dob = visit.patientDob || patientAccount?.dob || "";
  const sexId = profile?.kind === "patient" ? readPatientProfile(profile).gender : "";

  return {
    ok: true,
    details: {
      visitId: visit.id,
      reference: visit.reference,
      name: visit.patientName,
      dob,
      age: ageOn(dob, visit.date),
      sex: genderLabel(sexId),
      mobile: visit.patientMobile || patientAccount?.mobile || "",
      email: patientAccount?.email ?? "",
      chi: visit.patientChi,
      // The token patients see: the wave token, or the slot's place in a fixed-slot session.
      token: patientPlace(visit, session).token ?? visit.token ?? null,
      date: visit.date,
      time: visit.time,
      reason: reasonLabel(visit.reasonId),
      note: visit.note,
      status: visit.status,
      checkedInAt: visit.checkedInAt ?? null,
      checkedInLabel: visit.checkedInAt ? queueClock(visit.checkedInAt) : null,
      consultStartedAt: visit.consultStartedAt ?? null,
      consultStartedLabel: visit.consultStartedAt ? queueClock(visit.consultStartedAt) : null,
      payment: payments[visit.id] ?? "",
      pastVisits: pastVisitsOf(visit, book),
    },
  };
}
