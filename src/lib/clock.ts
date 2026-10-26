/**
 * Time for the practice. Everything the patient sees is Edinburgh wall-clock time
 * (Europe/London), regardless of the device or server time zone.
 *
 * Calendar dates are plain ISO strings ("2026-10-26") and are manipulated with UTC
 * arithmetic so the host time zone can never shift them.
 */

export const PRACTICE_TZ = "Europe/London";

let override: number | null = null;

/** The current instant. Tests may pin it with `setNow`. */
export function now(): Date {
  return new Date(override ?? Date.now());
}

/** Pin (or with `null`, release) the clock. Intended for tests only. */
export function setNow(value: Date | number | null): void {
  override = value === null ? null : typeof value === "number" ? value : value.getTime();
}

const partsFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: PRACTICE_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

interface WallClock {
  date: string;
  time: string;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** The London wall-clock reading for an instant. */
export function londonWallClock(instant: Date): WallClock {
  const parts: Record<string, string> = {};
  for (const part of partsFormatter.formatToParts(instant)) parts[part.type] = part.value;
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  const second = Number(parts.second);
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
    year,
    month,
    day,
    hour,
    minute,
    second,
  };
}

/** Offset of London from UTC, in minutes, at a given instant (0 in GMT, 60 in BST). */
function londonOffsetMinutes(instant: Date): number {
  const wall = londonWallClock(instant);
  const asUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
  return Math.round((asUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60000);
}

/** Convert a London wall-clock date and "HH:MM" time to the UTC instant it names. */
export function londonToInstant(isoDate: string, time: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number) as [number, number, number];
  const [hour, minute] = time.split(":").map(Number) as [number, number];
  const naive = Date.UTC(year, month - 1, day, hour, minute);
  // Two passes settle the offset either side of a clock change.
  let guess = naive - londonOffsetMinutes(new Date(naive)) * 60000;
  guess = naive - londonOffsetMinutes(new Date(guess)) * 60000;
  return new Date(guess);
}

/** Today's date in London. */
export function todayIso(instant: Date = now()): string {
  return londonWallClock(instant).date;
}

/* ---------- Calendar arithmetic on ISO date strings ---------- */

function toUtc(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, day));
}

function fromUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return fromUtc(toUtc(value)) === value;
}

export function addDays(iso: string, count: number): string {
  const date = toUtc(iso);
  date.setUTCDate(date.getUTCDate() + count);
  return fromUtc(date);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekdayIndex(iso: string): number {
  return toUtc(iso).getUTCDay();
}

export function mondayOf(iso: string): string {
  const weekday = weekdayIndex(iso);
  return addDays(iso, weekday === 0 ? -6 : 1 - weekday);
}

export function monthIndex(iso: string): number {
  return toUtc(iso).getUTCMonth();
}

export function dayOfMonth(iso: string): number {
  return toUtc(iso).getUTCDate();
}

export function yearOf(iso: string): number {
  return toUtc(iso).getUTCFullYear();
}

export function addMinutes(time: string, minutes: number): string {
  const [hours, mins] = time.split(":").map(Number) as [number, number];
  const total = hours * 60 + mins + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
