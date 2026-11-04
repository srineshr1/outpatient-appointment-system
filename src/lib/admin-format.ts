import { addDays, londonWallClock, now, todayIso, yearOf } from "./clock";
import { formatShortDate } from "./format";

/** "Today", "Yesterday", "Tomorrow", "Thu 29 Oct", or "Thu 29 Oct 2025" in another year. */
export function dayLabel(isoDate: string, today: string = todayIso(now())): string {
  if (isoDate === today) return "Today";
  if (isoDate === addDays(today, -1)) return "Yesterday";
  if (isoDate === addDays(today, 1)) return "Tomorrow";
  const short = formatShortDate(isoDate);
  return yearOf(isoDate) === yearOf(today) ? short : `${short} ${yearOf(isoDate)}`;
}

/** An instant in London time: "Today, 17:40" or "Thu 29 Oct, 09:12". "—" when unknown. */
export function instantLabel(iso: string | null | undefined, today: string = todayIso(now())): string {
  if (!iso) return "—";
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return "—";
  const wall = londonWallClock(instant);
  return `${dayLabel(wall.date, today)}, ${wall.time}`;
}

/** A visit's slot: "Today, 09:40". */
export function slotLabel(date: string, time: string, today: string = todayIso(now())): string {
  return `${dayLabel(date, today)}, ${time}`;
}

export function percent(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}
