"use server";

import { revalidatePath } from "next/cache";
import { recordFailedAttempt, beginCheckout, verifyCheckout, PaymentError, PaymentNotConfiguredError, type CheckoutSession } from "@/lib/payments/service";
import { releaseExpiredHolds } from "@/lib/payments/holds";
import { getCurrentUser } from "@/lib/session";
import { getStore } from "@/lib/store";
import { getOps } from "@/lib/ops";

export type StartCheckoutResult =
  | { ok: true; session: CheckoutSession }
  | { ok: false; code: "signed-out" | "missing" | "not-configured" | "paid" | "expired" | "not-pending" | "error"; message: string };

/** The patient's own visit, or null. Payments are only ever started or confirmed by the person who booked. */
async function ownVisit(visitId: string) {
  const user = await getCurrentUser();
  if (!user) return { user: null, visit: null } as const;
  const visit = await (await getStore()).getAppointment(visitId);
  if (!visit || visit.patientUserId !== user.id) return { user, visit: null } as const;
  return { user, visit } as const;
}

function refresh(): void {
  try {
    revalidatePath("/", "layout");
  } catch {
    // outside Next.js (tests)
  }
}

/** Open (or reopen) the provider order for a held visit. The amount comes from the database, not the browser. */
export async function startCheckoutAction(visitId: string): Promise<StartCheckoutResult> {
  const { user, visit } = await ownVisit(visitId);
  if (!user) return { ok: false, code: "signed-out", message: "Sign in to pay for this visit." };
  if (!visit) return { ok: false, code: "missing", message: "We couldn’t find that visit." };
  await releaseExpiredHolds();
  const fresh = (await (await getStore()).getAppointment(visitId)) ?? visit;
  try {
    return { ok: true, session: await beginCheckout(fresh) };
  } catch (error) {
    if (error instanceof PaymentNotConfiguredError) {
      return { ok: false, code: "not-configured", message: "Online payment isn’t switched on yet. You can pay at the desk." };
    }
    if (error instanceof PaymentError) {
      const code = error.code === "already_paid" ? "paid" : error.code === "hold_expired" ? "expired" : "not-pending";
      return { ok: false, code, message: error.message };
    }
    console.error(`[payments] Checkout failed to start: ${error instanceof Error ? error.message : "unknown error"}`);
    return { ok: false, code: "error", message: "We couldn’t start the payment. Please try again." };
  }
}

export interface VerifyInput {
  visitId: string;
  orderId: string;
  paymentId: string;
  signature: string;
}

export type VerifyPaymentResult =
  | { ok: true; status: "confirmed" | "refunded_late" | "pending"; message: string }
  | { ok: false; message: string };

/** Razorpay Checkout finished in the browser. The server checks the signature before it believes it. */
export async function verifyPaymentAction(input: VerifyInput): Promise<VerifyPaymentResult> {
  const { user, visit } = await ownVisit(input.visitId);
  if (!user || !visit) return { ok: false, message: "We couldn’t find that visit." };
  const payment = await (await getOps()).getPaymentByAppointment(visit.id);
  if (!payment) return { ok: false, message: "We couldn’t find that payment." };
  try {
    const result = await verifyCheckout(payment.id, { orderId: input.orderId, paymentId: input.paymentId, signature: input.signature });
    refresh();
    if (result.status === "confirmed") return { ok: true, status: "confirmed", message: "Payment received. Your appointment is confirmed." };
    if (result.status === "refunded_late") {
      return {
        ok: true,
        status: "refunded_late",
        message: "Your payment arrived after the time to pay ran out and the place was taken. We have started a full refund.",
      };
    }
    return { ok: true, status: "pending", message: result.message };
  } catch (error) {
    if (error instanceof PaymentError) return { ok: false, message: error.message };
    console.error(`[payments] Verify failed: ${error instanceof Error ? error.message : "unknown error"}`);
    return { ok: false, message: "We couldn’t confirm the payment yet. If money left your account, it will be confirmed shortly or refunded." };
  }
}

/** Checkout reported a failed attempt (declined card, closed window). The place stays held until it runs out. */
export async function reportPaymentFailureAction(visitId: string, reason: string): Promise<void> {
  const { visit } = await ownVisit(visitId);
  if (!visit) return;
  const payment = await (await getOps()).getPaymentByAppointment(visit.id);
  if (!payment) return;
  await recordFailedAttempt(payment.id, reason.slice(0, 200) || "The payment did not go through.");
  refresh();
}
