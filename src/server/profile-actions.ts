"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordEvent, actorOf } from "@/lib/audit";
import type { ConsultSession, PublicUser } from "@/lib/clinic-types";
import { now, todayIso } from "@/lib/clock";
import { loadDoctors } from "@/lib/doctors";
import { occupiesTime, sessionStructureChanged } from "@/lib/elastic-scheduling";
import { getOps } from "@/lib/ops";
import type { FormState } from "@/lib/form-state";
import {
  checkDoctorProfile,
  checkPatientProfile,
  doctorProfileRecord,
  patientProfileRecord,
  type DoctorProfileField,
  type PatientProfileField,
} from "@/lib/profiles";
import { forgetBlockedSlots } from "@/lib/blocked-slots";
import { BLOB_NO_REBOOKING } from "@/lib/blob-store";
import { displaceAndSave, displacedBy } from "@/lib/rebooking";
import { checkSession, planAbsorption, planStreamShift, type SessionInput, type StreamMove } from "@/lib/sessions";
import { shiftAndSave, shiftCandidates, shiftLines, shiftMovable } from "@/lib/stream-shift";
import { getCurrentUser, safeNext } from "@/lib/session";
import { getStore } from "@/lib/store";

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function values(formData: FormData, keys: string[]): Record<string, string> {
  return Object.fromEntries(keys.map((key) => [key, text(formData, key)]));
}

function refresh(): void {
  try {
    revalidatePath("/", "layout");
  } catch {
    // Unit tests run outside the Next.js cache.
  }
}

async function signedIn(next: string): Promise<PublicUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  return user;
}

/** The doctor account that owns its own book: self-signed-up doctors and admin-added ones. */
async function ownDoctor(next: string): Promise<PublicUser> {
  const user = await signedIn(next);
  if (user.role !== "doctor" || user.doctorId !== user.id) redirect("/dashboard");
  return user;
}

/* ---------- Patients ---------- */

const PATIENT_KEYS = ["name", "mobile", "dob", "gender"];

export async function savePatientProfile(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await signedIn("/profile");
  if (user.role !== "patient") redirect("/dashboard");
  const form = {
    name: text(formData, "name"),
    mobile: text(formData, "mobile"),
    dob: text(formData, "dob"),
    gender: text(formData, "gender"),
  };
  const checked = checkPatientProfile(form, todayIso(now()));
  if (!checked.ok) {
    const errors: Partial<Record<PatientProfileField, string>> = checked.errors;
    return { ok: false, message: "Check the highlighted fields.", errors: errors as Record<string, string>, values: values(formData, PATIENT_KEYS) };
  }
  const store = await getStore();
  await store.updateUser(user.id, { name: checked.value.name, mobile: checked.value.mobile, dob: checked.value.dob });
  await store.putProfile(patientProfileRecord(user.id, { gender: checked.value.gender }, now().toISOString()));
  await recordEvent({
    actor: actorOf(user),
    action: "profile.updated",
    subjectType: "user",
    subjectId: user.id,
    summary: `${checked.value.name} · patient profile`,
  });
  refresh();
  const next = safeNext(text(formData, "next") || "/");
  if (text(formData, "welcome") === "1") redirect(next === "/" ? "/book" : next);
  redirect("/profile?saved=1");
}

/* ---------- Doctors ---------- */

const DOCTOR_KEYS = ["name", "specialty", "qualification", "years", "room", "fee", "bio", "languages"];

export async function saveDoctorProfile(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await ownDoctor("/dashboard/profile");
  const name = text(formData, "name").replace(/\s+/g, " ").trim();
  const checked = checkDoctorProfile({
    specialty: text(formData, "specialty"),
    qualification: text(formData, "qualification"),
    years: text(formData, "years"),
    room: text(formData, "room"),
    fee: text(formData, "fee"),
    bio: text(formData, "bio"),
    languages: text(formData, "languages"),
  });
  const errors: Partial<Record<DoctorProfileField, string>> = checked.ok ? {} : { ...checked.errors };
  if (!name) errors.name = "Enter your name.";
  else if (name.length > 100) errors.name = "Keep the name to 100 characters.";
  if (!checked.ok || Object.keys(errors).length > 0) {
    return { ok: false, message: "Check the highlighted fields.", errors: errors as Record<string, string>, values: values(formData, DOCTOR_KEYS) };
  }
  const store = await getStore();
  await store.updateUser(user.id, { name, doctorRoom: checked.value.room, doctorInterest: checked.value.specialty });
  await store.putProfile(doctorProfileRecord(user.id, checked.value, now().toISOString()));
  // The fee that patients are charged lives in its own table, so a stored 0 can mean "free". Left blank, it stays as it was.
  if (checked.value.feePence !== null) await (await getOps()).setDoctorFee(user.id, checked.value.feePence);
  await loadDoctors(true);
  await recordEvent({
    actor: actorOf(user),
    action: "profile.updated",
    subjectType: "user",
    subjectId: user.id,
    summary: `${name} · doctor profile`,
  });
  refresh();
  if (text(formData, "welcome") === "1") redirect("/dashboard/sessions?welcome=1");
  redirect("/dashboard/profile?saved=1");
}

const SESSION_KEYS = ["label", "kind", "onDate", "startDate", "endDate", "weekdays", "startTime", "endTime", "room", "mode", "slotMinutes", "waveMinutes", "waveCapacity"];

function sessionInput(formData: FormData): SessionInput {
  const number = (key: string) => {
    const raw = text(formData, key).trim();
    return /^\d+$/.test(raw) ? Number(raw) : null;
  };
  return {
    label: text(formData, "label"),
    kind: text(formData, "kind") === "once" ? "once" : "recurring",
    onDate: text(formData, "onDate").trim() || null,
    startDate: text(formData, "startDate").trim() || null,
    endDate: text(formData, "endDate").trim() || null,
    weekdays: formData.getAll("weekdays").map((day) => Number(day)),
    startTime: text(formData, "startTime"),
    endTime: text(formData, "endTime"),
    room: text(formData, "room"),
    mode: text(formData, "mode"),
    slotMinutes: number("slotMinutes"),
    waveMinutes: number("waveMinutes"),
    waveCapacity: number("waveCapacity"),
  };
}

/** Visits still to come that were booked into this session. */
async function upcomingIn(doctorId: string, sessionId: string): Promise<number> {
  const today = todayIso(now());
  const visits = await (await getStore()).listAppointments({ doctorId });
  return visits.filter((visit) => occupiesTime(visit) && visit.sessionId === sessionId && visit.date >= today).length;
}

/** "2099-01-05 11:30" for the first few displaced visits. */
function timesOf(visits: readonly { date: string; time: string }[]): string[] {
  return visits.map((visit) => `${visit.date} ${visit.time}`);
}

/** Whether the doctor confirmed "Notify them and offer new times", and for how many patients. */
function displaceConfirmed(formData: FormData): { expected: number; reason: string } | null {
  if (text(formData, "displace") !== "confirm") return null;
  const expected = Number(text(formData, "displaceCount"));
  return Number.isInteger(expected) && expected > 0 ? { expected, reason: text(formData, "displaceReason") } : null;
}

function legacyBlobStore(): boolean {
  return process.env.DATA_STORE !== "supabase" && Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export async function saveSession(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await ownDoctor("/dashboard/sessions");
  const store = await getStore();
  const id = text(formData, "id");
  const input = sessionInput(formData);
  const typed = values(formData, SESSION_KEYS);
  const fail = (message: string): FormState => ({ ok: false, message, values: { ...typed, weekdays: formData.getAll("weekdays").join(",") } });

  const mine = (await store.listConsultSessions(user.id)).filter((session) => !session.archivedAt);
  const existing = id ? await store.getConsultSession(id) : null;
  if (id && (!existing || existing.doctorId !== user.id || existing.archivedAt)) return fail("That session no longer exists. Reload the page.");

  // Old multi-wave sessions have no duration control in today's form; retain their saved step.
  if (existing?.mode === "wave" && input.mode === "wave" && !formData.has("waveMinutes")) {
    input.waveMinutes = existing.waveMinutes;
  }

  const today = todayIso(now());
  // A weekly session saved before dates were required may stay open-ended, so it can still be resized.
  const keepOpenRange = Boolean(existing && !existing.onDate && !existing.startDate && !existing.endDate);
  const checked = checkSession(input, mine.filter((session) => session.id !== id), today, { keepOpenRange });
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
  const stranded = existing ? displacedBy(appointments, existing, session, today) : [];
  const confirmed = displaceConfirmed(formData);
  if (stranded.length > 0) {
    const total = appointments.filter((visit) => visit.status === "booked" && visit.sessionId === existing!.id && visit.date >= today).length;
    const times = timesOf(stranded);
    const more = stranded.length > 3 ? ` and ${stranded.length - 3} more` : "";
    const message = structural
      ? `${stranded.length} ${stranded.length === 1 ? "reservation no longer fits" : "reservations no longer fit"} the changed session (${times.slice(0, 3).join(", ")}${more}): fewer places, another slot length or wave interval, or other days. Move or cancel ${stranded.length === 1 ? "it" : "them"} first, or notify ${stranded.length === 1 ? "the patient" : "them"} and offer new times.`
      : `${stranded.length} of ${total} booked ${stranded.length === 1 ? "visit falls" : "visits fall"} outside the new hours (${times.slice(0, 3).join(", ")}${more}). Move or cancel ${stranded.length === 1 ? "it" : "them"} first, add a new session instead, or notify ${stranded.length === 1 ? "the patient" : "them"} and offer new times.`;
    if (!confirmed || confirmed.expected !== stranded.length) {
      const refused = fail(confirmed ? `The number of affected patients changed to ${stranded.length}. Check and confirm again.` : message)!;
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
      const expected = text(formData, "shift") === "confirm" ? Number(text(formData, "shiftCount")) : null;
      if (expected !== shift.moves.length) {
        const n = shift.moves.length;
        const starts = [...new Set(shift.starts.map((start) => start.time))].join(", ");
        const message = expected === null
          ? `The other stream will start at ${starts} and ${n} ${n === 1 ? "patient moves" : "patients move"} to its next free ${n === 1 ? "slot" : "slots"}: ${lines.join("; ")}. Confirm to apply and tell ${n === 1 ? "the patient" : "them"} the new time.`
          : `The number of patients to move changed to ${n}. Check and confirm again.`;
        return { ...fail(message)!, shift: { count: n, lines } };
      }
      if (legacyBlobStore()) return fail(BLOB_NO_REBOOKING);
      moves = shift.moves;
      plan = { ok: true, trims: shift.trims, notice: shift.notice };
    }
  }
  if (!plan.ok) return fail(plan.message);

  const hoursChanged = Boolean(existing && (existing.startTime !== session.startTime || existing.endTime !== session.endTime));
  if ((hoursChanged || plan.trims.length > 0) && process.env.DATA_STORE !== "supabase" && process.env.BLOB_READ_WRITE_TOKEN) {
    return fail("Resizing availability requires the Supabase or SQLite store. The legacy Blob store cannot safely coordinate this change.");
  }

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
  // A unique stamp: the workspace form resets only on a save that actually landed.
  const lent = plan.notice ? `&lent=${encodeURIComponent(plan.notice)}` : "";
  const moved = `${displaced > 0 ? `&displaced=${displaced}` : ""}${shifted > 0 ? `&shifted=${shifted}` : ""}`;
  redirect(`/dashboard/sessions?saved=${existing ? "updated" : "created"}&v=${now().getTime().toString(36)}${lent}${moved}`);
}

export async function archiveSession(formData: FormData): Promise<void> {
  const user = await ownDoctor("/dashboard/sessions");
  const store = await getStore();
  const session = await store.getConsultSession(text(formData, "id"));
  if (!session || session.doctorId !== user.id || session.archivedAt) redirect("/dashboard/sessions?notice=missing");
  const removed = { ...session, archivedAt: now().toISOString(), updatedAt: now().toISOString() };
  const upcoming = await upcomingIn(user.id, session.id);
  let displaced = 0;
  if (upcoming > 0) {
    // Only an explicit "Notify them and offer new times" may remove a session that has reservations.
    const stranded = displacedBy(await store.listAppointments({ doctorId: user.id }), session, removed, todayIso(now()));
    const offerable = stranded.length === upcoming && !legacyBlobStore();
    const ask = `/dashboard/sessions?notice=busy&n=${upcoming}${offerable ? `&displace=${encodeURIComponent(session.id)}` : ""}`;
    const confirmed = displaceConfirmed(formData);
    if (!confirmed || !offerable) redirect(ask);
    const result = await displaceAndSave(user, session, removed, [], confirmed).catch((error: unknown) => {
      if (error instanceof Error && error.message.includes("Reserved sessions may change")) return null;
      throw error;
    });
    if (!result || !result.ok) redirect(ask);
    displaced = result.displaced.length;
  } else {
    try {
      await store.saveConsultSession(removed, []);
    } catch (error) {
      if (error instanceof Error && error.message.includes("Reserved sessions may change")) {
        redirect("/dashboard/sessions?notice=busy&n=1");
      }
      throw error;
    }
  }
  forgetBlockedSlots();
  await loadDoctors(true);
  await recordEvent({
    actor: actorOf(user),
    action: "consult.removed",
    subjectType: "user",
    subjectId: user.id,
    summary: `${session.label || "Session"} · ${session.startTime}–${session.endTime}`,
  });
  refresh();
  redirect(`/dashboard/sessions?saved=removed${displaced > 0 ? `&displaced=${displaced}` : ""}`);
}
