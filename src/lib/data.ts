import type { ConsultSession } from "./clinic-types";
import { addDays, mondayOf, todayIso, weekdayIndex } from "./clock";
import { demoSessions, slotId as streamSlotId, slotsForSession, weekdaysLabel } from "./sessions";

export interface Practice {
  name: string;
  shortName: string;
  address: string;
  phoneDisplay: string;
  phoneHref: string;
  sameDayClose: string;
  hours: string;
}

export interface Reason {
  id: string;
  label: string;
  minutes: number;
}

export type HairStyle = "short" | "curly" | "bob" | "long" | "bun";

/** Inputs for the illustrated portrait. Swap for a real photo when the practice supplies one. */
export interface Portrait {
  background: string;
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  shirt: string;
  beard?: string;
  glasses?: boolean;
}

export interface Doctor {
  id: string;
  name: string;
  short: string;
  qualification: string;
  interest: string;
  years: number;
  note: string;
  room: string;
  /** Short introduction shown on the landing page. */
  bio: string;
  languages: string[];
  /** Days the doctor is usually in clinic. */
  days: string;
  portrait: Portrait;
  /** Consultation fee in pence, when the doctor sets one. Otherwise the practice's fee for the visit reason applies. */
  feePence?: number;
}

export interface Slot {
  id: string;
  doctorId: string;
  /** London calendar date, YYYY-MM-DD. */
  date: string;
  /** London wall-clock start, HH:MM. */
  time: string;
  taken?: boolean;
  /** Registrar teaching session: on the list but not bookable. */
  teaching?: boolean;
  /** When the slot or wave ends, HH:MM. */
  endTime?: string;
  /** "stream": one patient at `time`. "wave": up to `capacity` patients, seen in token order. */
  mode?: "stream" | "wave";
  /** Wave: how many patients the wave takes. */
  capacity?: number;
  /** Wave: how many tokens are taken. */
  booked?: number;
  sessionId?: string;
  room?: string;
}

export const practice: Practice = {
  name: "Westbrook Medical Practice",
  shortName: "Westbrook",
  address: "14 Westbrook Place, Edinburgh EH8 9RL",
  phoneDisplay: "0131 496 0280",
  phoneHref: "tel:+441314960280",
  sameDayClose: "16:00",
  hours: "Desk open 08:00–18:00, Monday to Friday",
};

export const reasons: Reason[] = [
  { id: "new", label: "A new concern", minutes: 15 },
  { id: "follow", label: "A follow-up", minutes: 10 },
  { id: "meds", label: "A medication review", minutes: 15 },
  { id: "bp", label: "A blood-pressure check", minutes: 10 },
];

export const doctors: Doctor[] = [
  {
    id: "adeyemi",
    name: "Dr Amara Adeyemi",
    short: "Dr Adeyemi",
    qualification: "MRCGP",
    interest: "General practice",
    years: 16,
    note: "Sees the full list, and supervises Dr MacLeod.",
    room: "Room 2",
    bio: "Senior partner and the practice’s lead GP. Happy to see anything, from a new worry to a long-running condition.",
    languages: ["English", "Yoruba"],
    days: "Monday to Friday",
    portrait: { background: "#FFE6C7", skin: "#7A4A2E", hair: "#1C130F", hairStyle: "curly", shirt: "#2563EB" },
  },
  {
    id: "reid",
    name: "Dr Callum Reid",
    short: "Dr Reid",
    qualification: "MRCGP",
    interest: "Diabetes",
    years: 12,
    note: "General practice. Friday mornings are his diabetes clinic.",
    room: "Room 1",
    bio: "Runs the diabetes clinic and annual reviews. Good for anything to do with blood sugar, weight or the heart.",
    languages: ["English", "Gaelic"],
    days: "Monday to Friday",
    portrait: { background: "#DCEBFF", skin: "#F1C6A4", hair: "#B4572A", hairStyle: "short", shirt: "#16A34A", glasses: true },
  },
  {
    id: "cho",
    name: "Dr Helen Cho",
    short: "Dr Cho",
    qualification: "MRCGP",
    interest: "Women’s health",
    years: 14,
    note: "General practice, with longer visits for a first women’s health concern.",
    room: "Room 3",
    bio: "Contraception, menopause, pregnancy planning and smear questions, alongside general practice.",
    languages: ["English", "Korean"],
    days: "Monday to Friday",
    portrait: { background: "#E3F6DA", skin: "#EBC09A", hair: "#17171A", hairStyle: "bob", shirt: "#DB2777" },
  },
  {
    id: "rahman",
    name: "Dr Yusuf Rahman",
    short: "Dr Rahman",
    qualification: "MRCGP",
    interest: "Joint injections",
    years: 21,
    note: "General practice. Joint injections are on Tuesday afternoons in the treatment room.",
    room: "Room 4",
    bio: "Sore knees, shoulders and backs. Gives joint injections and has the longest record at the practice.",
    languages: ["English", "Urdu", "Bengali"],
    days: "Tuesday and Thursday",
    portrait: {
      background: "#EFE3FF",
      skin: "#A97450",
      hair: "#29201B",
      hairStyle: "short",
      shirt: "#0F766E",
      beard: "#6F6863",
    },
  },
  {
    id: "macleod",
    name: "Dr Iona MacLeod",
    short: "Dr MacLeod",
    qualification: "MBChB",
    interest: "GP registrar",
    years: 2,
    note: "Registrar, supervised by Dr Adeyemi. Teaching sessions cannot be booked.",
    room: "Room 5",
    bio: "A qualified doctor training as a GP, supervised by Dr Adeyemi. Often has times free this week.",
    languages: ["English"],
    days: "Monday, Tuesday, Wednesday and Friday",
    portrait: { background: "#FFE2E2", skin: "#F4CFB3", hair: "#8A3A1C", hairStyle: "long", shirt: "#7C3AED" },
  },
];

/** How many weeks ahead the book is open. */
export const WEEKS_OPEN = 4;

/* ---------- Doctors added in the admin console ---------- */

/**
 * A doctor account with its own clinic book has `doctorId` equal to its account id. Those
 * doctors are listed alongside the practice's own. The server refreshes this list from the
 * store (`loadDoctors` in `doctors.ts`) before it renders or changes anything.
 */
let staffDoctors: Doctor[] = [];
/** Doctor accounts that exist but are not shown to patients yet (profile or sessions unfinished). */
let unlistedDoctors: Doctor[] = [];
let consultSessions: ConsultSession[] = demoSessions(doctors);
let sessionsVersion = 0;

export function setStaffDoctors(list: Doctor[], unlisted: Doctor[] = []): void {
  const before = JSON.stringify([staffDoctors, unlistedDoctors]);
  staffDoctors = list;
  unlistedDoctors = unlisted;
  if (JSON.stringify([staffDoctors, unlistedDoctors]) !== before) sessionsVersion += 1;
}

/**
 * Every session the server knows, removed ones included. The practice's own doctors fall back to
 * their starting sessions until the store has any rows for them.
 */
export function setConsultSessions(list: readonly ConsultSession[]): void {
  const have = new Set(list.map((session) => session.doctorId));
  const merged = [...list, ...demoSessions(doctors).filter((session) => !have.has(session.doctorId))];
  if (JSON.stringify(merged) === JSON.stringify(consultSessions)) return;
  consultSessions = merged;
  sessionsVersion += 1;
}

/** Changes whenever the doctors or sessions change, so caches built from them can be dropped. */
export function scheduleVersion(): number {
  return sessionsVersion;
}

export function sessionsOf(doctorId: string): ConsultSession[] {
  return consultSessions.filter((session) => session.doctorId === doctorId && !session.archivedAt);
}

export function findSession(id: string | null | undefined): ConsultSession | undefined {
  return id ? consultSessions.find((session) => session.id === id) : undefined;
}

/** The days a doctor sees patients, from their live sessions. */
export function daysFromSessions(sessions: readonly ConsultSession[]): string {
  const days = sessions.filter((session) => !session.archivedAt).flatMap((session) => session.weekdays);
  return days.length ? weekdaysLabel(days, true) : "";
}

/** The practice's doctors, then those who signed up or were added and are ready for patients. */
export function allDoctors(): Doctor[] {
  return (staffDoctors.length ? [...doctors, ...staffDoctors] : doctors).map(withSessionDays);
}

/**
 * Consultation fees stored in the database (clinic_doctor_fees), in minor units. They are the source of
 * truth and win over the profile's own fee. A stored 0 means the doctor sees patients free of charge.
 */
let feeOverlay: Record<string, number> = {};

export function setDoctorFees(fees: Record<string, number>): void {
  feeOverlay = fees;
}

function withSessionDays(doctor: Doctor): Doctor {
  const days = daysFromSessions(sessionsOf(doctor.id));
  const fee = feeOverlay[doctor.id];
  const next = days && days !== doctor.days ? { ...doctor, days } : doctor;
  return fee !== undefined && fee !== next.feePence ? { ...next, feePence: fee } : next;
}

/** A doctor patients can book. */
export function isListed(id: string | null | undefined): boolean {
  return Boolean(id) && (isPracticeDoctor(id as string) || staffDoctors.some((doctor) => doctor.id === id));
}

/** Any doctor we know, listed or not, so visits that already exist still show who they are with. */
export function findDoctor(id: string | null | undefined): Doctor | undefined {
  if (!id) return undefined;
  const found =
    doctors.find((doctor) => doctor.id === id) ??
    staffDoctors.find((doctor) => doctor.id === id) ??
    unlistedDoctors.find((doctor) => doctor.id === id);
  return found ? withSessionDays(found) : undefined;
}

export function isPracticeDoctor(id: string): boolean {
  return doctors.some((doctor) => doctor.id === id);
}

const PALETTE = {
  background: ["#FFE6C7", "#DCEBFF", "#E3F6DA", "#EFE3FF", "#FFE2E2"],
  skin: ["#7A4A2E", "#F1C6A4", "#EBC09A", "#A97450", "#F4CFB3", "#C68A5E"],
  hair: ["#1C130F", "#B4572A", "#17171A", "#29201B", "#8A3A1C"],
  hairStyle: ["short", "curly", "bob", "long", "bun"] as HairStyle[],
  shirt: ["#2563EB", "#16A34A", "#DB2777", "#0F766E", "#7C3AED"],
};

function pick<T>(list: readonly T[], seed: string): T {
  return list[Math.floor(unitHash(seed) * list.length)]!;
}

/** A listing for a doctor account that has its own book, from what the doctor wrote in their profile. */
export function staffDoctorProfile(
  account: { id: string; name: string; doctorRoom?: string; doctorInterest?: string },
  profile?: {
    specialty: string;
    qualification: string;
    years: number | null;
    room: string;
    feePence: number | null;
    bio: string;
    languages: string[];
  },
): Doctor {
  const interest = profile?.specialty.trim() || account.doctorInterest?.trim() || "General practice";
  const clean = account.name.replace(/\s+/g, " ").trim() || "New doctor";
  const name = /^dr\.?\s/i.test(clean) ? clean.replace(/^dr\.?\s+/i, "Dr ") : `Dr ${clean}`;
  const surname = name.split(" ").slice(-1)[0] ?? clean;
  return {
    id: account.id,
    name,
    short: name.split(" ").length > 2 ? `Dr ${surname}` : name,
    qualification: profile?.qualification.trim() || "MRCGP",
    interest,
    years: profile?.years ?? 1,
    note: interest === "General practice" ? "General practice." : `${interest}.`,
    room: profile?.room.trim() || account.doctorRoom?.trim() || "Room 6",
    bio: profile?.bio.trim() || "Recently joined the practice. Happy to see anything, from a new worry to a long-running condition.",
    languages: profile?.languages.length ? profile.languages : ["English"],
    days: "Monday to Friday",
    portrait: {
      background: pick(PALETTE.background, `${account.id}#bg`),
      skin: pick(PALETTE.skin, `${account.id}#skin`),
      hair: pick(PALETTE.hair, `${account.id}#hair`),
      hairStyle: pick(PALETTE.hairStyle, `${account.id}#style`),
      shirt: pick(PALETTE.shirt, `${account.id}#shirt`),
    },
    ...(profile?.feePence ? { feePence: profile.feePence } : {}),
  };
}

/** Stable pseudo-random value in [0, 1) for a string (FNV-1a). */
export function unitHash(input: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash / 0x100000000;
}

export const slotId = streamSlotId;

/** Share of the registrar's stream slots that are teaching sessions, so not bookable. */
const TEACHING_SHARE: Record<string, number> = { macleod: 0.3 };

/** The Monday the bookable window starts on. At the weekend, the book opens on next week. */
export function firstWeekFor(today: string): string {
  const weekday = weekdayIndex(today);
  return weekday === 0 || weekday === 6 ? mondayOf(addDays(today, 2)) : mondayOf(today);
}

export interface BookWindow {
  today: string;
  firstWeek: string;
  lastWeek: string;
}

export function bookWindow(instant?: Date): BookWindow {
  const today = todayIso(instant);
  const firstWeek = firstWeekFor(today);
  return { today, firstWeek, lastWeek: addDays(firstWeek, (WEEKS_OPEN - 1) * 7) };
}

/**
 * Generate every slot or wave in the window from the doctors' consulting sessions. Deterministic:
 * the same sessions always yield the same schedule, so server and browser agree. Nothing here
 * says who has booked: `applyHeld` (sessions.ts) adds that from the bookings.
 */
export function generateSlots(window: BookWindow): Slot[] {
  const slots: Slot[] = [];
  const lastDate = addDays(window.firstWeek, WEEKS_OPEN * 7 - 1);
  for (const doctor of allDoctors()) {
    const teaching = TEACHING_SHARE[doctor.id];
    for (const session of sessionsOf(doctor.id)) {
      for (const slot of slotsForSession(session, doctor.id, window.firstWeek, lastDate)) {
        if (teaching && slot.mode === "stream" && unitHash(`${slot.id}#teach`) < teaching) slot.teaching = true;
        slots.push(slot);
      }
    }
  }
  return slots;
}
