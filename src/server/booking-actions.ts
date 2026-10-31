"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { actorOf, recordEventSoon, visitSummary } from "@/lib/audit";
import { todayIso, now } from "@/lib/clock";
import type { Slot } from "@/lib/data";
import { formatMoney } from "@/lib/fees";
import { onBookingConfirmedSoon } from "@/lib/notifications/service";
import { normalisePhone } from "@/lib/phone";
import { onlinePaymentsAvailable } from "@/lib/payments/index";
import { resolveFee } from "@/lib/payments/fees";
import { beginCheckout, type CheckoutSession } from "@/lib/payments/service";
import { getStore } from "@/lib/store";
import { forgetBlockedSlots } from "@/lib/blocked-slots";
import { confirmBooking, SlotUnavailableError } from "@/lib/repository";
import { getCurrentUser, safeNext } from "@/lib/session";
import { validatePatient, FIELD_ORDER, type PatientForm } from "@/lib/validate";
import { changeAppointmentStatus } from "@/lib/visits";
import { notifyRescheduled, rescheduleVisit } from "@/lib/reschedule";

export type BookAppointmentResult =
  | {
      ok: true;
      reference: string;
      token: number | null;
      payment: { amountPence: number; paid: boolean } | null;
      /** Set when the place is held for online payment: the patient goes on to pay on /pay/<visitId>. */
      pendingPayment?: { visitId: string; checkout: CheckoutSession };
    }
  | {
      ok: false;
      reason: "past" | "taken" | "teaching" | "missing" | "invalid" | "signed-out" | "staff" | "payments-off";
      message: string;
    };

export interface BookAppointmentInput {
  slot: Slot;
  reasonId: string;
  patientName: string;
  patientDob: string;
  patientMobile: string;
  patientChi: string;
  note: string;
  /** Pay the fee online now (holds the place for a few minutes). Otherwise it's paid at the desk. */
  payOnline?: boolean;
}

export async function bookAppointment(input: BookAppointmentInput): Promise<BookAppointmentResult> {
  // Every visit belongs to a patient account, so it shows under Appointments.
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "signed-out", message: "Sign in to book this time." };
  if (user.role !== "patient") {
    return { ok: false, reason: "staff", message: "Clinic staff accounts can’t book. Sign in with a patient account." };
  }

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

  // The amount is read here from the database; the browser only says whether it wants to pay online.
  let online = false;
  if (input.payOnline === true) {
    const fee = await resolveFee(input.slot.doctorId, input.reasonId).catch(() => 0);
    if (fee > 0) {
      if (!(await onlinePaymentsAvailable())) {
        return { ok: false, reason: "payments-off", message: "Online payment isn’t switched on yet. Choose to pay at the desk instead." };
      }
      online = true;
    }
  }

  try {
    const result = await confirmBooking({
      slot: input.slot,
      reasonId: input.reasonId,
      patientName: input.patientName,
      patientDob: input.patientDob,
      patientMobile: normalisePhone(input.patientMobile) ?? input.patientMobile.trim(),
      patientChi: input.patientChi,
      note: input.note,
      patientUserId: user.id,
      payOnline: online,
    });
    const who = actorOf(user);
    await recordEventSoon({
      actor: who,
      action: "appointment.booked",
      subjectType: "appointment",
      subjectId: result.visit.id,
      summary: visitSummary(result.visit),
    });
    let pendingPayment: { visitId: string; checkout: CheckoutSession } | undefined;
    if (online) {
      try {
        pendingPayment = { visitId: result.visit.id, checkout: await beginCheckout(result.visit) };
      } catch (error) {
        // Could not start the payment: let the place go rather than hold it for nothing.
        await (await getStore()).transitionStatus(result.visit.id, "pending_payment", "expired").catch(() => undefined);
        forgetBlockedSlots();
        console.error(`[payments] Could not start checkout for ${result.reference}: ${error instanceof Error ? error.message : "unknown error"}`);
        return { ok: false, reason: "payments-off", message: "We couldn’t start the payment, so nothing has been booked. Please try again, or pay at the desk." };
      }
    } else {
      await onBookingConfirmedSoon(result.visit);
    }
    if (result.payment?.paid && result.payment.amountPence > 0) {
      await recordEventSoon({
        actor: who,
        action: "payment.received",
        subjectType: "appointment",
        subjectId: result.visit.id,
        summary: `${formatMoney(result.payment.amountPence)} by online card (demo) · ${visitSummary(result.visit)}`,
      });
    }
    await refreshBook();
    return {
      ok: true,
      reference: result.reference,
      token: result.visit.token ?? null,
      payment: result.payment,
      ...(pendingPayment ? { pendingPayment } : {}),
    };
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

/**
 * Move a visit to another time with the same doctor. Used by the reschedule page for patients,
 * doctors and the desk. On a clash the person goes back to the same page with the reason.
 */
export async function rescheduleAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const slot = String(formData.get("slot") ?? "");
  const returnTo = safeNext(String(formData.get("return") ?? "/appointments"));
  const here = `/reschedule/${encodeURIComponent(id)}?return=${encodeURIComponent(returnTo)}`;
  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(here)}`);
  if (!slot) redirect(withNotice(here, "pick"));

  const outcome = await rescheduleVisit(user, id, slot, String(formData.get("reason") ?? ""));
  await refreshBook();
  if (!outcome.ok) redirect(withNotice(here, outcome.reason));
  const { visit, history } = outcome;
  try {
    after(() => notifyRescheduled(user, visit, history));
  } catch {
    await notifyRescheduled(user, visit, history);
  }
  redirect(withNotice(returnTo, "moved"));
}
