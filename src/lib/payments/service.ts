/**
 * Payments and refunds. Everything that moves money or confirms a visit because of money lives here, behind
 * the PaymentProvider interface, and is shared by the browser path (verify after Checkout) and the
 * webhook path so a payment is only ever confirmed one way.
 *
 * The rules this file keeps:
 *  - The amount always comes from the database fee, never from the browser.
 *  - A payment is believed only after its signature checks out (browser) or the webhook is signed.
 *  - Confirming a payment and booking the held visit happen in one database transaction.
 *  - Every webhook event is stored by id first, so a repeat does nothing.
 *  - A refund row is written before the provider is called, one active refund per payment, and the
 *    provider call carries an idempotency key, so a retry or a double click cannot refund twice.
 */
import { SYSTEM_ACTOR, recordEvent, visitSummary } from "../audit";
import { forgetBlockedSlots } from "../blocked-slots";
import { recordOnlinePayment, recordOnlineRefund } from "../billing";
import type { AppointmentRecord } from "../clinic-types";
import { now } from "../clock";
import { findDoctor } from "../data";
import { CURRENCY, formatMoney } from "../fees";
import { dispatchSoon, onBookingConfirmed, queueNotice } from "../notifications/service";
import { getOps } from "../ops";
import type { ConfirmOutcome, OpsStore, PaymentRecord, RefundKind, RefundRecord } from "../ops/types";
import { slotStart } from "../schedule";
import { getStore } from "../store";
import { resolveFee } from "./fees";
import { getPaymentProvider } from "./index";
import { PaymentNotConfiguredError, ProviderError, type CheckoutProof, type ProviderEvent } from "./provider";
import { computeRefund, normalisePolicy, type CancelledBy, type RefundDecision } from "./refund-policy";

export { PaymentNotConfiguredError } from "./provider";

const DEFAULT_HOLD_MINUTES = 15;

export class PaymentError extends Error {
  constructor(
    message: string,
    readonly code: "not_found" | "not_pending" | "already_paid" | "hold_expired" | "bad_signature" | "mismatch" | "free",
  ) {
    super(message);
    this.name = "PaymentError";
  }
}

export async function holdMinutes(ops?: OpsStore): Promise<number> {
  const raw = await (ops ?? (await getOps())).getSetting("hold_minutes");
  const minutes = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(minutes) && minutes >= 5 && minutes <= 60 ? Math.round(minutes) : DEFAULT_HOLD_MINUTES;
}

// --- Checkout --------------------------------------------------------------------------------

/** What the browser needs to open Razorpay Checkout. No secrets. */
export interface CheckoutSession {
  paymentId: string;
  provider: string;
  publicKey: string;
  orderId: string;
  amountMinor: number;
  currency: string;
  holdExpiresAt: string;
  reference: string;
  description: string;
  patientName: string;
}

function describe(visit: AppointmentRecord): string {
  return `Consultation with ${findDoctor(visit.doctorId)?.name ?? "the practice"}`;
}

function sessionOf(payment: PaymentRecord, visit: AppointmentRecord, publicKey: string): CheckoutSession {
  return {
    paymentId: payment.id,
    provider: payment.provider,
    publicKey,
    orderId: payment.providerOrderId ?? "",
    amountMinor: payment.amountMinor,
    currency: payment.currency,
    holdExpiresAt: payment.holdExpiresAt,
    reference: visit.reference,
    description: describe(visit),
    patientName: visit.patientName,
  };
}

/**
 * Start (or resume) paying for a held visit: create the provider order for the amount in the database.
 * Asking again for the same visit returns the same order, so refreshing the page never creates a second charge.
 */
export async function beginCheckout(visit: AppointmentRecord): Promise<CheckoutSession> {
  const provider = getPaymentProvider();
  if (!provider.isConfigured()) throw new PaymentNotConfiguredError();
  const ops = await getOps();
  if (visit.status !== "pending_payment") {
    throw new PaymentError(visit.status === "booked" ? "This visit is already paid for." : "This visit is not waiting for payment.", visit.status === "booked" ? "already_paid" : "not_pending");
  }
  const existing = await ops.getPaymentByAppointment(visit.id);
  if (existing) {
    if (existing.status === "captured") throw new PaymentError("This visit is already paid for.", "already_paid");
    if (existing.status === "expired" || new Date(existing.holdExpiresAt).getTime() <= now().getTime()) {
      throw new PaymentError("The time to pay has run out and the place was released.", "hold_expired");
    }
    return sessionOf(existing, visit, provider.publicKey() ?? "");
  }
  const amountMinor = await resolveFee(visit.doctorId, visit.reasonId);
  if (amountMinor <= 0) throw new PaymentError("This visit has no fee to pay.", "free");
  const order = await provider.createOrder({
    amountMinor,
    currency: CURRENCY,
    receipt: visit.reference,
    notes: { appointment_id: visit.id, reference: visit.reference },
  });
  const payment: PaymentRecord = {
    id: crypto.randomUUID(),
    appointmentId: visit.id,
    provider: provider.name,
    providerOrderId: order.id,
    providerPaymentId: null,
    amountMinor,
    currency: CURRENCY,
    status: "created",
    failureReason: "",
    method: "",
    holdExpiresAt: new Date(now().getTime() + (await holdMinutes(ops)) * 60_000).toISOString(),
    createdAt: now().toISOString(),
    paidAt: null,
  };
  if ((await ops.createPayment(payment)) === "exists") {
    const raced = await ops.getPaymentByAppointment(visit.id);
    if (raced) return sessionOf(raced, visit, provider.publicKey() ?? "");
  }
  return sessionOf(payment, visit, provider.publicKey() ?? "");
}

export type SettleResult =
  | { status: "confirmed"; appointmentId: string }
  | { status: "refunded_late"; appointmentId: string }
  | { status: "unknown" };

/**
 * A payment is real: confirm the visit. The one place that does so, used by the browser's verify step and
 * by webhooks, so whichever arrives first wins and the other finds the work already done.
 */
export async function settlePaid(paymentId: string, providerPaymentId: string | null, method: string): Promise<SettleResult> {
  const ops = await getOps();
  const result = await ops.confirmPayment(paymentId, providerPaymentId, method);
  return afterConfirm(ops, paymentId, result.outcome, result.appointmentId);
}

async function afterConfirm(ops: OpsStore, paymentId: string, outcome: ConfirmOutcome, appointmentId?: string): Promise<SettleResult> {
  if (outcome === "not_found" || !appointmentId) return { status: "unknown" };
  const payment = await ops.getPayment(paymentId);
  const visit = await (await getStore()).getAppointment(appointmentId);
  if (!payment || !visit) return { status: "unknown" };
  forgetBlockedSlots();

  if (outcome === "slot_lost") {
    // The money arrived but the place is gone (the hold expired and someone else booked it, or the visit
    // was cancelled meanwhile). Give it all back and say so.
    await recordEvent({
      actor: SYSTEM_ACTOR,
      action: "payment.captured",
      subjectType: "appointment",
      subjectId: visit.id,
      summary: `${formatMoney(payment.amountMinor)} arrived after the place was released; refunding in full · ${visitSummary(visit)}`,
    });
    await issueRefund({
      payment,
      visit,
      kind: "late_payment",
      amountMinor: payment.amountMinor,
      percent: 100,
      reason: "Payment arrived after the held place was released and it is no longer available.",
      notifyInitiated: true,
    });
    await dispatchSoon();
    return { status: "refunded_late", appointmentId: visit.id };
  }

  if (outcome === "confirmed" || outcome === "late_confirmed") {
    // Do each follow-up on its own so one failing never leaves the visit unconfirmed: the visit is already booked.
    await recordOnlinePayment(visit, payment.id, payment.amountMinor, `Online payment ${payment.providerPaymentId ?? ""}`.trim()).catch(logFailure("ledger"));
    await queueNotice("payment_confirmed", visit, {
      dedupe: `payment_confirmed:${payment.id}`,
      extra: { amountMinor: payment.amountMinor, paymentId: payment.id, path: `/receipt/${payment.id}` },
    });
    await onBookingConfirmed(visit, { amountMinor: payment.amountMinor });
    await recordEvent({
      actor: SYSTEM_ACTOR,
      action: "payment.captured",
      subjectType: "appointment",
      subjectId: visit.id,
      summary: `${formatMoney(payment.amountMinor)} by ${payment.method || "online payment"}${outcome === "late_confirmed" ? " (after the hold ran out, place still free)" : ""} · ${visitSummary(visit)}`,
    });
  }
  await dispatchSoon();
  return { status: "confirmed", appointmentId: visit.id };
}

function logFailure(what: string) {
  return (error: unknown) => console.error(`[payments] ${what} failed: ${error instanceof Error ? error.message : "unknown error"}`);
}

export type VerifyResult =
  | { status: "confirmed"; appointmentId: string }
  | { status: "refunded_late"; appointmentId: string }
  | { status: "pending"; message: string };

/**
 * The browser says it paid. Believe it only if the signature is right and the order is ours. If the
 * provider cannot be asked to capture right now, the visit stays held and the webhook finishes the job.
 */
export async function verifyCheckout(paymentId: string, proof: CheckoutProof): Promise<VerifyResult> {
  const provider = getPaymentProvider();
  const ops = await getOps();
  const payment = await ops.getPayment(paymentId);
  if (!payment) throw new PaymentError("We could not find that payment.", "not_found");
  if (!payment.providerOrderId || proof.orderId !== payment.providerOrderId) {
    throw new PaymentError("That payment does not belong to this visit.", "mismatch");
  }
  if (!provider.verifyCheckout(proof)) throw new PaymentError("We could not verify that payment.", "bad_signature");
  try {
    await provider.ensureCaptured(proof.paymentId, payment.amountMinor, payment.currency);
  } catch (error) {
    if (error instanceof ProviderError && error.transient) {
      return { status: "pending", message: "Your payment went through and we are confirming it. This page will update shortly." };
    }
    throw error;
  }
  const settled = await settlePaid(payment.id, proof.paymentId, "");
  if (settled.status === "unknown") throw new PaymentError("We could not find that visit.", "not_found");
  return settled;
}

/** The patient closed Checkout or the card was declined: the place stays held until it runs out. */
export async function recordFailedAttempt(paymentId: string, reason: string, providerPaymentId?: string): Promise<boolean> {
  const ops = await getOps();
  const marked = await ops.markPaymentFailed(paymentId, reason, providerPaymentId);
  if (!marked) return false;
  const payment = await ops.getPayment(paymentId);
  const visit = payment ? await (await getStore()).getAppointment(payment.appointmentId) : null;
  if (payment && visit && visit.status === "pending_payment") {
    await queueNotice("payment_failed", visit, {
      dedupe: `payment_failed:${payment.id}:${providerPaymentId ?? "attempt"}`,
      extra: { detail: reason, path: `/pay/${visit.id}` },
    });
    await dispatchSoon();
  }
  return true;
}

// --- Refunds ---------------------------------------------------------------------------------

export interface IssueRefundInput {
  payment: PaymentRecord;
  visit: AppointmentRecord;
  kind: RefundKind;
  amountMinor: number;
  percent: number;
  reason: string;
  /** Send a separate "refund initiated" email (cancellations put the same line in the cancellation email). */
  notifyInitiated?: boolean;
  /** Retry number, 0 for the first attempt. */
  attempt?: number;
}

export interface IssueRefundResult {
  refund: RefundRecord | null;
  /** "created": new. "existing": an active refund was already there, nothing was done twice. */
  outcome: "created" | "existing" | "nothing";
}

function refundKey(payment: PaymentRecord, kind: RefundKind, attempt: number): string {
  return `refund:${payment.id}:${kind}${attempt > 0 ? `:r${attempt}` : ""}`;
}

/**
 * Refund part or all of a captured payment through the provider. The row is saved first (pending), so a crash
 * after the provider call leaves a record the retry can pick up; the idempotency key makes the retry safe.
 */
export async function issueRefund(input: IssueRefundInput): Promise<IssueRefundResult> {
  const ops = await getOps();
  const { payment } = input;
  if (payment.status !== "captured" || !payment.providerPaymentId || input.amountMinor <= 0) return { refund: null, outcome: "nothing" };
  const amountMinor = Math.min(input.amountMinor, payment.amountMinor);
  const at = now().toISOString();
  const row: RefundRecord = {
    id: crypto.randomUUID(),
    paymentId: payment.id,
    appointmentId: payment.appointmentId,
    amountMinor,
    currency: payment.currency,
    status: "pending",
    kind: input.kind,
    reason: input.reason.slice(0, 300),
    policyPercent: input.percent,
    idempotencyKey: refundKey(payment, input.kind, input.attempt ?? 0),
    providerRefundId: null,
    failureReason: "",
    createdAt: at,
    updatedAt: at,
    processedAt: null,
  };
  const created = await ops.createRefund(row);
  if (created !== "ok") {
    const existing = (await ops.listRefunds({ paymentId: payment.id })).find((refund) => refund.status === "pending" || refund.status === "processed" || refund.idempotencyKey === row.idempotencyKey);
    return { refund: existing ?? null, outcome: "existing" };
  }
  const refund = await submitRefund(ops, row, payment, input.visit);
  if (input.notifyInitiated && refund.status === "pending") {
    await queueNotice("refund_initiated", input.visit, {
      dedupe: `refund_initiated:${refund.id}`,
      extra: { refundMinor: refund.amountMinor, detail: input.reason, paymentId: payment.id, path: "/payments" },
    });
  }
  await recordEvent({
    actor: SYSTEM_ACTOR,
    action: "refund.initiated",
    subjectType: "appointment",
    subjectId: input.visit.id,
    summary: `${formatMoney(refund.amountMinor)} (${input.percent}%) · ${visitSummary(input.visit)}`,
    reason: input.reason,
  });
  await dispatchSoon();
  return { refund, outcome: "created" };
}

/** Call the provider for a saved refund row and record what it said. Used for the first try and for retries. */
async function submitRefund(ops: OpsStore, row: RefundRecord, payment: PaymentRecord, visit: AppointmentRecord): Promise<RefundRecord> {
  const provider = getPaymentProvider();
  try {
    const result = await provider.createRefund({
      providerPaymentId: payment.providerPaymentId!,
      amountMinor: row.amountMinor,
      idempotencyKey: row.idempotencyKey,
      notes: { refund_id: row.id, appointment_id: row.appointmentId },
    });
    const updated = await ops.updateRefund(row.id, { providerRefundId: result.id });
    if (result.status === "processed") return (await applyRefundStatus(ops, updated ?? row, "processed", "")) ?? row;
    if (result.status === "failed") return (await applyRefundStatus(ops, updated ?? row, "failed", "The provider could not process the refund.")) ?? row;
    return updated ?? row;
  } catch (error) {
    const message = error instanceof Error ? error.message : "The refund could not be sent.";
    if (error instanceof ProviderError && error.transient) {
      // Leave it pending with no provider id: the cron tries again with the same key.
      await ops.updateRefund(row.id, { failureReason: message });
      return { ...row, failureReason: message };
    }
    return (await applyRefundStatus(ops, row, "failed", message)) ?? row;
  }
}

/** Move a refund to the status the provider reports. Never moves a finished refund backwards. */
export async function applyRefundStatus(
  ops: OpsStore,
  refund: RefundRecord,
  status: "pending" | "processed" | "failed",
  failureReason: string,
): Promise<RefundRecord | null> {
  if (refund.status === "processed") return refund;
  if (status === "pending") return refund;
  if (status === refund.status && status === "failed") return refund;
  const patch =
    status === "processed"
      ? { status: "processed" as const, processedAt: now().toISOString(), failureReason: "" }
      : { status: "failed" as const, failureReason };
  const updated = await ops.updateRefund(refund.id, patch);
  const visit = await (await getStore()).getAppointment(refund.appointmentId);
  if (!updated || !visit) return updated;
  if (status === "processed") {
    await recordOnlineRefund(visit, refund.id, refund.amountMinor, `Online refund ${refund.providerRefundId ?? ""}`.trim()).catch(logFailure("ledger"));
    await queueNotice("refund_completed", visit, {
      dedupe: `refund_completed:${refund.id}`,
      extra: { refundMinor: refund.amountMinor, paymentId: refund.paymentId, path: "/payments" },
    });
    await recordEvent({
      actor: SYSTEM_ACTOR,
      action: "refund.completed",
      subjectType: "appointment",
      subjectId: visit.id,
      summary: `${formatMoney(refund.amountMinor)} · ${visitSummary(visit)}`,
    });
  } else {
    await queueNotice("refund_failed", visit, {
      dedupe: `refund_failed:${refund.id}`,
      extra: { refundMinor: refund.amountMinor, detail: failureReason, paymentId: refund.paymentId },
    });
    await recordEvent({
      actor: SYSTEM_ACTOR,
      action: "refund.failed",
      subjectType: "appointment",
      subjectId: visit.id,
      summary: `${formatMoney(refund.amountMinor)} · ${visitSummary(visit)}`,
      reason: failureReason,
    });
  }
  await dispatchSoon();
  return updated;
}

export interface CancellationRefund {
  decision: RefundDecision;
  refund: RefundRecord | null;
  payment: PaymentRecord;
}

/**
 * Refund what the policy allows for a cancelled visit that was paid online. Null when the visit was not
 * paid through the payment system (the old desk and demo flow then applies).
 */
export async function refundForCancellation(visit: AppointmentRecord, cancelledBy: CancelledBy, actorName: string): Promise<CancellationRefund | null> {
  const ops = await getOps();
  const payment = await ops.getPaymentByAppointment(visit.id);
  if (!payment || payment.status !== "captured") return null;
  const policy = normalisePolicy(await ops.getSetting("refund_policy"));
  const decision = computeRefund({ paidMinor: payment.amountMinor, startsAt: slotStart(visit), cancelledAt: now(), cancelledBy, policy });
  if (decision.refundMinor <= 0) return { decision, refund: null, payment };
  const { refund } = await issueRefund({
    payment,
    visit,
    kind: cancelledBy === "clinic" ? "doctor_cancel" : "patient_cancel",
    amountMinor: decision.refundMinor,
    percent: decision.percent,
    reason: `${decision.explanation} (cancelled by ${actorName})`,
  });
  return { decision, refund, payment };
}

/** Retry refunds the provider never acknowledged, and ones it refused outright (up to three tries). */
export async function retryRefunds(): Promise<number> {
  const ops = await getOps();
  let retried = 0;
  const cutoff = now().getTime() - 2 * 60_000;
  for (const refund of await ops.listRefunds({ status: "pending" })) {
    if (refund.providerRefundId || new Date(refund.updatedAt).getTime() > cutoff) continue;
    const payment = await ops.getPayment(refund.paymentId);
    const visit = await (await getStore()).getAppointment(refund.appointmentId);
    if (!payment || !visit) continue;
    await submitRefund(ops, refund, payment, visit);
    retried += 1;
  }
  for (const refund of await ops.listRefunds({ status: "failed" })) {
    if (refund.providerRefundId || new Date(refund.updatedAt).getTime() > now().getTime() - 10 * 60_000) continue;
    const history = (await ops.listRefunds({ paymentId: refund.paymentId })).filter((other) => other.kind === refund.kind);
    if (history.length >= 3 || history.some((other) => other.status !== "failed")) continue;
    const payment = await ops.getPayment(refund.paymentId);
    const visit = await (await getStore()).getAppointment(refund.appointmentId);
    if (!payment || !visit) continue;
    await issueRefund({ payment, visit, kind: refund.kind, amountMinor: refund.amountMinor, percent: refund.policyPercent, reason: refund.reason, attempt: history.length });
    retried += 1;
  }
  return retried;
}

// --- Webhooks --------------------------------------------------------------------------------

export interface WebhookResponse {
  status: number;
  body: Record<string, unknown>;
}

/** What is kept of an event: ids and amounts, not the card or contact details the provider also sends. */
function eventSummary(event: ProviderEvent): Record<string, unknown> {
  switch (event.kind) {
    case "payment_paid":
      return { type: event.type, orderId: event.orderId, paymentId: event.paymentId, amountMinor: event.amountMinor, method: event.method };
    case "payment_failed":
      return { type: event.type, orderId: event.orderId, paymentId: event.paymentId, reason: event.reason };
    case "refund_update":
      return { type: event.type, refundId: event.refundId, paymentId: event.paymentId, amountMinor: event.amountMinor, status: event.status };
    default:
      return { type: event.type };
  }
}

/**
 * Handle a provider webhook. The signature is checked on the raw body first. Events are stored by id, so a
 * repeat delivery is acknowledged without doing anything again. An error while processing returns 500 so the
 * provider redelivers, and the stored event (not yet marked processed) is picked up again.
 */
export async function handleWebhook(rawBody: string, headers: { get(name: string): string | null }): Promise<WebhookResponse> {
  const provider = getPaymentProvider();
  if (!provider.webhookConfigured()) return { status: 503, body: { error: "Webhooks are not set up." } };
  if (!provider.verifyWebhook(rawBody, headers.get("x-razorpay-signature"))) return { status: 400, body: { error: "Invalid signature." } };
  let event: ProviderEvent;
  try {
    event = provider.parseWebhook(rawBody, headers);
  } catch {
    return { status: 400, body: { error: "Unreadable event." } };
  }
  const ops = await getOps();
  const claim = await ops.claimEvent({ id: event.eventId, provider: provider.name, type: event.type, payload: eventSummary(event) });
  if (claim === "duplicate") return { status: 200, body: { ok: true, duplicate: true } };
  try {
    const outcome = await processEvent(ops, event);
    await ops.finishEvent(event.eventId, outcome);
    return { status: 200, body: { ok: true, outcome } };
  } catch (error) {
    console.error(`[payments] Webhook ${event.type} failed: ${error instanceof Error ? error.message : "unknown error"}`);
    return { status: 500, body: { error: "Could not process the event." } };
  }
}

async function processEvent(ops: OpsStore, event: ProviderEvent): Promise<string> {
  const provider = getPaymentProvider();
  switch (event.kind) {
    case "payment_paid": {
      const payment = await ops.getPaymentByOrder(event.orderId);
      if (!payment) return "unknown_order";
      if (event.amountMinor && event.amountMinor !== payment.amountMinor && event.type !== "order.paid") return "amount_mismatch";
      const providerPaymentId = event.paymentId || payment.providerPaymentId;
      if (!providerPaymentId) return "no_payment_id";
      if (event.type === "payment.authorized") await provider.ensureCaptured(providerPaymentId, payment.amountMinor, payment.currency);
      const settled = await settlePaid(payment.id, providerPaymentId, event.method);
      return settled.status;
    }
    case "payment_failed": {
      const payment = await ops.getPaymentByOrder(event.orderId);
      if (!payment) return "unknown_order";
      return (await recordFailedAttempt(payment.id, event.reason, event.paymentId)) ? "failed_recorded" : "ignored";
    }
    case "refund_update": {
      let refund = event.refundId ? await ops.getRefundByProviderId(event.refundId) : null;
      if (!refund && event.ourRefundId) refund = await ops.getRefund(event.ourRefundId);
      if (!refund) return "unknown_refund";
      if (!refund.providerRefundId && event.refundId) refund = (await ops.updateRefund(refund.id, { providerRefundId: event.refundId })) ?? refund;
      await applyRefundStatus(ops, refund, event.status, event.reason || "The bank could not process the refund.");
      return `refund_${event.status}`;
    }
    default:
      return "ignored";
  }
}
