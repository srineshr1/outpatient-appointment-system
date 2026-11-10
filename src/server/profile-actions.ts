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
import { findOrphanedVisits } from "@/lib/elastic";
import { checkSession, planAbsorption, type SessionInput } from "@/lib/sessions";
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

/**
 * Elastic scheduling: find booked visits that would be orphaned if the session changes shape.
 *
 * Instead of blocking every shape change, we generate the slot ids the new session would produce
 * over the dates that have bookings, and check whether each booking's slot still exists. Only
 * bookings whose slot id disappears are orphaned. This lets schedule expansion (9 AM–12 PM →
 * 8 AM–12 PM) and safe shrinks (10 AM–12 PM → 10 AM–11 AM when all bookings are before 11 AM)
 * go through, while still blocking changes that would strand a booked patient.
 */
async function orphanedVisits(
  doctorId: string,
  existing: ConsultSession,
  newSession: ConsultSession,
): Promise<{ total: number; orphaned: number; orphanedTimes: string[] }> {
  const today = todayIso(now());
  const visits = await (await getStore()).listAppointments({ doctorId });
  const upcoming = visits.filter(
    (visit) => visit.status === "booked" && visit.sessionId === existing.id && visit.date >= today,
  );
  return findOrphanedVisits(upcoming, newSession, doctorId);
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
  const checked = checkSession(input, mine.filter((session) => session.id !== id), today);
  if (!checked.ok) return fail(checked.message);

  const at = now().toISOString();
  const session: ConsultSession = existing
    ? { ...existing, ...checked.value, updatedAt: at }
    : { id: `s${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`, doctorId: user.id, ...checked.value, archivedAt: null, createdAt: at, updatedAt: at };

  // Recurrence, mode, step and capacity stay protected while reservations exist; hours, name and
  // room may change (the store keeps reserved visits and holds at their original times).
  if (existing && sessionStructureChanged(existing, session)) {
    const upcoming = await upcomingIn(user.id, existing.id);
    if (upcoming > 0) {
      return fail(
        `${upcoming} reserved ${upcoming === 1 ? "visit uses" : "visits use"} this session. Move or cancel ${upcoming === 1 ? "it" : "them"} first, or add a new session instead. You can still change its hours, name or room. Existing visits and payment holds keep their original times.`,
      );
    }
  }

  // Elastic scheduling: hour changes must not orphan booked visits. Expansion is always safe;
  // a shrink that would strand a booking outside the new hours is rejected up front instead of
  // leaving the visit outside its session's availability.
  if (existing) {
    const { total, orphaned, orphanedTimes } = await orphanedVisits(user.id, existing, session);
    if (orphaned > 0) {
      const times = orphanedTimes.slice(0, 3).join(", ");
      const more = orphaned > 3 ? ` and ${orphaned - 3} more` : "";
      return fail(
        `${orphaned} of ${total} booked ${orphaned === 1 ? "visit falls" : "visits fall"} outside the new hours (${times}${more}). Move or cancel ${orphaned === 1 ? "it" : "them"} first, or add a new session instead.`,
      );
    }
  }

  const [appointments, storedTrims] = await Promise.all([
    store.listAppointments({ doctorId: user.id }),
    store.listSessionTrims(user.id),
  ]);
  const occupying = appointments
    .filter((visit) => occupiesTime(visit) && visit.date >= today)
    .map((visit) => ({ date: visit.date, time: visit.time, endTime: visit.endTime ?? null, sessionId: visit.sessionId ?? null }));
  const plan = planAbsorption(session, mine.filter((item) => item.id !== session.id), occupying, today, storedTrims);
  if (!plan.ok) return fail(plan.message);

  const hoursChanged = Boolean(existing && (existing.startTime !== session.startTime || existing.endTime !== session.endTime));
  if ((hoursChanged || plan.trims.length > 0) && process.env.DATA_STORE !== "supabase" && process.env.BLOB_READ_WRITE_TOKEN) {
    return fail("Resizing availability requires the Supabase or SQLite store. The legacy Blob store cannot safely coordinate this change.");
  }

  try {
    await store.saveConsultSession(session, plan.trims);
  } catch (error) {
    if (error instanceof Error && error.message.includes("Reserved sessions may change")) {
      return fail("A visit was reserved while you edited. Reload the session; you can still change its hours, name or room.");
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
  redirect(`/dashboard/sessions?saved=${existing ? "updated" : "created"}&v=${now().getTime().toString(36)}${lent}`);
}

export async function archiveSession(formData: FormData): Promise<void> {
  const user = await ownDoctor("/dashboard/sessions");
  const store = await getStore();
  const session = await store.getConsultSession(text(formData, "id"));
  if (!session || session.doctorId !== user.id || session.archivedAt) redirect("/dashboard/sessions?notice=missing");
  const upcoming = await upcomingIn(user.id, session.id);
  if (upcoming > 0) redirect(`/dashboard/sessions?notice=busy&n=${upcoming}`);
  try {
    await store.saveConsultSession({ ...session, archivedAt: now().toISOString(), updatedAt: now().toISOString() }, []);
  } catch (error) {
    if (error instanceof Error && error.message.includes("Reserved sessions may change")) {
      redirect("/dashboard/sessions?notice=busy&n=1");
    }
    throw error;
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
  redirect("/dashboard/sessions?saved=removed");
}
