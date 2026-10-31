/**
 * Simulated payments. Every visit gets a fee when it is booked. Patients can "pay now" with a
 * demo card (nothing is charged), or pay at the desk, where staff record card or cash.
 * Cancelling refunds a demo card payment automatically; desk payments are refunded by staff.
 * Every change checks the latest record inside the store's update, so two desks can't both
 * take the last ₹400 owed.
 */
import { recordEvent, visitSummary, type Actor } from "./audit";
import { isClosedStatus } from "./clinic-types";
import type { AppointmentRecord, ChargeRecord, PaymentEntry, PaymentMethod } from "./clinic-types";
import { now } from "./clock";
import { findDoctor } from "./data";
import { formatMoney } from "./fees";
import { getOps } from "./ops";
import { onlinePaymentLines } from "./payments/summary";
import { resolveFee } from "./payments/fees";
import { METHOD_LABELS, paymentLine, refundableByMethod, summarise, totals } from "./payments";
import { getStore } from "./store";

/** A rule stopped the change. The message is safe to show staff. */
export class BillingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BillingError";
  }
}

/** Shown as "taken by" for demo online payments and automatic refunds. */
export const ONLINE_NAME = "Online";

export const REASON_LIMIT = 200;

function newEntry(
  kind: PaymentEntry["kind"],
  method: PaymentMethod,
  amountPence: number,
  by: { id: string | null; name: string },
  note = "",
): PaymentEntry {
  return {
    id: crypto.randomUUID(),
    kind,
    method,
    amountPence,
    at: now().toISOString(),
    byUserId: by.id,
    byName: by.name,
    note,
  };
}

function checkAmount(amountPence: number): void {
  if (!Number.isInteger(amountPence) || amountPence <= 0) throw new BillingError("Enter an amount more than ₹0.00.");
}

function checkReason(reason: string): string {
  const clean = reason.trim();
  if (!clean) throw new BillingError("Give a reason. It goes in the activity log.");
  if (clean.length > REASON_LIMIT) throw new BillingError(`Keep the reason to ${REASON_LIMIT} characters.`);
  return clean;
}

/** The fee is fixed when the visit is booked. Paying now records a demo card payment at once. */
export async function openCharge(visit: AppointmentRecord, payNow: boolean): Promise<ChargeRecord | null> {
  const amountPence = await resolveFee(visit.doctorId, visit.reasonId);
  const charge: ChargeRecord = {
    appointmentId: visit.id,
    reference: visit.reference,
    reasonId: visit.reasonId,
    amountPence,
    createdAt: now().toISOString(),
    entries: payNow && amountPence > 0 ? [newEntry("payment", "online_card", amountPence, { id: null, name: ONLINE_NAME })] : [],
    waiver: null,
  };
  const store = await getStore();
  return (await store.createCharge(charge)) === "ok" ? charge : store.getCharge(visit.id);
}

/**
 * Mirror a real online payment into the visit's ledger so desks, invoices and the "paid" badges all
 * agree with the payment system. Safe to call twice: the entry id comes from the payment id.
 */
export async function recordOnlinePayment(visit: AppointmentRecord, paymentId: string, amountMinor: number, note: string): Promise<void> {
  const entry: PaymentEntry = { ...newEntry("payment", "online_card", amountMinor, { id: null, name: ONLINE_NAME }, note), id: `pay-${paymentId}` };
  const store = await getStore();
  const created = await store.createCharge({
    appointmentId: visit.id,
    reference: visit.reference,
    reasonId: visit.reasonId,
    amountPence: amountMinor,
    createdAt: now().toISOString(),
    entries: [entry],
    waiver: null,
  });
  if (created === "ok") return;
  await store.updateCharge(visit.id, (charge) => (charge.entries.some((existing) => existing.id === entry.id) ? null : { ...charge, entries: [...charge.entries, entry] }));
}

/** Mirror a refund the provider has confirmed. Idempotent on the refund id. */
export async function recordOnlineRefund(visit: AppointmentRecord, refundId: string, amountMinor: number, note: string): Promise<void> {
  const entry: PaymentEntry = { ...newEntry("refund", "online_card", amountMinor, { id: null, name: ONLINE_NAME }, note), id: `ref-${refundId}` };
  await (await getStore()).updateCharge(visit.id, (charge) => (charge.entries.some((existing) => existing.id === entry.id) ? null : { ...charge, entries: [...charge.entries, entry] }));
}

async function visitFor(appointmentId: string): Promise<AppointmentRecord> {
  const visit = await (await getStore()).getAppointment(appointmentId);
  if (!visit) throw new BillingError("That visit is no longer on the book.");
  return visit;
}

async function change(appointmentId: string, edit: (charge: ChargeRecord) => ChargeRecord): Promise<ChargeRecord> {
  const updated = await (await getStore()).updateCharge(appointmentId, edit);
  if (!updated) throw new BillingError("This visit has no fee recorded. It was booked before fees started.");
  return updated;
}

/** For a visit booked before fees started: charge it the current fee for its reason, unpaid. */
export async function addMissingFee(actor: Actor, appointmentId: string): Promise<ChargeRecord> {
  const visit = await visitFor(appointmentId);
  if (isClosedStatus(visit.status)) throw new BillingError("This visit was cancelled, so there’s nothing to charge.");
  const store = await getStore();
  if (await store.getCharge(visit.id)) throw new BillingError("This visit already has a fee.");
  const charge = await openCharge(visit, false);
  if (!charge) throw new BillingError("The fee couldn’t be saved. Try again.");
  await recordEvent({
    actor,
    action: "fee.added",
    subjectType: "appointment",
    subjectId: visit.id,
    summary: `${formatMoney(charge.amountPence)} · ${visitSummary(visit)}`,
  });
  return charge;
}

/** Card or cash taken at the desk. */
export async function recordPayment(
  actor: Actor,
  appointmentId: string,
  method: PaymentMethod,
  amountPence: number,
): Promise<ChargeRecord> {
  if (method === "online_card") throw new BillingError("Online payments come from the patient. Choose card or cash.");
  checkAmount(amountPence);
  const visit = await visitFor(appointmentId);
  if (isClosedStatus(visit.status)) throw new BillingError("This visit was cancelled, so nothing is owed.");
  const updated = await change(appointmentId, (charge) => {
    if (charge.waiver) throw new BillingError("The fee was waived. Remove the waiver before taking a payment.");
    const { duePence } = summarise(charge, visit.status);
    if (duePence <= 0) throw new BillingError("Nothing is owed on this visit.");
    if (amountPence > duePence) throw new BillingError(`That’s more than the ${formatMoney(duePence)} still owed.`);
    return { ...charge, entries: [...charge.entries, newEntry("payment", method, amountPence, actor)] };
  });
  await recordEvent({
    actor,
    action: "payment.received",
    subjectType: "appointment",
    subjectId: visit.id,
    summary: `${formatMoney(amountPence)} by ${METHOD_LABELS[method].toLowerCase()} · ${visitSummary(visit)}`,
  });
  return updated;
}

/** Money back, by the way it was paid. Online card refunds are simulated. */
export async function refundPayment(
  actor: Actor,
  appointmentId: string,
  method: PaymentMethod,
  amountPence: number,
  reason: string,
): Promise<ChargeRecord> {
  checkAmount(amountPence);
  const why = checkReason(reason);
  const visit = await visitFor(appointmentId);
  if (method === "online_card" && (await getOps().then((ops) => ops.getPaymentByAppointment(appointmentId)))?.status === "captured") {
    throw new BillingError("This was paid online. Its refund goes back through the payment system: see the refund status on the visit.");
  }
  const updated = await change(appointmentId, (charge) => {
    const refundable = refundableByMethod(charge.entries).get(method) ?? 0;
    if (refundable <= 0) throw new BillingError(`Nothing was paid by ${METHOD_LABELS[method].toLowerCase()} to give back.`);
    if (amountPence > refundable) {
      throw new BillingError(`At most ${formatMoney(refundable)} can go back by ${METHOD_LABELS[method].toLowerCase()}.`);
    }
    return { ...charge, entries: [...charge.entries, newEntry("refund", method, amountPence, actor, why)] };
  });
  await recordEvent({
    actor,
    action: "payment.refunded",
    subjectType: "appointment",
    subjectId: visit.id,
    summary: `${formatMoney(amountPence)} back by ${METHOD_LABELS[method].toLowerCase()} · ${visitSummary(visit)}`,
    reason: why,
  });
  return updated;
}

export async function waiveFee(actor: Actor, appointmentId: string, reason: string): Promise<ChargeRecord> {
  const why = checkReason(reason);
  const visit = await visitFor(appointmentId);
  if (isClosedStatus(visit.status)) throw new BillingError("This visit was cancelled, so nothing is owed.");
  const updated = await change(appointmentId, (charge) => {
    if (charge.waiver) throw new BillingError("The fee is already waived.");
    if (totals(charge.entries).netPence > 0) throw new BillingError("Money has been paid. Refund it instead of waiving the fee.");
    return { ...charge, waiver: { at: now().toISOString(), byUserId: actor.id, byName: actor.name, reason: why } };
  });
  await recordEvent({
    actor,
    action: "fee.waived",
    subjectType: "appointment",
    subjectId: visit.id,
    summary: `${formatMoney(updated.amountPence)} · ${visitSummary(visit)}`,
    reason: why,
  });
  return updated;
}

export async function restoreFee(actor: Actor, appointmentId: string): Promise<ChargeRecord> {
  const visit = await visitFor(appointmentId);
  const updated = await change(appointmentId, (charge) => {
    if (!charge.waiver) throw new BillingError("The fee isn’t waived.");
    return { ...charge, waiver: null };
  });
  await recordEvent({
    actor,
    action: "fee.restored",
    subjectType: "appointment",
    subjectId: visit.id,
    summary: `${formatMoney(updated.amountPence)} owed again · ${visitSummary(visit)}`,
  });
  return updated;
}

/** The payment line for each visit that has one, keyed by visit id. */
export async function paymentLabels(
  visitsOrPending: readonly AppointmentRecord[] | Promise<readonly AppointmentRecord[]>,
): Promise<Record<string, string>> {
  // Fetch the charges while the visits are still loading.
  const [visits, rows] = await Promise.all([visitsOrPending, (async () => (await getStore()).listCharges())()]);
  const charges = new Map(rows.map((charge) => [charge.appointmentId, charge]));
  const labels: Record<string, string> = {};
  for (const visit of visits) {
    const line = paymentLine(summarise(charges.get(visit.id), visit.status));
    if (line) labels[visit.id] = line;
  }
  // Visits paid through the payment system say so, with the refund's real status.
  return { ...labels, ...(await onlinePaymentLines(visits)) };
}

/**
 * After a cancellation: give back whatever was paid by demo card. Desk payments stay
 * for staff to refund in person, and show as "Refund due" until they do.
 */
export async function settleCancelledVisit(visit: AppointmentRecord, actor: Actor): Promise<number> {
  let refunded = 0;
  const store = await getStore();
  await store.updateCharge(visit.id, (charge) => {
    const online = refundableByMethod(charge.entries).get("online_card") ?? 0;
    refunded = online;
    if (online <= 0) return null;
    const note = `Automatic refund: visit cancelled by ${actor.name}`;
    return {
      ...charge,
      entries: [...charge.entries, newEntry("refund", "online_card", online, { id: null, name: ONLINE_NAME }, note)],
    };
  });
  if (refunded > 0) {
    await recordEvent({
      actor,
      action: "payment.refunded",
      subjectType: "appointment",
      subjectId: visit.id,
      summary: `${formatMoney(refunded)} back to the demo card · ${visitSummary(visit)}`,
      reason: "Automatic refund when the visit was cancelled",
    });
  }
  return refunded;
}
