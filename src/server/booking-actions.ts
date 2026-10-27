"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { todayIso, now } from "@/lib/clock";
import type { Slot } from "@/lib/data";
import { confirmBooking, SlotUnavailableError } from "@/lib/repository";
import { getCurrentUser, safeNext } from "@/lib/session";
import { validatePatient, FIELD_ORDER, type PatientForm } from "@/lib/validate";
import { changeAppointmentStatus } from "@/lib/visits";

export type BookAppointmentResult =
  | { ok: true; reference: string }
  | { ok: false; reason: "past" | "taken" | "teaching" | "missing" | "invalid"; message: string };

export interface BookAppointmentInput {
  slot: Slot;
  reasonId: string;
  patientName: string;
  patientDob: string;
  patientMobile: string;
  patientChi: string;
  note: string;
  takenIds: readonly string[];
}

export async function bookAppointment(input: BookAppointmentInput): Promise<BookAppointmentResult> {
  const form: PatientForm = {
    name: input.patientName,
    dob: input.patientDob,
    mobile: input.patientMobile,
    chi: input.patientChi,
    reasonId: input.reasonId,
    note: input.note,
    isNew: false,
  };
  const errors = validatePatient(form, todayIso(now()));
  const first = FIELD_ORDER.find((key) => errors[key]);
  if (first) return { ok: false, reason: "invalid", message: errors[first] ?? "Check the form and try again." };

  const user = await getCurrentUser();
  try {
    const result = await confirmBooking({
      slot: input.slot,
      reasonId: input.reasonId,
      patientName: input.patientName,
      patientDob: input.patientDob,
      patientMobile: input.patientMobile,
      patientChi: input.patientChi,
      note: input.note,
      takenIds: input.takenIds,
      patientUserId: user?.id ?? null,
    });
    await refreshBook();
    return { ok: true, reference: result.reference };
  } catch (error) {
    if (error instanceof SlotUnavailableError) {
      const message =
        error.reason === "past"
          ? "This time has passed or closed for online booking."
          : "This time has just been taken.";
      return { ok: false, reason: error.reason, message };
    }
    return { ok: false, reason: "invalid", message: "We couldn’t reach the booking system. Nothing has been booked. Please try again." };
  }
}

export async function updateVisit(formData: FormData): Promise<void> {
  const returnTo = safeNext(String(formData.get("return") ?? "/dashboard"));
  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(returnTo)}`);

  const id = String(formData.get("id") ?? "");
  const status = formData.get("status");
  if (status !== "completed" && status !== "cancelled") redirect(withNotice(returnTo, "unavailable"));

  const outcome = await changeAppointmentStatus(user, id, status);
  await refreshBook();
  if (outcome === "ok") redirect(returnTo);
  redirect(withNotice(returnTo, outcome === "missing" ? "missing" : "unavailable"));
}

function withNotice(path: string, notice: string): string {
  const [pathname, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  params.set("notice", notice);
  return `${pathname}?${params.toString()}`;
}

async function refreshBook(): Promise<void> {
  try {
    revalidatePath("/", "layout");
  } catch {
    // Unit tests run outside the Next.js cache.
  }
}
