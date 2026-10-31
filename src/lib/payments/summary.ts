import type { AppointmentRecord } from "../clinic-types";
import { formatMoney } from "../fees";
import { getOps } from "../ops";
import type { PaymentRecord, RefundRecord } from "../ops/types";

/** The words for a refund's status. "Initiated" and "pending" until the provider says it is done. */
export function refundStatusLabel(refund: Pick<RefundRecord, "status" | "amountMinor">): string {
  const amount = formatMoney(refund.amountMinor);
  if (refund.status === "processed") return `Refund of ${amount} completed`;
  if (refund.status === "failed") return `Refund of ${amount} failed. The practice will be in touch`;
  return `Refund of ${amount} initiated, pending`;
}

export function paymentStatusLabel(payment: Pick<PaymentRecord, "status" | "amountMinor">): string {
  const amount = formatMoney(payment.amountMinor);
  if (payment.status === "captured") return `Paid ${amount} online`;
  if (payment.status === "expired") return `Payment of ${amount} not received`;
  if (payment.status === "failed") return `Payment of ${amount} failed`;
  return `Awaiting payment of ${amount}`;
}

/** The latest refund of a payment, the one whose status the patient should see. */
export function latestRefund(refunds: readonly RefundRecord[]): RefundRecord | null {
  return [...refunds].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
}

/** One line per visit that was paid, or is being paid, through the payment system. Empty for desk visits. */
export async function onlinePaymentLines(visits: readonly AppointmentRecord[]): Promise<Record<string, string>> {
  const ids = visits.map((visit) => visit.id);
  if (ids.length === 0) return {};
  try {
    const ops = await getOps();
    const [payments, refunds] = await Promise.all([ops.listPayments({ appointmentIds: ids }), ops.listRefunds({ appointmentIds: ids })]);
    const lines: Record<string, string> = {};
    for (const payment of payments) {
      const refund = latestRefund(refunds.filter((item) => item.appointmentId === payment.appointmentId));
      lines[payment.appointmentId] = refund ? `${paymentStatusLabel(payment)} · ${refundStatusLabel(refund)}` : paymentStatusLabel(payment);
    }
    return lines;
  } catch (error) {
    console.error(`[payments] Could not read payment status: ${error instanceof Error ? error.message : "unknown error"}`);
    return {};
  }
}

export interface PaymentHistoryItem {
  payment: PaymentRecord;
  visit: AppointmentRecord;
  refunds: RefundRecord[];
}

/** A patient's online payments with their refunds, newest first. */
export async function paymentHistory(visits: readonly AppointmentRecord[]): Promise<PaymentHistoryItem[]> {
  const ids = visits.map((visit) => visit.id);
  if (ids.length === 0) return [];
  const ops = await getOps();
  const [payments, refunds] = await Promise.all([ops.listPayments({ appointmentIds: ids }), ops.listRefunds({ appointmentIds: ids })]);
  const byVisit = new Map(visits.map((visit) => [visit.id, visit]));
  return payments
    .filter((payment) => payment.status === "captured" || refunds.some((refund) => refund.paymentId === payment.id))
    .flatMap((payment) => {
      const visit = byVisit.get(payment.appointmentId);
      return visit ? [{ payment, visit, refunds: refunds.filter((refund) => refund.paymentId === payment.id) }] : [];
    })
    .sort((a, b) => (b.payment.paidAt ?? b.payment.createdAt).localeCompare(a.payment.paidAt ?? a.payment.createdAt));
}
