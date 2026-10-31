import { addDays, londonToInstant, londonWallClock, mondayOf } from "./clock";
import { practice, type BookWindow, type Slot } from "./data";

export type SlotStatus = "open" | "past" | "taken" | "teaching";

export function slotStart(slot: Pick<Slot, "date" | "time">): Date {
  return londonToInstant(slot.date, slot.time);
}

/**
 * Whether a slot can still be booked online at `instant`.
 * Same-day times close at `practice.sameDayClose`; after that the desk handles them.
 */
export function slotStatus(slot: Slot, takenIds: readonly string[], instant: Date): SlotStatus {
  if (slotStart(slot).getTime() <= instant.getTime()) return "past";
  const wall = londonWallClock(instant);
  if (slot.date === wall.date && wall.time >= practice.sameDayClose) return "past";
  if (slot.taken || takenIds.includes(slot.id)) return "taken";
  if (slot.teaching) return "teaching";
  return "open";
}

function byStart(a: Slot, b: Slot): number {
  return a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date);
}

export function openSlots(slots: readonly Slot[], takenIds: readonly string[], instant: Date): Slot[] {
  return slots.filter((slot) => slotStatus(slot, takenIds, instant) === "open").sort(byStart);
}

export function nextOpening(
  slots: readonly Slot[],
  doctorId: string,
  takenIds: readonly string[],
  instant: Date,
): Slot | null {
  return openSlots(slots.filter((slot) => slot.doctorId === doctorId), takenIds, instant)[0] ?? null;
}

export function slotsOn(slots: readonly Slot[], doctorId: string, date: string): Slot[] {
  return slots.filter((slot) => slot.doctorId === doctorId && slot.date === date).sort(byStart);
}

export function weekDays(weekStart: string): string[] {
  return [0, 1, 2, 3, 4].map((offset) => addDays(weekStart, offset));
}

/** Coerce any requested week into a Monday inside the bookable window. */
export function clampWeek(requested: string | null | undefined, window: BookWindow, fallback?: string): string {
  const base = requested ?? fallback ?? window.firstWeek;
  const monday = mondayOf(base);
  if (monday < window.firstWeek) return window.firstWeek;
  if (monday > window.lastWeek) return window.lastWeek;
  return monday;
}

export function canShiftWeek(weekStart: string, direction: -1 | 1, window: BookWindow): boolean {
  const next = addDays(weekStart, direction * 7);
  return next >= window.firstWeek && next <= window.lastWeek;
}
