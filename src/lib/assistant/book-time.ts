/**
 * Booking and moving by what the patient actually says: "11 with kavya", "1120", "11.20",
 * "2 pm", "प्लीज बुक ११:२० स्लॉट". One tool call finds the doctor, the day and the open time
 * on the server and prepares the usual confirmation card, so the model never has to chain a
 * doctor search, an availability read and a booking call (which used to run out of steps).
 * Nothing is booked or moved here: proposeBook / proposeReschedule only seal a confirmation.
 */
import type { PublicUser } from "../clinic-types";
import { now, todayIso } from "../clock";
import { allDoctors, isListed, reasons, type Slot } from "../data";
import { getSlots } from "../repository";
import { openTimesFor } from "../reschedule";
import { openSlots, slotStart } from "../schedule";
import { getStore } from "../store";
import { visitsFor } from "../visits";
import { proposeBook, proposeReschedule } from "./act";
import type { PendingCard } from "./confirm-token";
import { resolveDay } from "./read";

/** Zero of each decimal digit block a patient may type in (Latin, Arabic-Indic, Indic scripts). */
const DIGIT_ZEROS = [0x30, 0x660, 0x6f0, 0x966, 0x9e6, 0xa66, 0xae6, 0xb66, 0xbe6, 0xc66, 0xce6, 0xd66];

/** Any script's digits as 0-9, so "११:२०" reads like "11:20". */
export function asciiDigits(text: string): string {
  let out = "";
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    const zero = DIGIT_ZEROS.find((start) => code >= start && code <= start + 9);
    out += zero === undefined ? char : String(code - zero);
  }
  return out;
}

export interface WantedTime {
  hour: number;
  minute: number;
  /** True when am/pm (or a 24-hour hour) settles the hour; otherwise 2 may mean 14:00. */
  fixed: boolean;
}

/** "11", "11:00", "1120", "11.20", "11 20", "11am", "2:30 pm", "14:00", "11 बजे". Null when there is no time. */
export function parseTime(raw: string): WantedTime | null {
  const text = asciiDigits(raw).toLowerCase();
  const pm = /\d\s*(pm|p\.m\.)(?![a-z])|\bevening|\bafternoon|शाम|दोपहर/.test(text);
  const am = /\d\s*(am|a\.m\.)(?![a-z])|\bmorning|सुबह/.test(text);
  let hour: number;
  let minute = 0;
  const separated = /(\d{1,2})\s*[:.h\s]\s*(\d{2})(?!\d)/.exec(text);
  const compact = /(?<!\d)(\d{3,4})(?!\d)/.exec(text);
  const bare = /(?<!\d)(\d{1,2})(?!\d)/.exec(text);
  if (separated) {
    hour = Number(separated[1]);
    minute = Number(separated[2]);
  } else if (compact) {
    const digits = compact[1]!;
    hour = Number(digits.slice(0, digits.length - 2));
    minute = Number(digits.slice(-2));
  } else if (bare) {
    hour = Number(bare[1]);
  } else {
    return null;
  }
  if (minute > 59 || hour > 23) return null;
  if (pm && hour < 12) return { hour: hour + 12, minute, fixed: true };
  if (am && hour === 12) return { hour: 0, minute, fixed: true };
  return { hour, minute, fixed: am || pm || hour === 0 || hour >= 13 };
}

function hhmm(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** The clock times a wanted time can mean: 2 is 02:00 or 14:00 unless am/pm says which. */
export function candidateTimes(wanted: WantedTime): string[] {
  if (wanted.fixed || wanted.hour >= 12) return [hhmm(wanted.hour, wanted.minute)];
  return [hhmm(wanted.hour, wanted.minute), hhmm(wanted.hour + 12, wanted.minute)];
}

function words(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\bdr\.?\b|\bdoctor\b/g, " ")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 1);
}

/** Listed doctors whose name matches what was said: "kavya", "dr reddy", "Kavya Reddy", an id. */
export function matchDoctors(query: string): { id: string; name: string }[] {
  const listed = allDoctors().filter((doctor) => isListed(doctor.id));
  const exactId = listed.find((doctor) => doctor.id === query.trim());
  if (exactId) return [{ id: exactId.id, name: exactId.name }];
  const said = words(query);
  if (!said.length) return [];
  const scored = listed
    .map((doctor) => {
      const name = words(doctor.name);
      let score = 0;
      for (const word of said) {
        if (name.includes(word)) score += 3;
        else if (word.length >= 3 && name.some((part) => part.startsWith(word) || word.startsWith(part))) score += 1;
      }
      return { id: doctor.id, name: doctor.name, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
  const best = scored[0]?.score ?? 0;
  return scored.filter((item) => item.score === best).map(({ id, name }) => ({ id, name }));
}

function brief(slot: Slot, doctor: string) {
  return { id: slot.id, doctorId: slot.doctorId, doctor, date: slot.date, time: slot.time, endTime: slot.endTime ?? null, mode: slot.mode ?? "stream" };
}

/** The open slot for the wanted time: on the date if given, else the soonest day it is open. */
function pickSlot(open: readonly Slot[], times: readonly string[], date: string | null): Slot | null {
  const fits = open.filter((slot) => times.includes(slot.time) && (!date || slot.date === date));
  return fits[0] ?? null;
}

/** Up to four open times closest to what was asked, to offer instead. */
function nearest(open: readonly Slot[], times: readonly string[], date: string | null): Slot[] {
  const target = Number(times[0]!.slice(0, 2)) * 60 + Number(times[0]!.slice(3));
  const sameDay = date ? open.filter((slot) => slot.date === date) : open;
  const pool = sameDay.length ? sameDay : open;
  return [...pool]
    .sort((a, b) => {
      const da = Math.abs(Number(a.time.slice(0, 2)) * 60 + Number(a.time.slice(3)) - target);
      const db = Math.abs(Number(b.time.slice(0, 2)) * 60 + Number(b.time.slice(3)) - target);
      return a.date === b.date ? da - db : a.date.localeCompare(b.date);
    })
    .slice(0, 4);
}

type Proposal = { forModel: unknown; pending?: PendingCard };

function ask(question: string, extra: Record<string, unknown> = {}): Proposal {
  return { forModel: { needsAnswer: true, question, instruction: "Ask the user this one question in their language. Nothing has been booked.", ...extra } };
}

export interface BookTimeArgs {
  doctor: string;
  date: string;
  time: string;
  reasonId: string;
  payOnline: boolean;
  note: string;
}

/** "Book 11 with kavya tomorrow": find the doctor and the open time, then prepare the booking card. */
export async function bookTime(user: PublicUser, args: BookTimeArgs): Promise<Proposal> {
  if (user.role !== "patient") return { forModel: { error: "Only a patient can book." } };
  const wanted = parseTime(args.time);
  if (!wanted) return ask("What time would you like?");
  const times = candidateTimes(wanted);
  let date: string | null = null;
  if (args.date.trim()) {
    const day = resolveDay(args.date);
    if (typeof day !== "string") return ask("Which day would you like? For example tomorrow, or a date like 2026-11-20.");
    date = day;
  }
  const all = openSlots(await getSlots(), [], now()).filter((slot) => isListed(slot.doctorId));
  let doctors = args.doctor.trim() ? matchDoctors(args.doctor) : [];
  if (args.doctor.trim() && doctors.length === 0) {
    return ask(`I couldn't find a doctor called "${args.doctor.trim()}". Which doctor would you like?`);
  }
  if (!args.doctor.trim()) {
    // No doctor named: fine when exactly one doctor has that time open.
    const ids = [...new Set(all.filter((slot) => times.includes(slot.time) && (!date || slot.date === date)).map((slot) => slot.doctorId))];
    const named = allDoctors().filter((doctor) => ids.includes(doctor.id)).map((doctor) => ({ id: doctor.id, name: doctor.name }));
    if (named.length !== 1) {
      return ask(named.length ? `Which doctor would you like at ${times[0]}?` : "Which doctor would you like?", named.length ? { doctorsWithThatTime: named.map((doctor) => doctor.name) } : {});
    }
    doctors = named;
  }
  if (doctors.length > 1) {
    return ask(`Which doctor do you mean: ${doctors.map((doctor) => doctor.name).join(" or ")}?`);
  }
  const doctor = doctors[0]!;
  const open = all.filter((slot) => slot.doctorId === doctor.id);
  // "11" with no day: today if it's still open, else the soonest day it is.
  const slot = pickSlot(open, times, date);
  if (!slot) {
    const instead = nearest(open, times, date);
    return {
      forModel: {
        available: false,
        doctor: doctor.name,
        requested: { date, time: times[0] },
        alternatives: instead.map((item) => brief(item, doctor.name)),
        instruction: instead.length
          ? "That time isn't open. Say so in one sentence and ask which of the alternatives they want (the app lists them). Nothing has been booked."
          : "This doctor has no open time in the bookable window. Say so and suggest another doctor. Nothing has been booked.",
      },
    };
  }
  const reasonId = reasons.some((reason) => reason.id === args.reasonId) ? args.reasonId : "new";
  return proposeBook(user, slot.id, reasonId, args.payOnline, args.note);
}

/** "Move my visit to 11:20 tomorrow": the patient's upcoming visit (by reference or doctor if several). */
export async function moveToTime(user: PublicUser, args: { visit: string; date: string; time: string }): Promise<Proposal> {
  if (user.role !== "patient") return { forModel: { error: "Use propose_reschedule with a visit id." } };
  const wanted = parseTime(args.time);
  if (!wanted) return ask("What time should the visit move to?");
  const times = candidateTimes(wanted);
  const instant = now();
  const store = await getStore();
  const upcoming = (await visitsFor(user)).filter(
    (visit) => (visit.status === "booked" || visit.status === "pending_payment") && slotStart(visit).getTime() > instant.getTime(),
  );
  const key = args.visit.trim().toLowerCase();
  let chosen = upcoming;
  if (key) {
    chosen = upcoming.filter((visit) => visit.id === args.visit.trim() || visit.reference.toLowerCase() === key);
    if (!chosen.length) {
      const named = new Set(matchDoctors(args.visit).map((doctor) => doctor.id));
      chosen = upcoming.filter((visit) => named.has(visit.doctorId));
    }
  }
  if (!chosen.length) return ask(upcoming.length ? "Which visit should I move?" : "You have no upcoming visit to move.");
  if (chosen.length > 1) return ask(`Which visit should I move: ${chosen.slice(0, 4).map((visit) => `${visit.reference} on ${visit.date} at ${visit.time}`).join(", ")}?`);
  const visit = (await store.getAppointment(chosen[0]!.id)) ?? chosen[0]!;
  let date: string | null = null;
  if (args.date.trim()) {
    const day = resolveDay(args.date, todayIso(instant));
    if (typeof day !== "string") return ask("Which day should it move to?");
    date = day;
  } else {
    date = visit.date >= todayIso(instant) ? visit.date : null;
  }
  const open = await openTimesFor(visit);
  const slot = pickSlot(open, times, date) ?? (args.date.trim() ? null : pickSlot(open, times, null));
  if (!slot) {
    const doctor = allDoctors().find((item) => item.id === visit.doctorId)?.name ?? "Doctor";
    return {
      forModel: {
        available: false,
        requested: { date, time: times[0] },
        alternatives: nearest(open, times, date).map((item) => brief(item, doctor)),
        instruction: "That time isn't open with this doctor. Ask which alternative they want. Nothing has been moved.",
      },
    };
  }
  return proposeReschedule(user, visit.id, slot.id, "");
}
