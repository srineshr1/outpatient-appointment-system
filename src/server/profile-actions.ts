"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordEvent, actorOf } from "@/lib/audit";
import type { PublicUser } from "@/lib/clinic-types";
import { now, todayIso } from "@/lib/clock";
import { loadDoctors } from "@/lib/doctors";
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
import { displaceAndSave, displacedBy } from "@/lib/rebooking";
import { legacyBlobStore, saveDoctorSession, upcomingIn } from "@/lib/session-save";
import type { SessionInput } from "@/lib/sessions";
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

/** Whether the doctor confirmed "Notify them and offer new times", and for how many patients. */
function displaceConfirmed(formData: FormData): { expected: number; reason: string } | null {
  if (text(formData, "displace") !== "confirm") return null;
  const expected = Number(text(formData, "displaceCount"));
  return Number.isInteger(expected) && expected > 0 ? { expected, reason: text(formData, "displaceReason") } : null;
}

export async function saveSession(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await ownDoctor("/dashboard/sessions");
  const typed = values(formData, SESSION_KEYS);
  const outcome = await saveDoctorSession(user, {
    id: text(formData, "id") || null,
    input: sessionInput(formData),
    waveMinutesOmitted: !formData.has("waveMinutes"),
    displace: displaceConfirmed(formData),
    shiftCount: text(formData, "shift") === "confirm" ? Number(text(formData, "shiftCount")) : null,
  });
  if (!outcome.ok) {
    const failed: FormState = { ok: false, message: outcome.message, values: { ...typed, weekdays: formData.getAll("weekdays").join(",") } };
    if (outcome.displace) return { ...failed, displace: outcome.displace };
    if (outcome.shift) return { ...failed, shift: outcome.shift };
    return failed;
  }
  // A unique stamp: the workspace form resets only on a save that actually landed.
  const lent = outcome.notice ? `&lent=${encodeURIComponent(outcome.notice)}` : "";
  const moved = `${outcome.displaced > 0 ? `&displaced=${outcome.displaced}` : ""}${outcome.shifted > 0 ? `&shifted=${outcome.shifted}` : ""}`;
  redirect(`/dashboard/sessions?saved=${outcome.created ? "created" : "updated"}&v=${now().getTime().toString(36)}${lent}${moved}`);
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
