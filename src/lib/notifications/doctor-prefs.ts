/**
 * Which emails a doctor wants. Kept per doctor account in the settings table (no schema change), and
 * every kind is on until the doctor switches it off.
 */
import { getOps } from "../ops";
import type { NotificationKind } from "./types";

export interface DoctorNotifyPrefs {
  booked: boolean;
  cancelled: boolean;
  rescheduled: boolean;
  dailySummary: boolean;
}

export const DEFAULT_DOCTOR_PREFS: DoctorNotifyPrefs = { booked: true, cancelled: true, rescheduled: true, dailySummary: true };

export const PREF_KEYS = Object.keys(DEFAULT_DOCTOR_PREFS) as Array<keyof DoctorNotifyPrefs>;

const prefKey = (userId: string) => `doctor_notify:${userId}`;

const KIND_PREF: Partial<Record<NotificationKind, keyof DoctorNotifyPrefs>> = {
  doctor_booking: "booked",
  doctor_cancelled: "cancelled",
  doctor_rescheduled: "rescheduled",
  doctor_daily_summary: "dailySummary",
};

export function prefForKind(kind: NotificationKind): keyof DoctorNotifyPrefs | null {
  return KIND_PREF[kind] ?? null;
}

/** Read stored preferences. Anything missing or malformed counts as on. */
export function readDoctorPrefs(raw: unknown): DoctorNotifyPrefs {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const prefs = { ...DEFAULT_DOCTOR_PREFS };
  for (const key of PREF_KEYS) if (source[key] === false) prefs[key] = false;
  return prefs;
}

export async function getDoctorPrefs(userId: string): Promise<DoctorNotifyPrefs> {
  return readDoctorPrefs(await (await getOps()).getSetting(prefKey(userId)));
}

export async function saveDoctorPrefs(userId: string, prefs: DoctorNotifyPrefs): Promise<void> {
  await (await getOps()).setSetting(prefKey(userId), readDoctorPrefs(prefs));
}
