/**
 * Adding or changing a doctor's consulting session from the assistant. Preparing runs every check
 * the Schedule editor runs (saveDoctorSession with dryRun) and seals a confirmation. Nothing is
 * written until the doctor confirms, and the same checks run again then.
 *
 * The assistant never notifies, moves or offers new times to patients. A change that would need
 * that is refused here and left to the Schedule page, where the doctor confirms it explicitly.
 */
import type { ConsultSession, PublicUser } from "../clinic-types";
import { todayIso, now } from "../clock";
import { formatFull } from "../format";
import { readDoctorProfile } from "../profiles";
import { ownsBook, saveDoctorSession, type SessionSaveOutcome } from "../session-save";
import { daysLabel, overriddenDates, sessionRunsOn, toMinutes, type SessionInput } from "../sessions";
import { getStore } from "../store";
import { issueConfirmation, type PendingAction, type PendingCard } from "./confirm-token";
import { resolveDay } from "./read";

export type SessionAction = Extract<PendingAction, { type: "session" }>;

const CLOSED = "Nothing was changed.";
const NOT_YOURS = "Only a doctor can add or change their own consulting sessions.";

/** The same defaults as a new session in the Schedule editor. */
export const NEW_SESSION = { label: "New session", mode: "stream", slotMinutes: 15, waveCapacity: 6 } as const;

/** "12", "12:00", "2 pm", "2:30pm", "14:00" → "HH:MM". */
export function normaliseTime(value: string): string | null {
  const match = /^\s*(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?\s*$/i.exec(value);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? "0");
  const half = match[3]?.toLowerCase().replaceAll(".", "");
  if (minute > 59) return null;
  if (half) {
    if (hour < 1 || hour > 12) return null;
    if (half === "pm" && hour !== 12) hour += 12;
    if (half === "am" && hour === 12) hour = 0;
  }
  if (hour > 23) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export interface SessionArgs {
  date?: string;
  startTime?: string;
  endTime?: string;
  room?: string;
  label?: string;
  mode?: string;
  slotMinutes?: number | null;
  waveCapacity?: number | null;
  weekdays?: number[] | null;
  startDate?: string;
  endDate?: string;
}

async function defaultRoom(user: PublicUser): Promise<string> {
  // Same order as the Schedule page: the profile's room, then the account's, then "Clinic".
  const store = await getStore();
  const [record, account] = await Promise.all([store.getProfile(user.id), store.getUserById(user.id)]);
  return readDoctorProfile(record).room || account?.doctorRoom || "Clinic";
}

function timeArg(value: string | undefined, fallback: string | null, which: "start" | "end"): string | { error: string } {
  if (!value?.trim()) return fallback ?? { error: `Say when the session ${which === "start" ? "starts" : "ends"}.` };
  return normaliseTime(value) ?? { error: `Give the ${which} time as HH:MM, for example 14:00.` };
}

function dayArg(value: string | undefined): string | { error: string } {
  return resolveDay(value, todayIso(now()));
}

function places(session: Pick<ConsultSession, "mode" | "startTime" | "endTime" | "slotMinutes" | "waveCapacity" | "waveMinutes">): string {
  if (session.mode === "wave") {
    const capacity = session.waveCapacity ?? 0;
    return `a wave of up to ${capacity} ${capacity === 1 ? "patient" : "patients"}`;
  }
  const slots = Math.floor((toMinutes(session.endTime) - toMinutes(session.startTime)) / (session.slotMinutes || 1));
  return `${session.slotMinutes}-minute slots (${slots} ${slots === 1 ? "place" : "places"})`;
}

function when(session: Pick<ConsultSession, "onDate" | "weekdays" | "startDate" | "endDate">): string {
  if (session.onDate) return `on ${formatFull(session.onDate)} only`;
  return `every week, ${daysLabel(session)}`;
}

/** Weekly sessions that step aside on a date once a one-off session is on it. */
function replacedOn(date: string, sessions: readonly ConsultSession[], exceptId: string | null): ConsultSession[] {
  const already = overriddenDates(sessions.filter((session) => session.id !== exceptId)).has(date);
  if (already) return [];
  return sessions.filter((session) => !session.archivedAt && !session.onDate && session.id !== exceptId && sessionRunsOn(session, date));
}

function refusal(outcome: Extract<SessionSaveOutcome, { ok: false }>): string {
  if (outcome.displace || outcome.shift) {
    return `${outcome.message} The assistant does not move or notify patients. Make this change on the Schedule page, where you can confirm what happens to them.`;
  }
  return outcome.message;
}

async function prepare(user: PublicUser, action: SessionAction, title: string, confirmLabel: string, describe: (session: ConsultSession) => Promise<string>) {
  const checked = await saveDoctorSession(user, { ...actionRequest(action), dryRun: true });
  if (!checked.ok) return { forModel: { error: refusal(checked) } };
  const summary = `${await describe(checked.session)}${checked.notice ? ` ${checked.notice}` : ""}`;
  let pending: PendingCard;
  try {
    pending = await issueConfirmation(user, action, { title, summary, confirmLabel });
  } catch {
    return { forModel: { error: `Confirmations are unavailable until AUTH_SECRET is set on the server. ${CLOSED}` } };
  }
  return {
    pending,
    forModel: { needsConfirmation: true, summary, instruction: "Ask the doctor to confirm. Do not say the session is saved." },
  };
}

function actionRequest(action: SessionAction) {
  return { id: action.sessionId, input: action.input, waveMinutesOmitted: action.keepWaveMinutes, displace: null, shiftCount: null };
}

/** Prepare a new session. One date unless weekdays are given; then weekly until endDate. */
export async function proposeAddSession(user: PublicUser, args: SessionArgs): Promise<{ forModel: unknown; pending?: PendingCard }> {
  if (!ownsBook(user)) return { forModel: { error: NOT_YOURS } };
  const date = dayArg(args.date);
  if (typeof date !== "string") return { forModel: date };
  const startTime = timeArg(args.startTime, null, "start");
  if (typeof startTime !== "string") return { forModel: startTime };
  const endTime = timeArg(args.endTime, null, "end");
  if (typeof endTime !== "string") return { forModel: endTime };
  const weekly = Array.isArray(args.weekdays) && args.weekdays.length > 0;
  if (weekly && !args.endDate?.trim()) return { forModel: { error: "Ask the doctor until which date the weekly session should run." } };
  const endDate = weekly ? dayArg(args.endDate) : null;
  if (endDate !== null && typeof endDate !== "string") return { forModel: endDate };
  const mode = args.mode === "wave" ? "wave" : NEW_SESSION.mode;
  const input: SessionInput = {
    label: args.label?.trim() || NEW_SESSION.label,
    kind: weekly ? "recurring" : "once",
    onDate: weekly ? null : date,
    startDate: weekly ? date : null,
    endDate: weekly ? endDate : null,
    weekdays: weekly ? args.weekdays! : [],
    startTime,
    endTime,
    room: args.room?.trim() || (await defaultRoom(user)),
    mode,
    slotMinutes: mode === "stream" ? (args.slotMinutes ?? NEW_SESSION.slotMinutes) : null,
    waveMinutes: null,
    waveCapacity: mode === "wave" ? (args.waveCapacity ?? NEW_SESSION.waveCapacity) : null,
  };
  const action: SessionAction = { type: "session", sessionId: null, expectUpdatedAt: null, keepWaveMinutes: false, input };
  const sessions = (await (await getStore()).listConsultSessions(user.id)).filter((session) => !session.archivedAt);
  return prepare(user, action, "Add this session?", "Add session", async (session) => {
    const base = `Add a ${session.mode} ${when(session)}, ${session.startTime}–${session.endTime}, ${session.room}, ${places(session)}. Patients can book it once it is added.`;
    if (!session.onDate) return base;
    const replaced = replacedOn(session.onDate, sessions, null);
    if (replaced.length === 0) return base;
    const list = replaced.map((item) => `${item.label || "Session"} ${item.startTime}–${item.endTime}`).join(", ");
    return `${base} On that date a one-off session replaces your weekly ${replaced.length === 1 ? "session" : "sessions"} (${list}): ${replaced.length === 1 ? "it is" : "they are"} not offered for new bookings that day. Visits already booked keep their times.`;
  });
}

function describeChanges(before: ConsultSession, after: ConsultSession): string[] {
  const changes: string[] = [];
  if (before.startTime !== after.startTime || before.endTime !== after.endTime) {
    changes.push(`hours ${before.startTime}–${before.endTime} → ${after.startTime}–${after.endTime}`);
  }
  if (when(before) !== when(after)) changes.push(`dates ${when(before)} → ${when(after)}`);
  if (before.room !== after.room) changes.push(`room ${before.room} → ${after.room}`);
  if (before.label !== after.label) changes.push(`name "${before.label || "Session"}" → "${after.label || "Session"}"`);
  if (before.mode !== after.mode || before.slotMinutes !== after.slotMinutes || before.waveCapacity !== after.waveCapacity) {
    changes.push(`${before.mode}, ${places(before)} → ${after.mode}, ${places(after)}`);
  }
  return changes;
}

/** Prepare a change to one of the doctor's sessions. For a weekly session the whole series changes. */
export async function proposeUpdateSession(user: PublicUser, sessionId: string, args: SessionArgs): Promise<{ forModel: unknown; pending?: PendingCard }> {
  if (!ownsBook(user)) return { forModel: { error: NOT_YOURS } };
  const existing = sessionId ? await (await getStore()).getConsultSession(sessionId) : null;
  if (!existing || existing.doctorId !== user.id || existing.archivedAt) {
    return { forModel: { error: "That session is not on your schedule. Call working_hours for the session ids." } };
  }
  const startTime = timeArg(args.startTime, existing.startTime, "start");
  if (typeof startTime !== "string") return { forModel: startTime };
  const endTime = timeArg(args.endTime, existing.endTime, "end");
  if (typeof endTime !== "string") return { forModel: endTime };
  const once = Boolean(existing.onDate);
  let onDate = existing.onDate ?? null;
  let startDate = existing.startDate ?? null;
  let endDate = existing.endDate ?? null;
  let weekdays = [...existing.weekdays];
  if (once && args.date?.trim()) {
    const date = dayArg(args.date);
    if (typeof date !== "string") return { forModel: date };
    onDate = date;
  }
  if (!once) {
    if (args.date?.trim()) {
      return { forModel: { error: "This is a weekly session; changing it changes every week. To change one day only, add a one-off session on that date instead (it replaces the weekly sessions that day)." } };
    }
    if (args.startDate?.trim()) {
      const date = dayArg(args.startDate);
      if (typeof date !== "string") return { forModel: date };
      startDate = date;
    }
    if (args.endDate?.trim()) {
      const date = dayArg(args.endDate);
      if (typeof date !== "string") return { forModel: date };
      endDate = date;
    }
    if (Array.isArray(args.weekdays) && args.weekdays.length > 0) weekdays = args.weekdays;
  }
  const mode = args.mode === "wave" || args.mode === "stream" ? args.mode : existing.mode;
  const input: SessionInput = {
    label: args.label?.trim() ?? existing.label,
    kind: once ? "once" : "recurring",
    onDate: once ? onDate : null,
    startDate: once ? null : startDate,
    endDate: once ? null : endDate,
    weekdays: once ? [] : weekdays,
    startTime,
    endTime,
    room: args.room?.trim() || existing.room,
    mode,
    slotMinutes: mode === "stream" ? (args.slotMinutes ?? existing.slotMinutes ?? NEW_SESSION.slotMinutes) : null,
    waveMinutes: null,
    waveCapacity: mode === "wave" ? (args.waveCapacity ?? existing.waveCapacity ?? NEW_SESSION.waveCapacity) : null,
  };
  const action: SessionAction = {
    type: "session",
    sessionId: existing.id,
    expectUpdatedAt: existing.updatedAt,
    keepWaveMinutes: existing.mode === "wave" && mode === "wave",
    input,
  };
  const checked = await saveDoctorSession(user, { ...actionRequest(action), dryRun: true });
  if (!checked.ok) return { forModel: { error: refusal(checked) } };
  const changes = describeChanges(existing, checked.session);
  if (changes.length === 0) return { forModel: { error: "That is already how the session is set. Nothing to change." } };
  const scope = once
    ? `the one-off session on ${formatFull(existing.onDate!)}`
    : `the weekly session (${daysLabel(existing)}). This changes every week of the series, not one day`;
  return prepare(user, action, "Change this session?", "Change session", async () => {
    return `Change ${existing.label || "Session"} ${existing.startTime}–${existing.endTime}: ${changes.join("; ")}. This is ${scope}. Visits already booked keep their times.`;
  });
}

/** Run a confirmed session change through the Schedule editor's save, with every check again. */
export async function saveConfirmedSession(user: PublicUser, action: SessionAction): Promise<{ ok: boolean; summary: string }> {
  if (!ownsBook(user)) return { ok: false, summary: `${NOT_YOURS} ${CLOSED}` };
  if (action.sessionId) {
    const current = await (await getStore()).getConsultSession(action.sessionId);
    if (!current || current.archivedAt || current.doctorId !== user.id) return { ok: false, summary: `That session is no longer on your schedule. ${CLOSED}` };
    if (action.expectUpdatedAt && current.updatedAt !== action.expectUpdatedAt) {
      return { ok: false, summary: `That session was changed after I prepared this. ${CLOSED} Ask again to see the new details.` };
    }
  }
  const outcome = await saveDoctorSession(user, actionRequest(action));
  if (!outcome.ok) return { ok: false, summary: `${refusal(outcome)} ${CLOSED}` };
  const session = outcome.session;
  const what = `${session.label || "Session"}, ${session.mode} ${when(session)}, ${session.startTime}–${session.endTime}, ${session.room}`;
  const lent = outcome.notice ? ` ${outcome.notice}` : "";
  return {
    ok: true,
    summary: outcome.created ? `Added ${what}. Patients can book it now.${lent}` : `Changed ${what}. Visits already booked keep their times.${lent}`,
  };
}
