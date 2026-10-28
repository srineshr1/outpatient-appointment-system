"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordEvent, actorOf } from "@/lib/audit";
import type { ConsultSession, PublicUser } from "@/lib/clinic-types";
import { now, todayIso } from "@/lib/clock";
import { loadDoctors } from "@/lib/doctors";
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
import { checkSession, type SessionInput } from "@/lib/sessions";
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

const SESSION_KEYS = ["label", "weekdays", "startTime", "endTime", "room", "mode", "slotMinutes", "waveMinutes", "waveCapacity"];

function sessionInput(formData: FormData): SessionInput {
  const number = (key: string) => {
    const raw = text(formData, key).trim();
    return /^\d+$/.test(raw) ? Number(raw) : null;
  };
  return {
    label: text(formData, "label"),
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
  return visits.filter((visit) => visit.status === "booked" && visit.sessionId === sessionId && visit.date >= today).length;
}

function shapeChanged(a: ConsultSession, b: Omit<SessionInput, "label" | "room">): boolean {
  return (
    a.mode !== b.mode ||
    a.startTime !== b.startTime ||
    a.endTime !== b.endTime ||
    a.weekdays.join(",") !== [...new Set(b.weekdays)].sort((x, y) => x - y).join(",") ||
    (a.mode === "stream" ? a.slotMinutes !== b.slotMinutes : a.waveMinutes !== b.waveMinutes || a.waveCapacity !== b.waveCapacity)
  );
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

  const checked = checkSession(input, mine.filter((session) => session.id !== id));
  if (!checked.ok) return fail(checked.message);

  if (existing && shapeChanged(existing, input)) {
    const upcoming = await upcomingIn(user.id, existing.id);
    if (upcoming > 0) {
      return fail(
        `${upcoming} booked ${upcoming === 1 ? "visit uses" : "visits use"} this session. Move or cancel ${upcoming === 1 ? "it" : "them"} first, or add a new session instead. You can still rename it or change its room.`,
      );
    }
  }

  const at = now().toISOString();
  const session: ConsultSession = existing
    ? { ...existing, ...checked.value, updatedAt: at }
    : { id: `s${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`, doctorId: user.id, ...checked.value, archivedAt: null, createdAt: at, updatedAt: at };
  await store.putConsultSession(session);
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
  redirect(`/dashboard/sessions?saved=${existing ? "updated" : "created"}`);
}

export async function archiveSession(formData: FormData): Promise<void> {
  const user = await ownDoctor("/dashboard/sessions");
  const store = await getStore();
  const session = await store.getConsultSession(text(formData, "id"));
  if (!session || session.doctorId !== user.id || session.archivedAt) redirect("/dashboard/sessions?notice=missing");
  const upcoming = await upcomingIn(user.id, session.id);
  if (upcoming > 0) redirect(`/dashboard/sessions?notice=busy&n=${upcoming}`);
  await store.putConsultSession({ ...session, archivedAt: now().toISOString(), updatedAt: now().toISOString() });
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
