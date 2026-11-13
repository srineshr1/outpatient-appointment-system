/**
 * Saving a doctor's consulting session: every rule the Schedule editor applies (dates, hours,
 * stream or wave, clashes with other sessions, booked visits that would no longer fit, a stream
 * shift, legacy store limits) and the write itself. The Schedule editor's server action and the
 * clinic assistant both use this, so there is one write path.
 *
 * Not a server action: callers check who is signed in and pass the user.
 */
import { revalidatePath } from "next/cache";
import { recordEvent, actorOf } from "./audit";
import { forgetBlockedSlots } from "./blocked-slots";
import { BLOB_NO_REBOOKING } from "./blob-store";
import type { ConsultSession, PublicUser } from "./clinic-types";
import { now, practiceWallClock, todayIso } from "./clock";
import { loadDoctors } from "./doctors";
import { isUpcomingVisit, occupiesTime, sessionStructureChanged, stillFits } from "./elastic-scheduling";
import { displaceAndSave, displacedBy } from "./rebooking";
import { checkSession, newAbsorptions, planAbsorption, planStreamShift, visitWhenLabel, type SessionInput, type StreamMove } from "./sessions";
import { shiftAndSave, shiftCandidates, shiftLines, shiftMovable } from "./stream-shift";
import { getStore } from "./store";

export interface SessionSaveRequest {
  /** The session to change, or null to add one. */
  id: string | null;
  input: SessionInput;
  /** The form left out the wave length: an old multi-wave session keeps its saved step. */
  waveMinutesOmitted: boolean;
  /** "Notify them and offer new times", confirmed for this many patients. */
  displace: { expected: number; reason: string } | null;
  /** "Move them to later slots", confirmed for this many patients. */
  shiftCount: number | null;
  /**
   * The Schedule editor's "take free hours from another session" tick. Left out by callers (such as
   * the clinic assistant) whose own confirmation step already showed the doctor that notice.
   */
  absorbConfirmed?: boolean;
  /** Run every check and stop before anything is written. */
  dryRun?: boolean;
}

export type SessionSaveOutcome =
  | {
      ok: true;
      created: boolean;
      session: ConsultSession;
      previous: ConsultSession | null;
      /** Set when the change takes free time from another session ("lent"). */
      notice: string | null;
      displaced: number;
      shifted: number;
      written: boolean;
    }
  | { ok: false; message: string; displace?: { count: number; times: string[] }; shift?: { count: number; lines: string[] } };

function refresh(): void {
  try {
    revalidatePath("/", "layout");
  } catch {
    // Unit tests run outside the Next.js cache.
  }
}

/** Visits still to come that were booked into this session. */
export async function upcomingIn(doctorId: string, sessionId: string): Promise<number> {
  const today = todayIso(now());
  const visits = await (await getStore()).listAppointments({ doctorId });
  return visits.filter((visit) => isUpcomingVisit(visit) && visit.sessionId === sessionId && visit.date >= today).length;
}

/** "5 Jan, 11:30" for the first few displaced visits. */
function timesOf(visits: readonly { date: string; time: string }[]): string[] {
  return visits.map(visitWhenLabel);
}

export function legacyBlobStore(): boolean {
  return process.env.DATA_STORE !== "supabase" && Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/** Only a doctor who owns their own book may change its sessions. */
export function ownsBook(user: PublicUser): boolean {
  return user.role === "doctor" && user.doctorId === user.id;
}

export async function saveDoctorSession(user: PublicUser, request: SessionSaveRequest): Promise<SessionSaveOutcome> {
  if (!ownsBook(user)) return { ok: false, message: "Only a doctor can change their own consulting sessions." };
  const store = await getStore();
  const id = request.id ?? "";
  const input: SessionInput = { ...request.input };
  const fail = (message: string): Extract<SessionSaveOutcome, { ok: false }> => ({ ok: false, message });

  const mine = (await store.listConsultSessions(user.id)).filter((session) => !session.archivedAt);
  const existing = id ? await store.getConsultSession(id) : null;
  if (id && (!existing || existing.doctorId !== user.id || existing.archivedAt)) return fail("That session no longer exists. Reload the page.");

  // Old multi-wave sessions have no duration control in today's form; retain their saved step.
  if (existing?.mode === "wave" && input.mode === "wave" && request.waveMinutesOmitted) {
    input.waveMinutes = existing.waveMinutes;
  }

  const today = todayIso(now());
  // A weekly session saved before dates were required may stay open-ended, so it can still be resized.
  const keepOpenRange = Boolean(existing && !existing.onDate && !existing.startDate && !existing.endDate);
  // A new one-off today, or one moved to start at another time today, must not start in the past.
  const wall = practiceWallClock(now());
  const startMoved = !existing || existing.startTime !== input.startTime || (existing.onDate ?? null) !== input.onDate;
  const checked = checkSession(input, mine.filter((session) => session.id !== id), today, {
    keepOpenRange,
    nowMinutes: startMoved ? wall.hour * 60 + wall.minute : undefined,
  });
  if (!checked.ok) return fail(checked.message);

  const at = now().toISOString();
  const session: ConsultSession = existing
    ? { ...existing, ...checked.value, updatedAt: at }
    : { id: `s${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`, doctorId: user.id, ...checked.value, archivedAt: null, createdAt: at, updatedAt: at };

  // Recurrence, mode, step and capacity may change while reservations exist only when every one of
  // them still fits; the rest must be moved first or, once the doctor confirms, displaced and offered
  // new times (below). The legacy Blob store cannot displace, so it keeps the old rule.
  const structural = Boolean(existing && sessionStructureChanged(existing, session));
  if (existing && structural && legacyBlobStore()) {
    const upcoming = await upcomingIn(user.id, existing.id);
    if (upcoming > 0) {
      return fail(
        `${upcoming} reserved ${upcoming === 1 ? "visit uses" : "visits use"} this session. Move or cancel ${upcoming === 1 ? "it" : "them"} first, or add a new session instead. You can still change its hours, name or room. Existing visits and payment holds keep their original times.`,
      );
    }
  }

  const [appointments, storedTrims] = await Promise.all([
    store.listAppointments({ doctorId: user.id }),
    store.listSessionTrims(user.id),
  ]);

  // Elastic scheduling: hour changes must not strand booked visits. Expansion is always safe; a
  // shrink that would leave a booking outside the new hours is refused, unless the doctor explicitly
  // confirms "Notify them and offer new times" (displaced patient rebooking).
  const tentativeOccupying = appointments
    .filter((visit) => occupiesTime(visit) && visit.date >= today && (!existing || visit.sessionId !== existing.id || stillFits(visit, session)))
    .map((visit) => ({ date: visit.date, time: visit.time, endTime: visit.endTime ?? null, sessionId: visit.sessionId ?? null }));
  const tentativePlan = planAbsorption(session, mine.filter((item) => item.id !== session.id), tentativeOccupying, today, storedTrims);
  const potentialTrims = tentativePlan.ok ? tentativePlan.trims : [];

  const stranded = existing
    ? displacedBy(appointments, existing, session, today, potentialTrims)
    : displacedBy(appointments, session, session, today, potentialTrims);
  const confirmed = request.displace;
  if (stranded.length > 0) {
    const total = appointments.filter((visit) => visit.status === "booked" && (existing ? visit.sessionId === existing.id : true) && visit.date >= today).length;
    const times = timesOf(stranded);
    const more = stranded.length > 3 ? ` and ${stranded.length - 3} more` : "";
    const message = structural
      ? `${stranded.length} ${stranded.length === 1 ? "reservation no longer fits" : "reservations no longer fit"} the changed session (${times.slice(0, 3).join(", ")}${more}): fewer places, another slot length or wave interval, or other days. Move or cancel ${stranded.length === 1 ? "it" : "them"} first, or notify ${stranded.length === 1 ? "the patient" : "them"} and offer new times.`
      : `${stranded.length} of ${total} booked ${stranded.length === 1 ? "visit falls" : "visits fall"} outside the new hours (${times.slice(0, 3).join(", ")}${more}). Move or cancel ${stranded.length === 1 ? "it" : "them"} first, add a new session instead, or notify ${stranded.length === 1 ? "the patient" : "them"} and offer new times.`;
    if (!confirmed || confirmed.expected !== stranded.length) {
      const refused = fail(confirmed ? `The number of affected patients changed to ${stranded.length}. Check and confirm again.` : message);
      return { ...refused, displace: { count: stranded.length, times } };
    }
    if (legacyBlobStore()) return fail(BLOB_NO_REBOOKING);
  }
  const leaving = new Set(stranded.map((visit) => visit.id));
  const occupying = appointments
    .filter((visit) => occupiesTime(visit) && visit.date >= today && !leaving.has(visit.id))
    .map((visit) => ({ date: visit.date, time: visit.time, endTime: visit.endTime ?? null, sessionId: visit.sessionId ?? null }));
  let plan = planAbsorption(session, mine.filter((item) => item.id !== session.id), occupying, today, storedTrims);
  // Growing into the start of a stream where patients are booked: the stream can start later and move
  // them to its free later slots that day, once the doctor confirms. Not combined with displacing.
  let moves: StreamMove[] = [];
  if (!plan.ok && stranded.length === 0) {
    const shift = planStreamShift(
      session,
      mine.filter((item) => item.id !== session.id),
      shiftCandidates(appointments, today),
      today,
      storedTrims,
      shiftMovable(appointments),
    );
    if (shift && !shift.ok) return fail(`${shift.message} ${plan.message}`);
    if (shift) {
      const lines = shiftLines(shift.moves, appointments);
      const expected = request.shiftCount;
      if (expected !== shift.moves.length) {
        const n = shift.moves.length;
        const starts = [...new Set(shift.starts.map((start) => start.time))].join(", ");
        const message = expected === null
          ? `The other stream will start at ${starts} and ${n} ${n === 1 ? "patient moves" : "patients move"} to its next free ${n === 1 ? "slot" : "slots"}: ${lines.join("; ")}. Confirm to apply and tell ${n === 1 ? "the patient" : "them"} the new time.`
          : `The number of patients to move changed to ${n}. Check and confirm again.`;
        return { ...fail(message), shift: { count: n, lines } };
      }
      if (legacyBlobStore()) return fail(BLOB_NO_REBOOKING);
      moves = shift.moves;
      plan = { ok: true, trims: shift.trims, notice: shift.notice };
    }
  }
  if (!plan.ok) return fail(plan.message);
  // Taking free hours from another session (possibly all of them) needs an explicit yes from the doctor.
  if (moves.length === 0 && request.absorbConfirmed === false && newAbsorptions(plan.trims, storedTrims, session.id).length > 0) {
    return fail(`${plan.notice ?? "This change takes free hours from another session."} Tick the confirmation to save.`);
  }

  const hoursChanged = Boolean(existing && (existing.startTime !== session.startTime || existing.endTime !== session.endTime));
  if ((hoursChanged || plan.trims.length > 0) && process.env.DATA_STORE !== "supabase" && process.env.BLOB_READ_WRITE_TOKEN) {
    return fail("Resizing availability requires the Supabase or SQLite store. The legacy Blob store cannot safely coordinate this change.");
  }

  const planned = { created: !existing, session, previous: existing, notice: plan.notice ?? null };
  if (request.dryRun) return { ok: true, ...planned, displaced: 0, shifted: 0, written: false };

  let displaced = 0;
  let shifted = 0;
  try {
    if (moves.length > 0) {
      const result = await shiftAndSave(user, session, plan.trims, moves, appointments);
      if (!result.ok) {
        return fail(
          result.reason === "taken"
            ? "One of the later slots was booked while you confirmed. Check the session and try again."
            : "Bookings changed while you confirmed. Reload the session and try again.",
        );
      }
      shifted = result.moved.length;
    } else if (stranded.length > 0 && existing && confirmed) {
      const result = await displaceAndSave(user, existing, session, plan.trims, confirmed);
      if (!result.ok && result.reason === "changed") return fail("The number of affected patients changed. Check and confirm again.");
      if (!result.ok && result.reason !== "none") return fail("Bookings changed while you confirmed. Reload the session and try again.");
      if (result.ok) displaced = result.displaced.length;
      else await store.saveConsultSession(session, plan.trims);
    } else {
      await store.saveConsultSession(session, plan.trims);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("Reserved sessions may change")) {
      return fail("A visit was reserved or changed while you edited, and it no longer fits this change. Reload the session and try again.");
    }
    throw error;
  }
  forgetBlockedSlots();
  await loadDoctors(true);
  await recordEvent({
    actor: actorOf(user),
    action: existing ? "consult.updated" : "consult.created",
    subjectType: "user",
    subjectId: user.id,
    summary: `${session.label || "Session"} · ${session.mode} · ${session.startTime}–${session.endTime}`,
  });
  refresh();
  return { ok: true, ...planned, displaced, shifted, written: true };
}
