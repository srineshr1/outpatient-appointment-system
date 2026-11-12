import type { AppointmentStatus, ConsultSession, SessionTrim } from "@/lib/clinic-types";
import { addDays, dayOfMonth, mondayOf, weekdayIndex } from "@/lib/clock";
import { monthShort, weekdayLong, weekdayShort } from "@/lib/format";
import {
  fromMinutes,
  hoursOnDate,
  sessionBlocks,
  toMinutes,
  trimsCovering,
  WEEKDAY_SHORT,
} from "@/lib/sessions";

/** Clinic day drawn on the schedule, matching the dashboard design (08:00–18:00). */
export const CLINIC_START = 8 * 60;
export const CLINIC_END = 18 * 60;

/**
 * Hour row height on the week calendar. Rows share the viewport height that is left after the site
 * header, the page heading and the calendar's own toolbar and day headings (SCHEDULE_CHROME_PX), so
 * the whole clinic day fits on a laptop screen without scrolling the grid. Clamped so rows never
 * get too short to read a session card, or taller than the old fixed 64px.
 */
export const HOUR_MIN_PX = 44;
export const HOUR_MAX_PX = 64;
export const SCHEDULE_CHROME_PX = 320;
/** Shortest a session card is drawn, so its heading row and slot dots stay readable. */
export const BLOCK_MIN_PX = 38;
/** CSS custom property that holds the hour height, set once on the calendar. */
export const HOUR_VAR = "--schedule-hour";

export function hourHeightCss(): string {
  const hours = (CLINIC_END - CLINIC_START) / 60;
  return `clamp(${HOUR_MIN_PX}px, calc((100dvh - ${SCHEDULE_CHROME_PX}px) / ${hours}), ${HOUR_MAX_PX}px)`;
}

/** A length of `minutes` on the calendar, in CSS, plus a fixed pixel adjustment. */
export function minutesCss(minutes: number, plusPx = 0): string {
  const hours = Number((minutes / 60).toFixed(4));
  if (plusPx === 0) return `calc(var(${HOUR_VAR}) * ${hours})`;
  return `calc(var(${HOUR_VAR}) * ${hours} ${plusPx < 0 ? "-" : "+"} ${Math.abs(plusPx)}px)`;
}

/** Where a session or the now line sits: minutes after the clinic day starts. */
export function topCss(startMin: number, plusPx = 0): string {
  return minutesCss(startMin - CLINIC_START, plusPx);
}

/** A session card's height: its length on the grid, never shorter than BLOCK_MIN_PX. */
export function blockHeightCss(startMin: number, endMin: number): string {
  return `max(${BLOCK_MIN_PX}px, ${minutesCss(endMin - startMin, -2)})`;
}

export interface ScheduleVisit {
  id: string;
  sessionId: string | null;
  /** Held slot id, used to tell whether a resized session would drop the visit. */
  slotId: string;
  date: string;
  time: string;
  endTime: string | null;
  token: number | null;
  patientName: string;
  reason: string;
  status: AppointmentStatus;
  reference: string;
}

export function toScheduleVisit(
  visit: {
    id: string;
    sessionId?: string | null;
    slotId: string;
    date: string;
    time: string;
    endTime?: string | null;
    token?: number | null;
    patientName: string;
    status: AppointmentStatus;
    reference: string;
  },
  reason: string,
): ScheduleVisit {
  return {
    id: visit.id,
    sessionId: visit.sessionId ?? null,
    slotId: visit.slotId,
    date: visit.date,
    time: visit.time,
    endTime: visit.endTime ?? null,
    token: visit.token ?? null,
    patientName: visit.patientName,
    reason,
    status: visit.status,
    reference: visit.reference,
  };
}

/** A visit that still takes a place on the calendar. */
export function holdsPlace(status: AppointmentStatus): boolean {
  return status === "booked" || status === "pending_payment" || status === "completed";
}

export interface Seat {
  /** 1-based seat inside a wave. Stream seats are always 1. */
  seat: number;
  visit: ScheduleVisit | null;
}

export interface TimeBlock {
  time: string;
  endTime: string;
  places: number;
  seats: Seat[];
}

export interface DaySession {
  /** `${sessionId}::${date}` */
  key: string;
  session: ConsultSession;
  date: string;
  startMin: number;
  endMin: number;
  blocks: TimeBlock[];
  booked: number;
  capacity: number;
  /** Booked visits for this session and date that no longer fall on a place. */
  outside: ScheduleVisit[];
  lane: number;
  lanes: number;
}

export interface ScheduleDay {
  date: string;
  dow: string;
  num: number;
  isToday: boolean;
  summary: string;
  sessions: DaySession[];
}

export interface WeekModel {
  days: ScheduleDay[];
  booked: number;
  capacity: number;
}

function placesFor(session: ConsultSession): number {
  return session.mode === "wave" ? Math.max(1, session.waveCapacity ?? 1) : 1;
}

function covered(block: { time: string; endTime: string }, trims: readonly SessionTrim[]): boolean {
  const start = toMinutes(block.time);
  const end = toMinutes(block.endTime);
  return trims.some((trim) => start < toMinutes(trim.endTime) && toMinutes(trim.startTime) < end);
}

function layout<T extends { startMin: number; endMin: number }>(items: T[]): (T & { lane: number; lanes: number })[] {
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
  const clusters: (T & { lane: number })[][] = [];
  let cluster: (T & { lane: number })[] = [];
  let clusterEnd = -1;
  for (const item of sorted) {
    if (cluster.length > 0 && item.startMin >= clusterEnd) {
      clusters.push(cluster);
      cluster = [];
      clusterEnd = -1;
    }
    const laneEnds: number[] = [];
    for (const placed of cluster) laneEnds[placed.lane] = Math.max(laneEnds[placed.lane] ?? 0, placed.endMin);
    let lane = laneEnds.findIndex((end) => end <= item.startMin);
    if (lane < 0) lane = laneEnds.length;
    cluster.push({ ...item, lane });
    clusterEnd = Math.max(clusterEnd, item.endMin);
  }
  if (cluster.length > 0) clusters.push(cluster);

  const placed: (T & { lane: number; lanes: number })[] = [];
  for (const group of clusters) {
    const lanes = Math.max(1, ...group.map((item) => item.lane + 1));
    for (const item of group) placed.push({ ...item, lanes });
  }
  return placed;
}

function seatVisits(session: ConsultSession, blocks: { time: string; endTime: string }[], visits: ScheduleVisit[]): { blocks: TimeBlock[]; outside: ScheduleVisit[] } {
  const places = placesFor(session);
  const byTime = new Map<string, ScheduleVisit[]>();
  const outside: ScheduleVisit[] = [];
  const times = new Set(blocks.map((block) => block.time));
  for (const visit of visits) {
    if (!times.has(visit.time)) {
      outside.push(visit);
      continue;
    }
    const list = byTime.get(visit.time) ?? [];
    list.push(visit);
    byTime.set(visit.time, list);
  }
  const seated = blocks.map((block) => {
    const waiting = (byTime.get(block.time) ?? []).slice().sort((a, b) => (a.token ?? 99) - (b.token ?? 99) || a.patientName.localeCompare(b.patientName));
    const seats: Seat[] = Array.from({ length: places }, (_, index) => ({ seat: index + 1, visit: null }));
    for (const visit of waiting) {
      const preferred = visit.token && visit.token >= 1 && visit.token <= places ? visit.token - 1 : seats.findIndex((seat) => !seat.visit);
      const index = preferred >= 0 && !seats[preferred]!.visit ? preferred : seats.findIndex((seat) => !seat.visit);
      if (index < 0) outside.push(visit);
      else seats[index] = { seat: index + 1, visit };
    }
    return { ...block, places, seats };
  });
  return { blocks: seated, outside };
}

/**
 * Monday-to-Saturday grid for one week. Weekly sessions step aside on a date that has a one-off,
 * and minutes already lent to a neighbour are left off the block.
 */
export function buildWeek(
  sessions: readonly ConsultSession[],
  visits: readonly ScheduleVisit[],
  trims: readonly SessionTrim[],
  monday: string,
  today: string,
): WeekModel {
  const live = sessions.filter((session) => !session.archivedAt);
  const holding = visits.filter((visit) => holdsPlace(visit.status));
  const days: ScheduleDay[] = [];
  let booked = 0;
  let capacity = 0;

  for (let index = 0; index < 6; index += 1) {
    const date = addDays(monday, index);
    const claimed = new Set<string>();
    const raw: Omit<DaySession, "lane" | "lanes">[] = [];
    for (const session of live) {
      const hours = hoursOnDate(session, date, trims, live);
      if (!hours) continue;
      const open = sessionBlocks(session).filter((block) => block.time >= hours.startTime && block.endTime <= hours.endTime && !covered(block, trimsCovering(session.id, date, trims, live)));
      if (open.length === 0) continue;
      const mine = holding.filter((visit) => {
        if (visit.date !== date || claimed.has(visit.id)) return false;
        if (visit.sessionId) return visit.sessionId === session.id;
        return visit.time >= hours.startTime && visit.time < hours.endTime;
      });
      for (const visit of mine) claimed.add(visit.id);
      const seated = seatVisits(session, open, mine);
      const filled = seated.blocks.reduce((sum, block) => sum + block.seats.filter((seat) => seat.visit).length, 0);
      const cap = seated.blocks.reduce((sum, block) => sum + block.places, 0);
      booked += filled;
      capacity += cap;
      raw.push({
        key: `${session.id}::${date}`,
        session,
        date,
        startMin: toMinutes(open[0]!.time),
        endMin: toMinutes(open[open.length - 1]!.endTime),
        blocks: seated.blocks,
        booked: filled,
        capacity: cap,
        outside: seated.outside,
      });
    }
    const sessionsToday = layout(raw);
    const count = sessionsToday.length;
    days.push({
      date,
      dow: WEEKDAY_SHORT[index] ?? weekdayShort(date),
      num: dayOfMonth(date),
      isToday: date === today,
      summary: count === 0 ? "No sessions" : `${count} ${count === 1 ? "session" : "sessions"} · ${sessionsToday.reduce((sum, item) => sum + item.booked, 0)}/${sessionsToday.reduce((sum, item) => sum + item.capacity, 0)}`,
      sessions: sessionsToday,
    });
  }

  return { days, booked, capacity };
}

export function weekMonday(today: string, offset: number): string {
  return addDays(mondayOf(today), offset * 7);
}

/** "Nov 10 – Nov 15, 2026" for the Monday–Saturday week. */
export function weekTitle(monday: string): string {
  const end = addDays(monday, 5);
  const startLabel = `${monthShort(monday)} ${dayOfMonth(monday)}`;
  const endLabel = `${monthShort(end)} ${dayOfMonth(end)}, ${end.slice(0, 4)}`;
  return `${startLabel} – ${endLabel}`;
}

export function weekTag(offset: number): string {
  if (offset === 0) return "This week";
  if (offset === -1) return "Last week";
  if (offset === 1) return "Next week";
  const weeks = Math.abs(offset);
  return offset < 0 ? `${weeks} weeks ago` : `${weeks} weeks ahead`;
}

/** "Thursday, Nov 10" */
export function todayTitle(today: string): string {
  return `${weekdayLong(today)}, ${monthShort(today)} ${dayOfMonth(today)}`;
}

export function occurrenceLabel(session: ConsultSession, date: string): string {
  const when = `${weekdayLong(date)}, ${monthShort(date)} ${dayOfMonth(date)}`;
  if (session.onDate) return when;
  const days = session.weekdays
    .slice()
    .sort((a, b) => a - b)
    .map((day) => WEEKDAY_SHORT[day - 1] ?? "")
    .filter(Boolean)
    .join(", ");
  return `${when} · every ${days || weekdayShort(date)}`;
}

/** The session no longer runs on any future date. */
export function sessionIsPast(session: ConsultSession, today: string): boolean {
  if (session.onDate) return session.onDate < today;
  if (session.endDate && session.endDate < today) return true;
  return false;
}

/** First free hour on `date` for a new one-off session, or null when the day is full. */
export function firstFreeHour(sessions: readonly ConsultSession[], trims: readonly SessionTrim[], date: string): number | null {
  const live = sessions.filter((session) => !session.archivedAt);
  for (let start = CLINIC_START; start <= CLINIC_END - 60; start += 30) {
    const end = start + 60;
    const hits = live.some((session) => {
      const hours = hoursOnDate(session, date, trims, live);
      if (!hours) return false;
      return start < toMinutes(hours.endTime) && toMinutes(hours.startTime) < end;
    });
    if (!hits) return start;
  }
  return null;
}

export function minutesLabel(total: number): string {
  return fromMinutes(total);
}

/** Weekday index 1–6, or null on Sunday. */
export function clinicWeekday(date: string): number | null {
  const day = weekdayIndex(date);
  return day >= 1 && day <= 6 ? day : null;
}
