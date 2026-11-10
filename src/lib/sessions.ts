import type { ConsultSession, SessionMode, SessionTrim } from "./clinic-types";
import { addDays, weekdayIndex } from "./clock";
import type { Slot } from "./data";

/**
 * Consulting sessions and the two ways a session can be booked.
 *
 * STREAM: the session is cut into fixed slots (10, 15, 20 or 30 minutes). Each slot takes one
 * patient, at that time. The slot id is `<doctor>-<date>-<HHMM>`.
 *
 * WAVE: the whole session is one wave that takes up to N patients (older sessions may still carry a
 * wave length and are cut into several waves, so their existing bookings keep working).
 * Patients are told the wave, not a minute, and are seen in token order. The wave id is
 * `w-<session>-<date>-<HHMM>`; each booking holds `<wave id>#<token>`, so the database's
 * one-booking-per-held-slot index also stops two patients sharing a token.
 *
 * Everything here is pure, so the server and the tests share it. No runtime import of data.ts
 * (it imports this file).
 */

export const STREAM_SLOT_MINUTES = [10, 15, 20, 30] as const;
export const WAVE_MINUTES = [15, 20, 30, 45, 60, 90] as const;
export const MAX_WAVE_CAPACITY = 20;
export const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
export const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isTime(value: string): boolean {
  return TIME.test(value);
}

export function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

export function fromMinutes(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function slotId(doctorId: string, date: string, time: string): string {
  return `${doctorId}-${date}-${time.replace(":", "")}`;
}

export function waveSlotId(sessionId: string, date: string, time: string): string {
  return `w-${sessionId}-${date}-${time.replace(":", "")}`;
}

/** What a wave booking holds: the wave plus the patient's token. */
export function heldId(waveId: string, token: number): string {
  return `${waveId}#${token}`;
}

/** The slot or wave a held id belongs to. */
export function baseSlotId(held: string): string {
  const at = held.indexOf("#");
  return at === -1 ? held : held.slice(0, at);
}

export function tokenOfHeld(held: string): number | null {
  const at = held.indexOf("#");
  if (at === -1) return null;
  const token = Number(held.slice(at + 1));
  return Number.isInteger(token) && token > 0 ? token : null;
}

export function isWaveId(id: string): boolean {
  return id.startsWith("w-");
}

const ISO_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function isIsoDate(value: string | null | undefined): value is string {
  return typeof value === "string" && ISO_DATE.test(value) && addDays(value, 0) === value;
}

type Dated = Pick<ConsultSession, "weekdays"> & Partial<Pick<ConsultSession, "startDate" | "endDate" | "onDate">>;

/** Is this a one-off session (one specific date) rather than a weekly pattern? */
export function isOneOff(session: Dated): boolean {
  return Boolean(session.onDate);
}

/**
 * Does the session run on this clinic (IST) date? One-off: only its date. Recurring: a chosen
 * weekday that falls inside the optional start/end dates.
 */
export function sessionRunsOn(session: Dated, date: string): boolean {
  if (session.onDate) return session.onDate === date;
  if (!session.weekdays.includes(weekdayIndex(date))) return false;
  if (session.startDate && date < session.startDate) return false;
  if (session.endDate && date > session.endDate) return false;
  return true;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Fri 6 Nov 2026". */
export function shortDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return `${DAY_SHORT[weekdayIndex(iso)]} ${day} ${MONTHS[(month ?? 1) - 1]} ${year}`;
}

/** "Mon, Tue and Thu", "Mon–Fri from 1 Dec 2026 to 31 Jan 2027" or "Fri 6 Nov 2026 only". */
export function daysLabel(session: Dated): string {
  if (session.onDate) return `${shortDate(session.onDate)} only`;
  const days = weekdaysLabel(session.weekdays);
  if (session.startDate && session.endDate) return `${days}, ${shortDate(session.startDate)} to ${shortDate(session.endDate)}`;
  if (session.startDate) return `${days}, from ${shortDate(session.startDate)}`;
  if (session.endDate) return `${days}, until ${shortDate(session.endDate)}`;
  return days;
}

export interface Block {
  time: string;
  endTime: string;
}

/**
 * The step of a session in minutes: the slot length for a stream. For a wave, the whole session,
 * unless an older session still has a wave length saved (then it keeps its sub-waves).
 */
export function stepMinutes(session: Pick<ConsultSession, "mode" | "slotMinutes" | "waveMinutes"> & Partial<Pick<ConsultSession, "startTime" | "endTime">>): number {
  if (session.mode === "stream") return session.slotMinutes ?? 0;
  if (session.waveMinutes) return session.waveMinutes;
  if (!session.startTime || !session.endTime || !isTime(session.startTime) || !isTime(session.endTime)) return 0;
  return toMinutes(session.endTime) - toMinutes(session.startTime);
}

/** Live one-off sessions win over weekly ones: the dates on which a doctor's weekly sessions step aside. */
export function overriddenDates(sessions: readonly (Dated & Pick<ConsultSession, "archivedAt">)[]): Set<string> {
  return new Set(sessions.filter((session) => !session.archivedAt && session.onDate).map((session) => session.onDate!));
}

/** Does this session actually run on the date, once one-off sessions have replaced weekly ones? */
export function sessionShownOn(session: Dated, date: string, overridden: ReadonlySet<string>): boolean {
  if (!sessionRunsOn(session, date)) return false;
  return Boolean(session.onDate) || !overridden.has(date);
}

export interface CalendarEntry {
  session: ConsultSession;
  /** A weekly session replaced that day by a one-off session. */
  replaced: boolean;
}

/** For each date from `first` to `last`, the doctor's live sessions that fall on it (replaced ones flagged). */
export function sessionCalendar(sessions: readonly ConsultSession[], first: string, last: string): Map<string, CalendarEntry[]> {
  const live = sessions.filter((session) => !session.archivedAt);
  const overridden = overriddenDates(live);
  const days = new Map<string, CalendarEntry[]>();
  for (let date = first; date <= last; date = addDays(date, 1)) {
    const entries = live
      .filter((session) => sessionRunsOn(session, date))
      .map((session) => ({ session, replaced: !session.onDate && overridden.has(date) }))
      .sort((a, b) => a.session.startTime.localeCompare(b.session.startTime));
    if (entries.length) days.set(date, entries);
  }
  return days;
}

/** Inclusive hour window that covers the given times, never narrower than floor–ceil (clinic day defaults). */
export function weekHourBounds(
  times: readonly { startTime: string; endTime: string }[],
  floor = 8,
  ceil = 17,
): { startHour: number; endHour: number } {
  let startHour = floor;
  let endHour = ceil;
  for (const { startTime, endTime } of times) {
    if (!isTime(startTime) || !isTime(endTime) || startTime >= endTime) continue;
    startHour = Math.min(startHour, Math.floor(toMinutes(startTime) / 60));
    endHour = Math.max(endHour, Math.ceil(toMinutes(endTime) / 60));
  }
  if (endHour <= startHour) endHour = startHour + 1;
  return { startHour, endHour };
}

/** True when start/end look like intentional clinic hours (not empty or 00:00–00:00). */
export function timesLookSet(startTime: string, endTime: string): boolean {
  if (!isTime(startTime) || !isTime(endTime) || startTime >= endTime) return false;
  if (startTime === "00:00" && toMinutes(endTime) - toMinutes(startTime) >= 12 * 60) return false;
  return true;
}

/**
 * First clinic date on or after `from` that the session runs (within optional start/end or
 * `limitDays` ahead). Null if it never runs in that window.
 */
export function firstRunDate(session: Dated, from: string, limitDays = 120): string | null {
  if (session.onDate) return session.onDate >= from ? session.onDate : null;
  if (!session.weekdays.length) return null;
  const start = session.startDate && session.startDate > from ? session.startDate : from;
  const last = session.endDate ?? addDays(start, limitDays);
  if (last < start) return null;
  for (let date = start; date <= last; date = addDays(date, 1)) {
    if (sessionRunsOn(session, date)) return date;
  }
  return null;
}

/** "2–8 Nov 2026" / "28 Nov – 4 Dec 2026" for a Monday ISO date. */
export function weekRangeTitle(monday: string): string {
  const sunday = addDays(monday, 6);
  const start = new Date(`${monday}T00:00:00Z`);
  const end = new Date(`${sunday}T00:00:00Z`);
  const sameMonth = start.getUTCMonth() === end.getUTCMonth();
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const day = (d: Date) => d.getUTCDate();
  const month = (d: Date) => d.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
  const year = (d: Date) => d.getUTCFullYear();
  if (sameMonth && sameYear) return `${day(start)}–${day(end)} ${month(start)} ${year(end)}`;
  if (sameYear) return `${day(start)} ${month(start)} – ${day(end)} ${month(end)} ${year(end)}`;
  return `${day(start)} ${month(start)} ${year(start)} – ${day(end)} ${month(end)} ${year(end)}`;
}

/** The slots (stream) or waves (wave) one day of the session is cut into. */
export function sessionBlocks(
  session: Pick<ConsultSession, "mode" | "startTime" | "endTime" | "slotMinutes" | "waveMinutes">,
): Block[] {
  const step = stepMinutes(session);
  if (step <= 0 || !isTime(session.startTime) || !isTime(session.endTime)) return [];
  const blocks: Block[] = [];
  const end = toMinutes(session.endTime);
  for (let at = toMinutes(session.startTime); at + step <= end; at += step) {
    blocks.push({ time: fromMinutes(at), endTime: fromMinutes(at + step) });
  }
  return blocks;
}

/** How far ahead a save records an explicit free-edge cut. Later dates follow the same cut. */
export const ABSORPTION_HORIZON_DAYS = 400;

/** A visit that still occupies the doctor's time. Patient names stay out of this. */
export interface OccupyingVisit {
  date: string;
  time: string;
  endTime?: string | null;
  sessionId?: string | null;
}

export type AbsorptionPlan =
  | { ok: true; trims: SessionTrim[]; notice: string | null }
  | { ok: false; message: string };

function minutesOverlap(start: number, end: number, otherStart: number, otherEnd: number): boolean {
  return start < otherEnd && otherStart < end;
}

function blockCovered(block: Block, trims: readonly SessionTrim[]): boolean {
  return trims.some((trim) => minutesOverlap(toMinutes(block.time), toMinutes(block.endTime), toMinutes(trim.startTime), toMinutes(trim.endTime)));
}

/**
 * Cuts that apply to `sessionId` on `date`. With a roster, one saved cut stands for every later
 * date on which the absorbing session still runs and still covers that clock interval.
 */
export function trimsCovering(sessionId: string, date: string, trims: readonly SessionTrim[], roster: readonly ConsultSession[] = []): SessionTrim[] {
  if (roster.length === 0) return trims.filter((trim) => trim.sessionId === sessionId && trim.date === date);
  const overridden = overriddenDates(roster);
  const neighbour = roster.find((session) => session.id === sessionId);
  if (neighbour && !sessionShownOn(neighbour, date, overridden)) return [];
  const applied: SessionTrim[] = [];
  const seen = new Set<string>();
  for (const trim of trims) {
    if (trim.sessionId !== sessionId) continue;
    const key = `${trim.absorbedBy}|${trim.startTime}|${trim.endTime}`;
    if (seen.has(key)) continue;
    const absorber = roster.find((session) => session.id === trim.absorbedBy);
    if (!absorber || absorber.archivedAt) continue;
    if (!sessionShownOn(absorber, date, overridden)) continue;
    if (toMinutes(absorber.startTime) > toMinutes(trim.startTime) || toMinutes(absorber.endTime) < toMinutes(trim.endTime)) continue;
    seen.add(key);
    applied.push({ ...trim, date });
  }
  return applied;
}

/** Hours a session still offers on one date after free-edge cuts. Null when it offers nothing that day. */
export function hoursOnDate(
  session: ConsultSession,
  date: string,
  trims: readonly SessionTrim[],
  roster: readonly ConsultSession[] = [],
): { startTime: string; endTime: string } | null {
  const overridden = overriddenDates(roster.length ? roster : [session]);
  if (!sessionShownOn(session, date, overridden)) return null;
  const blocks = sessionBlocks(session).filter((block) => !blockCovered(block, trimsCovering(session.id, date, trims, roster)));
  const first = blocks[0];
  const last = blocks[blocks.length - 1];
  if (!first || !last) return null;
  return { startTime: first.time, endTime: last.endTime };
}

/** Every slot or wave of one session from `firstDate` up to and including `lastDate`. */
export function slotsForSession(
  session: ConsultSession,
  doctorId: string,
  firstDate: string,
  lastDate: string,
  overridden: ReadonlySet<string> = new Set(),
  trims: readonly SessionTrim[] = [],
  roster: readonly ConsultSession[] = [],
): Slot[] {
  if (session.archivedAt) return [];
  const blocks = sessionBlocks(session);
  const slots: Slot[] = [];
  for (let date = firstDate; date <= lastDate; date = addDays(date, 1)) {
    if (!sessionShownOn(session, date, overridden)) continue;
    const covered = trimsCovering(session.id, date, trims, roster);
    for (const block of blocks) {
      if (blockCovered(block, covered)) continue;
      if (session.mode === "wave") {
        slots.push({
          id: waveSlotId(session.id, date, block.time),
          doctorId,
          date,
          time: block.time,
          endTime: block.endTime,
          mode: "wave",
          capacity: session.waveCapacity ?? 1,
          booked: 0,
          sessionId: session.id,
          room: session.room,
        });
      } else {
        slots.push({
          id: slotId(doctorId, date, block.time),
          doctorId,
          date,
          time: block.time,
          endTime: block.endTime,
          mode: "stream",
          sessionId: session.id,
          room: session.room,
        });
      }
    }
  }
  return slots;
}

/**
 * Mark which slots are taken and how full each wave is, given the ids that bookings hold.
 * A stream slot is taken when its id is held. A wave is full when it holds `capacity` tokens.
 */
export function applyHeld(slots: readonly Slot[], heldIds: readonly string[]): Slot[] {
  const stream = new Set<string>();
  const waves = new Map<string, number>();
  for (const held of heldIds) {
    if (held.includes("#")) {
      const base = baseSlotId(held);
      waves.set(base, (waves.get(base) ?? 0) + 1);
    } else stream.add(held);
  }
  return slots.map((slot) => {
    if (slot.mode === "wave") {
      const booked = waves.get(slot.id) ?? 0;
      const capacity = slot.capacity ?? 1;
      if (booked === (slot.booked ?? 0) && (booked >= capacity) === Boolean(slot.taken)) return slot;
      return { ...slot, booked, taken: booked >= capacity };
    }
    return stream.has(slot.id) && !slot.taken ? { ...slot, taken: true } : slot;
  });
}

export function remainingPlaces(slot: Pick<Slot, "capacity" | "booked">): number {
  return Math.max(0, (slot.capacity ?? 1) - (slot.booked ?? 0));
}

/** The lowest token of a wave that no booking holds, or null when the wave is full. */
export function freeToken(waveId: string, capacity: number, heldIds: readonly string[]): number | null {
  const used = new Set<number>();
  for (const held of heldIds) {
    if (baseSlotId(held) !== waveId) continue;
    const token = tokenOfHeld(held);
    if (token !== null) used.add(token);
  }
  for (let token = 1; token <= capacity; token += 1) if (!used.has(token)) return token;
  return null;
}

/** "Mon–Fri", "Tue, Thu" or "Mon–Wed, Fri". */
export function weekdaysLabel(weekdays: readonly number[], long = false): string {
  const days = [...new Set(weekdays)].filter((day) => day >= 1 && day <= 6).sort((a, b) => a - b);
  if (days.length === 0) return "No days";
  const names = long ? WEEKDAY_NAMES : WEEKDAY_SHORT;
  const runs: number[][] = [];
  for (const day of days) {
    const last = runs[runs.length - 1];
    if (last && last[last.length - 1] === day - 1) last.push(day);
    else runs.push([day]);
  }
  const parts = runs.map((run) => {
    const first = names[run[0]! - 1];
    const last = names[run[run.length - 1]! - 1];
    if (run.length === 1) return first;
    if (run.length === 2) return `${first} and ${last}`;
    return long ? `${first} to ${last}` : `${first}–${last}`;
  });
  if (parts.length === 1) return parts[0] ?? "";
  return long ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts.join(", ");
}

/** One line describing how a session is booked. */
export function modeSummary(session: Pick<ConsultSession, "mode" | "slotMinutes" | "waveMinutes" | "waveCapacity">): string {
  if (session.mode === "stream") return `${session.slotMinutes}-minute slots, one patient each`;
  const places = session.waveCapacity ?? 1;
  const who = `up to ${places} patient${places === 1 ? "" : "s"}`;
  return session.waveMinutes ? `${session.waveMinutes}-minute waves, ${who} each` : `one wave, ${who}, seen in token order`;
}

export function describeSession(session: ConsultSession): string {
  return `${daysLabel(session)} · ${session.startTime}–${session.endTime} · ${modeSummary(session)}`;
}

export interface SessionInput {
  label: string;
  /** "recurring" (weekly, from a start date to an end date) or "once" (one date). Missing means recurring. */
  kind?: string;
  onDate?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  weekdays: readonly number[];
  startTime: string;
  endTime: string;
  room: string;
  mode: string;
  slotMinutes?: number | null;
  waveMinutes?: number | null;
  waveCapacity?: number | null;
}

export type SessionCheck =
  | {
      ok: true;
      value: Pick<
        ConsultSession,
        "label" | "weekdays" | "startTime" | "endTime" | "room" | "mode" | "slotMinutes" | "waveMinutes" | "waveCapacity"
      > & { startDate: string | null; endDate: string | null; onDate: string | null };
    }
  | { ok: false; message: string };

function allowed(list: readonly number[], value: number | null | undefined): value is number {
  return typeof value === "number" && list.includes(value);
}

type Overlapping = Dated & Pick<ConsultSession, "startTime" | "endTime">;

/** Could two sessions ever run on the same date? */
function shareADate(a: Dated, b: Dated): boolean {
  if (a.onDate && b.onDate) return a.onDate === b.onDate;
  // A one-off session replaces the weekly ones on its date, so the two never run together.
  if (a.onDate || b.onDate) return false;
  if (!a.weekdays.some((day) => b.weekdays.includes(day))) return false;
  const start = [a.startDate, b.startDate].filter(Boolean).sort().pop();
  const ends = [a.endDate, b.endDate].filter(Boolean).sort();
  return !(start && ends[0] && start > ends[0]);
}

/** Do two sessions share a date and any minute of the day? */
export function sessionsOverlap(a: Overlapping, b: Overlapping): boolean {
  if (!shareADate(a, b)) return false;
  return toMinutes(a.startTime) < toMinutes(b.endTime) && toMinutes(b.startTime) < toMinutes(a.endTime);
}

interface ClockRun {
  start: number;
  end: number;
  blocks: Block[];
}

function contiguousRuns(blocks: readonly Block[]): ClockRun[] {
  const runs: ClockRun[] = [];
  for (const block of blocks) {
    const start = toMinutes(block.time);
    const end = toMinutes(block.endTime);
    const last = runs[runs.length - 1];
    if (last && last.end === start) {
      last.end = end;
      last.blocks.push(block);
    } else runs.push({ start, end, blocks: [block] });
  }
  return runs;
}

function visitEnd(visit: OccupyingVisit): number {
  return visit.endTime && isTime(visit.endTime) ? toMinutes(visit.endTime) : 23 * 60 + 59;
}

function visitBlocks(visit: OccupyingVisit, date: string, start: number, end: number, candidateId: string): boolean {
  if (visit.sessionId === candidateId) return false;
  if (visit.date !== date || !isTime(visit.time)) return false;
  return minutesOverlap(start, end, toMinutes(visit.time), visitEnd(visit));
}

function neighbourTitle(session: ConsultSession): string {
  const when = session.onDate
    ? `${shortDate(session.onDate)} ${session.startTime}–${session.endTime}`
    : `${weekdaysLabel(session.weekdays)} ${session.startTime}–${session.endTime}`;
  return session.label ? `${session.label} (${when})` : when;
}

function datesPhrase(dates: readonly string[], openEnded: boolean): string {
  if (dates.length === 0) return "those days";
  if (dates.length === 1) return shortDate(dates[0]!);
  if (dates.length <= 4) {
    const labels = dates.map((date) => shortDate(date));
    return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
  }
  if (openEnded) return "the days both sessions run";
  return `the days both sessions run, through ${shortDate(dates[dates.length - 1]!)}`;
}

function absorptionNotice(candidate: ConsultSession, others: readonly ConsultSession[], trims: readonly SessionTrim[]): string | null {
  if (trims.length === 0) return null;
  const groups = new Map<string, SessionTrim[]>();
  for (const trim of trims) {
    const key = `${trim.sessionId}|${trim.startTime}|${trim.endTime}`;
    const list = groups.get(key) ?? [];
    list.push(trim);
    groups.set(key, list);
  }
  const openEnded = !candidate.onDate && !candidate.endDate;
  const parts: string[] = [];
  for (const rows of groups.values()) {
    const sample = rows[0]!;
    const neighbour = others.find((session) => session.id === sample.sessionId);
    const name = neighbour ? neighbourTitle(neighbour) : "other";
    const when = datesPhrase([...new Set(rows.map((row) => row.date))].sort(), openEnded);
    const whole = Boolean(neighbour && sample.startTime === neighbour.startTime && sample.endTime === neighbour.endTime);
    if (whole || !neighbour) {
      parts.push(`This takes the free ${sample.startTime}–${sample.endTime} of your ${name} session on ${when}. That session keeps its patients. Nothing is cancelled.`);
    } else if (neighbour && sample.startTime === neighbour.startTime) {
      parts.push(`This takes the free start of your ${name} session on ${when}. That session keeps its patients and starts at ${sample.endTime} on those days. Nothing is cancelled.`);
    } else {
      parts.push(`This takes the free end of your ${name} session on ${when}. That session keeps its patients and ends at ${sample.startTime} on those days. Nothing is cancelled.`);
    }
  }
  return parts.join(" ");
}

interface EdgeLimit {
  edge: "end" | "start";
  safe: string;
  date: string;
  time: string;
}

function stricterLimit(current: EdgeLimit | null, next: EdgeLimit): EdgeLimit {
  if (!current || current.edge !== next.edge) return next;
  if (next.edge === "end") return next.safe < current.safe ? next : current;
  return next.safe > current.safe ? next : current;
}

/**
 * Let one session grow into the free edge of another. Booked patients stay where they are.
 * A free wave place is not spare clock time: a wave yields a date only when nobody is in it,
 * and only as a whole block. Stream slots are taken in order from the shared edge.
 */
export function planAbsorption(
  candidate: ConsultSession,
  others: readonly ConsultSession[],
  visits: readonly OccupyingVisit[],
  today: string,
  existing: readonly SessionTrim[] = [],
  horizonDays = ABSORPTION_HORIZON_DAYS,
): AbsorptionPlan {
  if (!isTime(candidate.startTime) || !isTime(candidate.endTime) || candidate.startTime >= candidate.endTime) {
    return { ok: false, message: "Enter the start and end time as HH:MM." };
  }
  const roster = [candidate, ...others];
  const overridden = overriddenDates(roster);
  const foreign = existing.filter((trim) => trim.absorbedBy !== candidate.id);
  const trims: SessionTrim[] = [];
  const cap = addDays(today, horizonDays);

  for (const neighbour of others) {
    if (neighbour.archivedAt || neighbour.id === candidate.id) continue;
    let first = today;
    for (const start of [candidate.startDate, neighbour.startDate, candidate.onDate, neighbour.onDate]) {
      if (start && start > first) first = start;
    }
    let last = cap;
    for (const end of [candidate.endDate, neighbour.endDate, candidate.onDate, neighbour.onDate]) {
      if (end && end < last) last = end;
    }
    if (first > last) continue;
    let limit: EdgeLimit | null = null;
    const wholeWave = neighbour.mode === "wave" && !neighbour.waveMinutes;

    for (let date = first; date <= last; date = addDays(date, 1)) {
      if (!sessionShownOn(candidate, date, overridden) || !sessionShownOn(neighbour, date, overridden)) continue;
      const covered = trimsCovering(neighbour.id, date, foreign, roster);
      const remaining = sessionBlocks(neighbour).filter((block) => !blockCovered(block, covered));
      for (const run of contiguousRuns(remaining)) {
        const start = Math.max(toMinutes(candidate.startTime), run.start);
        const end = Math.min(toMinutes(candidate.endTime), run.end);
        if (start >= end) continue;
        const touchesStart = start === run.start;
        const touchesEnd = end === run.end;
        if (!touchesStart && !touchesEnd) {
          return { ok: false, message: `That sits in the middle of your ${neighbourTitle(neighbour)} session. Shorten one side so they meet at an edge.` };
        }
        const involved = run.blocks.filter((block) => minutesOverlap(start, end, toMinutes(block.time), toMinutes(block.endTime)));
        for (const block of involved) {
          const blockStart = toMinutes(block.time);
          const blockEnd = toMinutes(block.endTime);
          if (blockStart < start) {
            return { ok: false, message: `Start this session at ${block.endTime} so you don't cut a slot of the other session (${block.time}–${block.endTime}).` };
          }
          if (blockEnd > end) {
            return { ok: false, message: `End this session at ${block.time} so you don't cut a slot of the other session (${block.time}–${block.endTime}).` };
          }
        }
        const busy = (block: Block) => visits.some((visit) => visitBlocks(visit, date, toMinutes(block.time), toMinutes(block.endTime), candidate.id));
        if (wholeWave && involved.some(busy)) {
          const count = visits.filter((visit) => (!visit.sessionId || visit.sessionId === neighbour.id) && visitBlocks(visit, date, run.start, run.end, candidate.id)).length;
          if (count > 0) {
            const patients = `${count} patient${count === 1 ? "" : "s"}`;
            return {
              ok: false,
              message: `The ${neighbour.startTime}–${neighbour.endTime} wave on ${shortDate(date)} still has ${patients}. Free places are extra patients in that wave, not spare time. Move or cancel those visits to use this time.`,
            };
          }
        }
        const ordered = touchesStart ? involved : [...involved].reverse();
        let blocked = false;
        for (const block of ordered) {
          if (!busy(block)) continue;
          blocked = true;
          limit = stricterLimit(limit, touchesStart
            ? { edge: "end", safe: block.time, date, time: block.time }
            : { edge: "start", safe: block.endTime, date, time: block.time });
          break;
        }
        if (!blocked) {
          trims.push({
            sessionId: neighbour.id,
            date,
            startTime: fromMinutes(start),
            endTime: fromMinutes(end),
            absorbedBy: candidate.id,
          });
        }
      }
    }
    if (limit) {
      const when = `${shortDate(limit.date)} at ${limit.time}`;
      const reach = limit.edge === "end" ? `You can extend to ${limit.safe}.` : `You can start at ${limit.safe}.`;
      return { ok: false, message: `${reach} ${when} is already booked in the other session. That visit stays. Move or cancel it if you need to go further.` };
    }
  }
  const unique = new Map<string, SessionTrim>();
  for (const trim of trims) unique.set(`${trim.sessionId}|${trim.date}|${trim.startTime}|${trim.absorbedBy}`, trim);
  const saved = [...unique.values()];
  return { ok: true, trims: saved, notice: absorptionNotice(candidate, others, saved) };
}

/**
 * Check what a doctor typed for a session. Overlap with another session is decided by
 * `planAbsorption`: a free edge can be lent, and a booked patient is never cancelled here.
 */
export function checkSession(input: SessionInput, _others: readonly ConsultSession[], today?: string): SessionCheck {
  const once = input.kind === "once";
  let weekdays = [...new Set(input.weekdays)].filter((day) => Number.isInteger(day) && day >= 1 && day <= 6).sort((a, b) => a - b);
  let onDate: string | null = null;
  let startDate: string | null = null;
  let endDate: string | null = null;
  if (once) {
    if (!isIsoDate(input.onDate)) return { ok: false, message: "Choose the date of this session." };
    const day = weekdayIndex(input.onDate);
    if (day < 1 || day > 6) return { ok: false, message: "The clinic books Monday to Saturday. Choose another date." };
    if (today && input.onDate < today) return { ok: false, message: "That date has passed. Choose today or a later date." };
    onDate = input.onDate;
    weekdays = [];
  } else {
    if (weekdays.length === 0) return { ok: false, message: "Choose at least one weekday." };
    const start = input.startDate?.trim() || null;
    const end = input.endDate?.trim() || null;
    // Blank dates keep an open-ended weekly session. A start or an end on its own is incomplete.
    if (!start && !end) {
      startDate = null;
      endDate = null;
    } else {
      if (!isIsoDate(start)) return { ok: false, message: "Choose the date this session starts." };
      if (!isIsoDate(end)) return { ok: false, message: "Choose the date this session ends." };
      if (end < start) return { ok: false, message: "The end date must be on or after the start date." };
      if (today && end < today) return { ok: false, message: "The end date has passed. Choose a later end date." };
      let any = false;
      for (let date = start; date <= end && !any; date = addDays(date, 1)) any = weekdays.includes(weekdayIndex(date));
      if (!any) return { ok: false, message: "None of the chosen weekdays fall between those dates." };
      startDate = start;
      endDate = end;
    }
  }
  if (!isTime(input.startTime) || !isTime(input.endTime)) return { ok: false, message: "Enter the start and end time as HH:MM." };
  if (toMinutes(input.startTime) >= toMinutes(input.endTime)) return { ok: false, message: "The session must end after it starts." };
  const room = input.room.trim().slice(0, 60);
  if (!room) return { ok: false, message: "Add the room or clinic for this session." };
  const label = input.label.trim().slice(0, 60);
  const mode: SessionMode | null = input.mode === "stream" || input.mode === "wave" ? input.mode : null;
  if (!mode) return { ok: false, message: "Choose stream or wave." };
  let slotMinutes: number | null = null;
  let waveMinutes: number | null = null;
  let waveCapacity: number | null = null;
  if (mode === "stream") {
    if (!allowed(STREAM_SLOT_MINUTES, input.slotMinutes)) {
      return { ok: false, message: `Choose a slot length of ${STREAM_SLOT_MINUTES.join(", ")} minutes.` };
    }
    slotMinutes = input.slotMinutes;
  } else {
    // New and changed waves are one block for the whole session. A legacy wave length is kept only
    // when it is sent back unchanged (allowed list), so old sub-waves and their bookings stay valid.
    waveMinutes = allowed(WAVE_MINUTES, input.waveMinutes) ? input.waveMinutes : null;
    const capacity = input.waveCapacity;
    if (typeof capacity !== "number" || !Number.isInteger(capacity) || capacity < 1 || capacity > MAX_WAVE_CAPACITY) {
      return { ok: false, message: `A wave session takes between 1 and ${MAX_WAVE_CAPACITY} patients.` };
    }
    waveCapacity = capacity;
  }
  const value = { label, weekdays, startTime: input.startTime, endTime: input.endTime, room, mode, slotMinutes, waveMinutes, waveCapacity, startDate, endDate, onDate };
  const blocks = sessionBlocks(value);
  const step = stepMinutes(value);
  const length = toMinutes(input.endTime) - toMinutes(input.startTime);
  if (blocks.length === 0 || length % step !== 0) {
    return {
      ok: false,
      message: `The session is ${length} minutes, which is not a whole number of ${step}-minute ${mode === "stream" ? "slots" : "waves"}. Adjust the end time.`,
    };
  }
  return { ok: true, value };
}

/** The weekly sessions the practice's own doctors start with: all streams, so booking works as before. */
export function demoSessions(
  doctors: readonly { id: string; room: string }[],
  now = "2026-01-01T00:00:00.000Z",
): ConsultSession[] {
  const plan: Record<string, { weekdays: number[]; start: string; end: string; slot: number }[]> = {
    adeyemi: [
      { weekdays: [1, 2, 3, 4, 5], start: "09:00", end: "12:00", slot: 20 },
      { weekdays: [1, 2, 3, 4, 5], start: "14:00", end: "17:00", slot: 20 },
    ],
    reid: [
      { weekdays: [1, 2, 3, 4, 5], start: "09:00", end: "12:00", slot: 15 },
      { weekdays: [1, 2, 3, 4], start: "14:00", end: "16:30", slot: 15 },
    ],
    cho: [
      { weekdays: [1, 2, 3, 4, 5], start: "09:30", end: "12:00", slot: 20 },
      { weekdays: [1, 2, 3, 5], start: "14:00", end: "16:00", slot: 20 },
    ],
    rahman: [
      { weekdays: [2, 4], start: "09:30", end: "12:30", slot: 30 },
      { weekdays: [2, 4], start: "14:00", end: "16:30", slot: 30 },
    ],
    macleod: [
      { weekdays: [1, 2, 3, 5], start: "09:30", end: "12:00", slot: 20 },
      { weekdays: [1, 2, 3, 5], start: "14:30", end: "16:30", slot: 20 },
    ],
  };
  const sessions: ConsultSession[] = [];
  for (const doctor of doctors) {
    (plan[doctor.id] ?? []).forEach((part, index) => {
      sessions.push({
        id: `demo-${doctor.id}-${index + 1}`,
        doctorId: doctor.id,
        label: index === 0 ? "Morning surgery" : "Afternoon surgery",
        weekdays: part.weekdays,
        startTime: part.start,
        endTime: part.end,
        room: doctor.room,
        mode: "stream",
        slotMinutes: part.slot,
        waveMinutes: null,
        waveCapacity: null,
        archivedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    });
  }
  return sessions;
}

/** What a doctor added by an admin starts with: weekday mornings in 20-minute stream slots. */
export function defaultSession(doctorId: string, room: string, now: string): ConsultSession {
  return {
    id: `default-${doctorId}`,
    doctorId,
    label: "Weekday surgery",
    weekdays: [1, 2, 3, 4, 5],
    startTime: "09:00",
    endTime: "13:00",
    room,
    mode: "stream",
    slotMinutes: 20,
    waveMinutes: null,
    waveCapacity: null,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

/** "09:20–09:40": every slot and wave shows when it starts and ends. */
export function slotTimeLabel(slot: Pick<Slot, "time" | "endTime" | "mode">): string {
  return slot.endTime ? `${slot.time}–${slot.endTime}` : slot.time;
}

/** "3 of 8 places left" for a wave, "" for a stream slot. */
export function placesLabel(slot: Pick<Slot, "mode" | "capacity" | "booked">): string {
  if (slot.mode !== "wave") return "";
  const left = remainingPlaces(slot);
  return left === 0 ? "Full" : `${left} of ${slot.capacity ?? 1} places left`;
}
