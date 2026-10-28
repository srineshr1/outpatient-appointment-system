import type { ProfileKind, ProfileRecord } from "./clinic-types";
import { isIsoDate } from "./clock";
import { normalisePhone, PHONE_INVALID_MESSAGE, PHONE_REQUIRED_MESSAGE } from "./phone";

/**
 * What the two kinds of account tell us about themselves when they sign up.
 * Patients: name, mobile and date of birth live on the account (so booking can pre-fill them);
 * the profile adds gender. Doctors: everything the patient directory shows.
 */

export const GENDERS = [
  { id: "female", label: "Female" },
  { id: "male", label: "Male" },
  { id: "other", label: "Another gender" },
  { id: "prefer-not", label: "Prefer not to say" },
] as const;

export interface PatientProfileData {
  gender: string;
}

export interface DoctorProfileData {
  specialty: string;
  qualification: string;
  years: number | null;
  room: string;
  /** Consultation fee in pence. Null when the doctor leaves it to the practice. */
  feePence: number | null;
  bio: string;
  languages: string[];
}

export const EMPTY_DOCTOR_PROFILE: DoctorProfileData = {
  specialty: "",
  qualification: "",
  years: null,
  room: "",
  feePence: null,
  bio: "",
  languages: ["English"],
};

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function readDoctorProfile(record: ProfileRecord | null | undefined): DoctorProfileData {
  const data = record?.data ?? {};
  const years = typeof data.years === "number" && Number.isFinite(data.years) ? Math.trunc(data.years) : null;
  const fee = typeof data.feePence === "number" && Number.isFinite(data.feePence) ? Math.trunc(data.feePence) : null;
  const languages = Array.isArray(data.languages)
    ? data.languages.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean).slice(0, 8)
    : [];
  return {
    specialty: text(data.specialty, 80),
    qualification: text(data.qualification, 80),
    years: years !== null && years >= 0 && years <= 70 ? years : null,
    room: text(data.room, 60),
    feePence: fee !== null && fee > 0 ? fee : null,
    bio: text(data.bio, 600),
    languages: languages.length ? languages : ["English"],
  };
}

export function readPatientProfile(record: ProfileRecord | null | undefined): PatientProfileData {
  const gender = text(record?.data.gender, 20);
  return { gender: GENDERS.some((item) => item.id === gender) ? gender : "" };
}

export function doctorProfileRecord(userId: string, data: DoctorProfileData, at: string): ProfileRecord {
  return { userId, kind: "doctor", data: { ...data }, updatedAt: at };
}

export function patientProfileRecord(userId: string, data: PatientProfileData, at: string): ProfileRecord {
  return { userId, kind: "patient", data: { ...data }, updatedAt: at };
}

export type DoctorProfileField = "name" | "specialty" | "qualification" | "years" | "room" | "bio" | "fee" | "languages";

/** The things a doctor still has to fill in before patients can see them. Empty when complete. */
export function missingDoctorFields(name: string, profile: DoctorProfileData): { field: DoctorProfileField; label: string }[] {
  const missing: { field: DoctorProfileField; label: string }[] = [];
  if (!name.trim()) missing.push({ field: "name", label: "Your name" });
  if (!profile.specialty) missing.push({ field: "specialty", label: "Your specialty" });
  if (!profile.qualification) missing.push({ field: "qualification", label: "Your qualifications" });
  if (profile.years === null) missing.push({ field: "years", label: "Years of experience" });
  if (!profile.room) missing.push({ field: "room", label: "Your room or clinic" });
  if (profile.bio.length < 10) missing.push({ field: "bio", label: "A short bio for patients" });
  return missing;
}

export function isDoctorProfileComplete(name: string, profile: DoctorProfileData): boolean {
  return missingDoctorFields(name, profile).length === 0;
}

export interface DoctorProfileForm {
  specialty: string;
  qualification: string;
  years: string;
  room: string;
  fee: string;
  bio: string;
  languages: string;
}

export type FormErrors<K extends string> = Partial<Record<K, string>>;

/** Pounds and pence as typed ("45" or "45.50") to pence. Null for blank, undefined for invalid. */
export function parseFee(input: string): number | null | undefined {
  const raw = input.trim().replace(/^£/, "");
  if (!raw) return null;
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(raw)) return undefined;
  const pence = Math.round(Number(raw) * 100);
  return pence > 0 ? pence : null;
}

export function checkDoctorProfile(
  form: DoctorProfileForm,
): { ok: true; value: DoctorProfileData } | { ok: false; errors: FormErrors<DoctorProfileField> } {
  const errors: FormErrors<DoctorProfileField> = {};
  const specialty = form.specialty.trim();
  if (!specialty) errors.specialty = "Tell patients what you specialise in, such as General practice.";
  else if (specialty.length > 80) errors.specialty = "Keep this to 80 characters.";
  const qualification = form.qualification.trim();
  if (!qualification) errors.qualification = "Add your qualifications, such as MBBS, MD.";
  else if (qualification.length > 80) errors.qualification = "Keep this to 80 characters.";
  const yearsText = form.years.trim();
  let years: number | null = null;
  if (!yearsText) errors.years = "Enter your years of experience. Zero is fine.";
  else if (!/^\d{1,2}$/.test(yearsText) || Number(yearsText) > 70) errors.years = "Use a whole number of years, 0 to 70.";
  else years = Number(yearsText);
  const room = form.room.trim();
  if (!room) errors.room = "Add your room or clinic, such as Room 6 or Sunrise Clinic.";
  else if (room.length > 60) errors.room = "Keep this to 60 characters.";
  const bio = form.bio.trim();
  if (bio.length < 10) errors.bio = "Write a sentence or two for patients (at least 10 characters).";
  else if (bio.length > 600) errors.bio = "Keep the bio to 600 characters.";
  const fee = parseFee(form.fee);
  if (fee === undefined) errors.fee = "Enter the fee as an amount such as 45 or 45.50, or leave it blank.";
  const languages = form.languages
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: { specialty, qualification, years, room, feePence: fee ?? null, bio, languages: languages.length ? languages : ["English"] },
  };
}

export type PatientProfileField = "name" | "mobile" | "dob" | "gender";

export interface PatientProfileForm {
  name: string;
  mobile: string;
  dob: string;
  gender: string;
}

export function checkPatientProfile(
  form: PatientProfileForm,
  today: string,
): { ok: true; value: { name: string; mobile: string; dob: string; gender: string } } | { ok: false; errors: FormErrors<PatientProfileField> } {
  const errors: FormErrors<PatientProfileField> = {};
  const name = form.name.trim().replace(/\s+/g, " ");
  if (!name) errors.name = "Enter your name.";
  else if (name.length > 100) errors.name = "Keep the name to 100 characters.";
  let mobile = "";
  if (!form.mobile.trim()) errors.mobile = PHONE_REQUIRED_MESSAGE;
  else {
    const normal = normalisePhone(form.mobile);
    if (!normal) errors.mobile = PHONE_INVALID_MESSAGE;
    else mobile = normal;
  }
  const dob = form.dob.trim();
  if (dob) {
    if (!isIsoDate(dob)) errors.dob = "Enter a real date, or leave it blank.";
    else if (dob > today) errors.dob = "That date is in the future.";
    else if (dob < "1900-01-01") errors.dob = "Check the year. We need a date after 1900.";
  }
  const gender = form.gender.trim();
  if (gender && !GENDERS.some((item) => item.id === gender)) errors.gender = "Choose one of the options, or leave it blank.";
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { name, mobile, dob, gender } };
}

export function profileKindOf(role: string): ProfileKind {
  return role === "doctor" ? "doctor" : "patient";
}
