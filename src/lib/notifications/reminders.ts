/** Reminder timing, pure. Offsets are minutes before the visit; the default is 24 hours and 2 hours. */
export const DEFAULT_REMINDER_OFFSETS = [1440, 120];
const MAX_OFFSET = 14 * 1440;
const MAX_COUNT = 5;

/** Read offsets from a setting, an env value ("1440,120") or an array. Bad input falls back; the result is sorted longest first. */
export function parseOffsets(raw: unknown): number[] | null {
  let list: unknown[];
  if (Array.isArray(raw)) list = raw;
  else if (typeof raw === "string") list = raw.split(/[\s,]+/).filter(Boolean);
  else return null;
  const offsets = [...new Set(list.map(Number).filter((value) => Number.isFinite(value) && value >= 5 && value <= MAX_OFFSET).map(Math.round))];
  if (list.length > 0 && offsets.length === 0) return null;
  return offsets.sort((a, b) => b - a).slice(0, MAX_COUNT);
}

/** Admin setting first, then REMINDER_OFFSETS_MINUTES, then the default. An explicit empty list switches reminders off. */
export function resolveOffsets(setting: unknown, env: string | undefined = process.env.REMINDER_OFFSETS_MINUTES): number[] {
  return parseOffsets(setting) ?? parseOffsets(env) ?? DEFAULT_REMINDER_OFFSETS;
}

export interface ScheduledReminder {
  offsetMinutes: number;
  at: Date;
}

/** The reminders still worth sending: those whose time is not already past. */
export function reminderSchedule(startsAt: Date, offsets: readonly number[], at: Date): ScheduledReminder[] {
  return offsets
    .map((offsetMinutes) => ({ offsetMinutes, at: new Date(startsAt.getTime() - offsetMinutes * 60_000) }))
    .filter((reminder) => reminder.at.getTime() > at.getTime() && startsAt.getTime() > at.getTime());
}
