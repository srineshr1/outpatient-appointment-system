import type { ConsultSession, SessionMode } from "./clinic-types";
import { addDays, weekdayIndex } from "./clock";
import type { Slot } from "./data";

/**
 * Consulting sessions and the two ways a session can be booked.
 *
 * STREAM: the session is cut into fixed slots (10, 15, 20 or 30 minutes). Each slot takes one
 * patient, at that time. The slot id is `<doctor>-<date>-<HHMM>`.
 *
 * WAVE: the session is cut into waves (30, 45, 60 or 90 minutes). Each wave takes up to N patients.
 * Patients are told the wave, not a minute, and are seen in token order. The wave id is
 * `w-<session>-<date>-<HHMM>`; each booking holds `<wave id>#<token>`, so the database's
 * one-booking-per-held-slot index also stops two patients sharing a token.
 *
 * Everything here is pure, so the server and the tests share it. No runtime import of data.ts
 * (it imports this file).
 */

export const STREAM_SLOT_MINUTES = [10, 15, 20, 30] as const;
export const WAVE_MINUTES = [30, 45, 60, 90] as const;
export const MAX_WAVE_CAPACITY = 20;
export const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;
export const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;

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

export interface Block {
  time: string;
  endTime: string;
}

/** The step of a session in minutes: the slot length for a stream, the wave length for a wave. */
export function stepMinutes(session: Pick<ConsultSession, "mode" | "slotMinutes" | "waveMinutes">): number {
  return (session.mode === "stream" ? session.slotMinutes : session.waveMinutes) ?? 0;
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

/** Every slot or wave of one session from `firstDate` up to and including `lastDate`. */
export function slotsForSession(session: ConsultSession, doctorId: string, firstDate: string, lastDate: string): Slot[] {
  if (session.archivedAt) return [];
  const blocks = sessionBlocks(session);
  const slots: Slot[] = [];
  for (let date = firstDate; date <= lastDate; date = addDays(date, 1)) {
    if (!session.weekdays.includes(weekdayIndex(date))) continue;
    for (const block of blocks) {
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
  const days = [...new Set(weekdays)].filter((day) => day >= 1 && day <= 5).sort((a, b) => a - b);
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
  return `${session.waveMinutes}-minute waves, up to ${places} patient${places === 1 ? "" : "s"} each`;
}

export function describeSession(session: ConsultSession): string {
  return `${weekdaysLabel(session.weekdays)} · ${session.startTime}–${session.endTime} · ${modeSummary(session)}`;
}

export interface SessionInput {
  label: string;
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
      >;
    }
  | { ok: false; message: string };

function allowed(list: readonly number[], value: number | null | undefined): value is number {
  return typeof value === "number" && list.includes(value);
}

/** Do two sessions share a weekday and any minute of the day? */
export function sessionsOverlap(
  a: Pick<ConsultSession, "weekdays" | "startTime" | "endTime">,
  b: Pick<ConsultSession, "weekdays" | "startTime" | "endTime">,
): boolean {
  if (!a.weekdays.some((day) => b.weekdays.includes(day))) return false;
  return toMinutes(a.startTime) < toMinutes(b.endTime) && toMinutes(b.startTime) < toMinutes(a.endTime);
}

/**
 * Check what a doctor typed for a session. `others` are the doctor's other live sessions (not the
 * one being edited): two sessions on the same day may not overlap, which also keeps every slot id unique.
 */
export function checkSession(input: SessionInput, others: readonly ConsultSession[]): SessionCheck {
  const weekdays = [...new Set(input.weekdays)].filter((day) => Number.isInteger(day) && day >= 1 && day <= 5).sort((a, b) => a - b);
  if (weekdays.length === 0) return { ok: false, message: "Choose at least one weekday." };
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
    if (!allowed(WAVE_MINUTES, input.waveMinutes)) {
      return { ok: false, message: `Choose a wave length of ${WAVE_MINUTES.join(", ")} minutes.` };
    }
    waveMinutes = input.waveMinutes;
    const capacity = input.waveCapacity;
    if (typeof capacity !== "number" || !Number.isInteger(capacity) || capacity < 1 || capacity > MAX_WAVE_CAPACITY) {
      return { ok: false, message: `A wave takes between 1 and ${MAX_WAVE_CAPACITY} patients.` };
    }
    waveCapacity = capacity;
  }
  const value = { label, weekdays, startTime: input.startTime, endTime: input.endTime, room, mode, slotMinutes, waveMinutes, waveCapacity };
  const blocks = sessionBlocks(value);
  const step = stepMinutes(value);
  const length = toMinutes(input.endTime) - toMinutes(input.startTime);
  if (blocks.length === 0 || length % step !== 0) {
    return {
      ok: false,
      message: `The session is ${length} minutes, which is not a whole number of ${step}-minute ${mode === "stream" ? "slots" : "waves"}. Adjust the end time.`,
    };
  }
  const clash = others.find((other) => !other.archivedAt && sessionsOverlap(value, other));
  if (clash) {
    return {
      ok: false,
      message: `That overlaps your ${clash.label || "other"} session (${weekdaysLabel(clash.weekdays)}, ${clash.startTime}–${clash.endTime}).`,
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

/** "09:20" for a stream slot, "14:00–14:30" for a wave. */
export function slotTimeLabel(slot: Pick<Slot, "time" | "endTime" | "mode">): string {
  return slot.mode === "wave" && slot.endTime ? `${slot.time}–${slot.endTime}` : slot.time;
}

/** "3 of 8 places left" for a wave, "" for a stream slot. */
export function placesLabel(slot: Pick<Slot, "mode" | "capacity" | "booked">): string {
  if (slot.mode !== "wave") return "";
  const left = remainingPlaces(slot);
  return left === 0 ? "Full" : `${left} of ${slot.capacity ?? 1} ${left === 1 ? "place" : "places"} left`;
}
