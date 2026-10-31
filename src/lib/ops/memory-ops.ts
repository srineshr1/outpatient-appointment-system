import { now } from "../clock";
import type { ClinicStore } from "../clinic-types";
import type {
  ConfirmOutcome,
  DoctorFee,
  NewNotification,
  NotificationRecord,
  NotificationStatus,
  OpsStore,
  PaymentRecord,
  RefundRecord,
  RefundStatus,
} from "./types";

/**
 * The same behaviour as the Supabase functions, in memory, for tests and local development. It
 * changes visit status through the ClinicStore's transitionStatus, which is atomic per call.
 */
export class MemoryOps implements OpsStore {
  readonly fees = new Map<string, DoctorFee>();
  readonly settings = new Map<string, unknown>();
  readonly payments = new Map<string, PaymentRecord>();
  readonly events = new Map<string, { processedAt: string | null; outcome: string }>();
  readonly refunds = new Map<string, RefundRecord>();
  readonly notifications = new Map<string, NotificationRecord>();

  constructor(private readonly clinic: ClinicStore) {}

  async getDoctorFee(doctorId: string) {
    return this.fees.get(doctorId) ?? null;
  }
  async listDoctorFees() {
    return [...this.fees.values()];
  }
  async setDoctorFee(doctorId: string, feeMinor: number) {
    this.fees.set(doctorId, { doctorId, feeMinor, currency: "INR" });
  }
  async getSetting(key: string) {
    return this.settings.get(key) ?? null;
  }
  async setSetting(key: string, value: unknown) {
    this.settings.set(key, value);
  }

  async createPayment(payment: PaymentRecord) {
    if ([...this.payments.values()].some((existing) => existing.appointmentId === payment.appointmentId)) return "exists" as const;
    this.payments.set(payment.id, { ...payment });
    return "ok" as const;
  }
  async getPayment(id: string) {
    const found = this.payments.get(id);
    return found ? { ...found } : null;
  }
  private find(predicate: (payment: PaymentRecord) => boolean) {
    const found = [...this.payments.values()].find(predicate);
    return found ? { ...found } : null;
  }
  async getPaymentByAppointment(appointmentId: string) {
    return this.find((payment) => payment.appointmentId === appointmentId);
  }
  async getPaymentByOrder(orderId: string) {
    return this.find((payment) => payment.providerOrderId === orderId);
  }
  async getPaymentByProviderPayment(providerPaymentId: string) {
    return this.find((payment) => payment.providerPaymentId === providerPaymentId);
  }
  async listPayments(filter: { appointmentIds?: string[] } = {}) {
    return [...this.payments.values()]
      .filter((payment) => !filter.appointmentIds || filter.appointmentIds.includes(payment.appointmentId))
      .map((payment) => ({ ...payment }));
  }
  async markPaymentFailed(id: string, reason: string, providerPaymentId?: string) {
    const payment = this.payments.get(id);
    if (!payment || (payment.status !== "created" && payment.status !== "failed")) return false;
    payment.status = "failed";
    payment.failureReason = reason;
    if (providerPaymentId) payment.providerPaymentId ??= providerPaymentId;
    return true;
  }

  async confirmPayment(id: string, providerPaymentId: string | null, method: string): Promise<{ outcome: ConfirmOutcome; appointmentId?: string }> {
    const payment = this.payments.get(id);
    if (!payment) return { outcome: "not_found" };
    if (payment.status === "captured") return { outcome: "already", appointmentId: payment.appointmentId };
    const visit = await this.clinic.getAppointment(payment.appointmentId);
    if (!visit) return { outcome: "not_found" };
    let outcome: ConfirmOutcome;
    if (visit.status === "pending_payment") {
      outcome = (await this.clinic.transitionStatus(visit.id, "pending_payment", "booked")) === "ok" ? "confirmed" : "slot_lost";
    } else if (visit.status === "expired") {
      outcome = (await this.clinic.transitionStatus(visit.id, "expired", "booked")) === "ok" ? "late_confirmed" : "slot_lost";
    } else {
      outcome = "slot_lost";
    }
    payment.status = "captured";
    payment.providerPaymentId = providerPaymentId ?? payment.providerPaymentId;
    payment.method = method || payment.method;
    payment.paidAt = now().toISOString();
    payment.failureReason = "";
    return { outcome, appointmentId: visit.id };
  }

  async expireHolds(now: Date) {
    const released: string[] = [];
    for (const payment of this.payments.values()) {
      if ((payment.status !== "created" && payment.status !== "failed") || new Date(payment.holdExpiresAt).getTime() > now.getTime()) continue;
      if ((await this.clinic.transitionStatus(payment.appointmentId, "pending_payment", "expired")) === "ok") {
        payment.status = "expired";
        released.push(payment.appointmentId);
      }
    }
    return released;
  }

  async claimEvent(event: { id: string }) {
    const existing = this.events.get(event.id);
    if (!existing) {
      this.events.set(event.id, { processedAt: null, outcome: "" });
      return "new" as const;
    }
    return existing.processedAt ? ("duplicate" as const) : ("retry" as const);
  }
  async finishEvent(id: string, outcome: string) {
    this.events.set(id, { processedAt: now().toISOString(), outcome });
  }

  async createRefund(refund: RefundRecord) {
    const all = [...this.refunds.values()];
    if (all.some((existing) => existing.idempotencyKey === refund.idempotencyKey)) return "duplicate_key" as const;
    if (all.some((existing) => existing.paymentId === refund.paymentId && (existing.status === "pending" || existing.status === "processed"))) {
      return "active_exists" as const;
    }
    this.refunds.set(refund.id, { ...refund });
    return "ok" as const;
  }
  async getRefund(id: string) {
    const found = this.refunds.get(id);
    return found ? { ...found } : null;
  }
  async getRefundByProviderId(providerRefundId: string) {
    const found = [...this.refunds.values()].find((refund) => refund.providerRefundId === providerRefundId);
    return found ? { ...found } : null;
  }
  async listRefunds(filter: { paymentId?: string; appointmentIds?: string[]; status?: RefundStatus } = {}) {
    return [...this.refunds.values()]
      .filter(
        (refund) =>
          (!filter.paymentId || refund.paymentId === filter.paymentId) &&
          (!filter.appointmentIds || filter.appointmentIds.includes(refund.appointmentId)) &&
          (!filter.status || refund.status === filter.status),
      )
      .map((refund) => ({ ...refund }));
  }
  async updateRefund(id: string, patch: Partial<Pick<RefundRecord, "status" | "providerRefundId" | "failureReason" | "processedAt">>) {
    const refund = this.refunds.get(id);
    if (!refund) return null;
    Object.assign(refund, patch, { updatedAt: now().toISOString() });
    return { ...refund };
  }

  async enqueueNotification(notification: NewNotification) {
    const existing = [...this.notifications.values()].find((row) => row.dedupeKey === notification.dedupeKey);
    const scheduledFor = notification.scheduledFor ?? now().toISOString();
    if (existing) {
      if (existing.status !== "cancelled") return "exists" as const;
      Object.assign(existing, { status: "scheduled", scheduledFor, payload: notification.payload, attempts: 0, lastError: "" });
      return "queued" as const;
    }
    const id = crypto.randomUUID();
    this.notifications.set(id, {
      id,
      dedupeKey: notification.dedupeKey,
      kind: notification.kind,
      channel: notification.channel ?? "email",
      recipient: notification.recipient,
      appointmentId: notification.appointmentId,
      payload: notification.payload,
      status: "scheduled",
      attempts: 0,
      lastError: "",
      scheduledFor,
      sentAt: null,
      createdAt: now().toISOString(),
    });
    return "queued" as const;
  }
  async cancelNotifications(appointmentId: string, kind?: string) {
    let count = 0;
    for (const row of this.notifications.values()) {
      if (row.appointmentId === appointmentId && row.status === "scheduled" && (!kind || row.kind === kind)) {
        row.status = "cancelled";
        count += 1;
      }
    }
    return count;
  }
  async claimDueNotifications(limit: number, now: Date) {
    const due = [...this.notifications.values()]
      .filter(
        (row) =>
          new Date(row.scheduledFor).getTime() <= now.getTime() &&
          (row.status === "scheduled" || (row.status === "failed" && row.attempts < 5)),
      )
      .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor))
      .slice(0, limit);
    for (const row of due) {
      row.status = "sending";
      row.attempts += 1;
    }
    return due.map((row) => ({ ...row }));
  }
  async finishNotification(id: string, status: "sent" | "failed" | "skipped" | "cancelled", error = "") {
    const row = this.notifications.get(id);
    if (!row) return;
    row.status = status;
    row.lastError = error;
    if (status === "sent") row.sentAt = now().toISOString();
  }
  async listNotifications(filter: { appointmentId?: string; status?: NotificationStatus; kind?: string } = {}) {
    return [...this.notifications.values()]
      .filter(
        (row) =>
          (!filter.appointmentId || row.appointmentId === filter.appointmentId) &&
          (!filter.status || row.status === filter.status) &&
          (!filter.kind || row.kind === filter.kind),
      )
      .map((row) => ({ ...row }));
  }
}
