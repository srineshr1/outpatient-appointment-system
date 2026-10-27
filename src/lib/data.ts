import { addDays, mondayOf, todayIso, weekdayIndex } from "./clock";

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

/** Weekly clinic templates, keyed by weekday (1 = Monday … 5 = Friday). */
interface Template {
  sessions: Partial<Record<1 | 2 | 3 | 4 | 5, string[]>>;
  /** Share of sessions already booked, 0–1. */
  busy: number;
  /** Share of sessions that are teaching, 0–1. */
  teaching?: number;
}

const FULL_DAY = ["09:00", "09:20", "09:40", "10:30", "11:00", "14:00", "14:20", "15:00", "15:40", "16:10"];

const templates: Record<string, Template> = {
  adeyemi: { sessions: { 1: FULL_DAY, 2: FULL_DAY, 3: FULL_DAY, 4: FULL_DAY, 5: FULL_DAY }, busy: 0.6 },
  reid: {
    sessions: {
      1: ["09:00", "10:20", "11:40", "14:00", "14:50", "16:20"],
      2: ["09:00", "10:20", "11:40", "14:00", "15:30"],
      3: ["09:10", "10:20", "11:40", "15:30", "16:20"],
      4: ["09:10", "10:20", "14:00", "14:50"],
      5: ["09:10", "09:30", "10:10", "11:30", "15:00"],
    },
    busy: 0.75,
  },
  cho: {
    sessions: {
      1: ["09:20", "09:40", "11:40", "14:20", "15:10"],
      2: ["09:40", "10:00", "11:30", "14:20", "16:00"],
      3: ["10:00", "11:30", "14:10", "16:00"],
      4: ["09:20", "09:40", "10:00"],
      5: ["09:40", "11:30", "14:10", "15:10"],
    },
    busy: 0.45,
  },
  rahman: {
    sessions: { 2: ["14:00", "14:30", "15:00", "15:30", "16:00"], 4: ["10:00", "10:40", "11:20"] },
    busy: 0.8,
  },
  macleod: {
    sessions: {
      1: ["09:30", "10:40", "15:20", "15:50"],
      2: ["09:30", "11:00", "14:40"],
      3: ["10:40", "11:00", "15:20"],
      5: ["09:50", "11:00", "15:20"],
    },
    busy: 0.35,
    teaching: 0.3,
  },
};

/** A doctor added from the admin console: a full week, nothing booked by phone yet. */
const STAFF_TEMPLATE: Template = { sessions: { 1: FULL_DAY, 2: FULL_DAY, 3: FULL_DAY, 4: FULL_DAY, 5: FULL_DAY }, busy: 0 };

/* ---------- Doctors added in the admin console ---------- */

/**
 * A doctor account with its own clinic book has `doctorId` equal to its account id. Those
 * doctors are listed alongside the practice's own. The server refreshes this list from the
 * store (`loadDoctors` in `doctors.ts`) before it renders or changes anything.
 */
let staffDoctors: Doctor[] = [];

export function setStaffDoctors(list: Doctor[]): void {
  staffDoctors = list;
}

/** The practice's doctors, then those added in the admin console. */
export function allDoctors(): Doctor[] {
  return staffDoctors.length ? [...doctors, ...staffDoctors] : doctors;
}

export function findDoctor(id: string | null | undefined): Doctor | undefined {
  if (!id) return undefined;
  return doctors.find((doctor) => doctor.id === id) ?? staffDoctors.find((doctor) => doctor.id === id);
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

/** A listing for a doctor account that has its own book. */
export function staffDoctorProfile(account: { id: string; name: string }): Doctor {
  const clean = account.name.replace(/\s+/g, " ").trim() || "New doctor";
  const name = /^dr\.?\s/i.test(clean) ? clean.replace(/^dr\.?\s+/i, "Dr ") : `Dr ${clean}`;
  const surname = name.split(" ").slice(-1)[0] ?? clean;
  return {
    id: account.id,
    name,
    short: name.split(" ").length > 2 ? `Dr ${surname}` : name,
    qualification: "MRCGP",
    interest: "General practice",
    years: 1,
    note: "General practice.",
    room: "Room 6",
    bio: "Recently joined the practice. Happy to see anything, from a new worry to a long-running condition.",
    languages: ["English"],
    days: "Monday to Friday",
    portrait: {
      background: pick(PALETTE.background, `${account.id}#bg`),
      skin: pick(PALETTE.skin, `${account.id}#skin`),
      hair: pick(PALETTE.hair, `${account.id}#hair`),
      hairStyle: pick(PALETTE.hairStyle, `${account.id}#style`),
      shirt: pick(PALETTE.shirt, `${account.id}#shirt`),
    },
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

export function slotId(doctorId: string, date: string, time: string): string {
  return `${doctorId}-${date}-${time.replace(":", "")}`;
}

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
 * Generate every slot in the window. Deterministic: the same date always yields the
 * same schedule, so server and browser agree and a reload never reshuffles times.
 */
export function generateSlots(window: BookWindow): Slot[] {
  const slots: Slot[] = [];
  for (const doctor of allDoctors()) {
    const template = templates[doctor.id] ?? STAFF_TEMPLATE;
    for (let offset = 0; offset < WEEKS_OPEN * 7; offset += 1) {
      const date = addDays(window.firstWeek, offset);
      const weekday = weekdayIndex(date) as 1 | 2 | 3 | 4 | 5;
      for (const time of template.sessions[weekday] ?? []) {
        const id = slotId(doctor.id, date, time);
        const slot: Slot = { id, doctorId: doctor.id, date, time };
        if (template.teaching && unitHash(`${id}#teach`) < template.teaching) slot.teaching = true;
        else if (unitHash(id) < template.busy) slot.taken = true;
        slots.push(slot);
      }
    }
  }
  return slots;
}
