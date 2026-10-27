import { addDays, dayOfMonth, londonWallClock, monthIndex, weekdayIndex, yearOf } from "./clock";
import type { Slot } from "./data";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

export function weekdayLong(iso: string): string {
  return WEEKDAYS[weekdayIndex(iso)]!;
}

export function weekdayShort(iso: string): string {
  return WEEKDAYS_SHORT[weekdayIndex(iso)]!;
}

export function monthLong(iso: string): string {
  return MONTHS[monthIndex(iso)]!;
}

export function monthShort(iso: string): string {
  return MONTHS_SHORT[monthIndex(iso)]!;
}

/** "Thursday 29 October 2026" */
export function formatFull(iso: string): string {
  return `${weekdayLong(iso)} ${dayOfMonth(iso)} ${monthLong(iso)} ${yearOf(iso)}`;
}

/** "Thu 29 Oct" */
export function formatShortDate(iso: string): string {
  return `${weekdayShort(iso)} ${dayOfMonth(iso)} ${monthShort(iso)}`;
}

/** "26–30 October 2026" or "30 November – 4 December 2026" */
export function formatWeekRange(weekStart: string): string {
  const end = addDays(weekStart, 4);
  const sameMonth = monthIndex(weekStart) === monthIndex(end);
  const sameYear = yearOf(weekStart) === yearOf(end);
  if (sameMonth && sameYear) return `${dayOfMonth(weekStart)}–${dayOfMonth(end)} ${monthLong(end)} ${yearOf(end)}`;
  const startLabel = `${dayOfMonth(weekStart)} ${monthLong(weekStart)}${sameYear ? "" : ` ${yearOf(weekStart)}`}`;
  return `${startLabel} – ${dayOfMonth(end)} ${monthLong(end)} ${yearOf(end)}`;
}

/** Relative day label: "Today", "Tomorrow", or "Thu 29 Oct". */
export function relativeDay(iso: string, today: string): string {
  if (iso === today) return "Today";
  if (iso === addDays(today, 1)) return "Tomorrow";
  return formatShortDate(iso);
}

/** "Today, 15:10" / "Tomorrow, 09:40" / "Thu 29 Oct, 14:20" */
export function formatWhen(slot: Pick<Slot, "date" | "time">, today: string): string {
  return `${relativeDay(slot.date, today)}, ${slot.time}`;
}

export function clockLabel(instant: Date): string {
  return londonWallClock(instant).time;
}

export function yearsLabel(years: number): string {
  return years === 1 ? "1 year in practice" : `${years} years in practice`;
}

export function monogram(name: string): string {
  const parts = name.replace(/^Dr\s+/, "").split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return `${first}${last}`.toUpperCase();
}

export function ageOn(dobIso: string, today: string): number {
  const [year, month, day] = dobIso.split("-").map(Number) as [number, number, number];
  const [tYear, tMonth, tDay] = today.split("-").map(Number) as [number, number, number];
  let age = tYear - year;
  if (tMonth < month || (tMonth === month && tDay < day)) age -= 1;
  return age;
}

export function ageLabel(dobIso: string, today: string): string {
  const age = ageOn(dobIso, today);
  if (age < 1) return "Under 1 year old";
  if (age === 1) return "1 year old";
  return `${age} years old`;
}

/** Normalise a UK mobile to "07700 900123"; anything else is returned trimmed. */
export function formatPhone(input: string): string {
  let local = input.replace(/\D/g, "");
  if (local.startsWith("0044")) local = `0${local.slice(4)}`;
  else if (local.startsWith("44")) local = `0${local.slice(2)}`;
  if (local.length === 11 && local.startsWith("07")) {
    return `${local.slice(0, 5)} ${local.slice(5)}`;
  }
  return input.trim();
}

export function pluralise(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}
