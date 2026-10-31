/**
 * Records and the store interface for payments, refunds, provider events, settings and the
 * notification outbox. Separate from ClinicStore so the three older stores stay as they are:
 * Supabase implements this with tables and transactional functions (supabase-ops.ts), and tests and
 * local development use the in-memory version (memory-ops.ts).
 */
export type PaymentStatus = "created" | "failed" | "captured" | "expired";

export interface PaymentRecord {
  id: string;
  appointmentId: string;
  provider: string;
  providerOrderId: string | null;
  providerPaymentId: string | null;
  amountMinor: number;
  currency: string;
  status: PaymentStatus;
  failureReason: string;
  method: string;
  /** ISO. The place is held until then. */
  holdExpiresAt: string;
  createdAt: string;
  paidAt: string | null;
}

export type ConfirmOutcome = "confirmed" | "late_confirmed" | "already" | "slot_lost" | "not_found";

export type RefundStatus = "pending" | "processed" | "failed";
export type RefundKind = "patient_cancel" | "doctor_cancel" | "late_payment" | "admin";

export interface RefundRecord {
  id: string;
  paymentId: string;
  appointmentId: string;
  amountMinor: number;
  currency: string;
  status: RefundStatus;
  kind: RefundKind;
  reason: string;
  policyPercent: number;
  idempotencyKey: string;
  providerRefundId: string | null;
  failureReason: string;
  createdAt: string;
  updatedAt: string;
  processedAt: string | null;
}

export type NotificationStatus = "scheduled" | "sending" | "sent" | "failed" | "cancelled" | "skipped";

export interface NotificationRecord {
  id: string;
  dedupeKey: string;
  kind: string;
  channel: string;
  recipient: string;
  appointmentId: string | null;
  payload: Record<string, unknown>;
  status: NotificationStatus;
  attempts: number;
  lastError: string;
  scheduledFor: string;
  sentAt: string | null;
  createdAt: string;
}

export type NewNotification = Pick<NotificationRecord, "dedupeKey" | "kind" | "recipient" | "appointmentId" | "payload"> & {
  channel?: string;
  scheduledFor?: string;
};

export interface DoctorFee {
  doctorId: string;
  feeMinor: number;
  currency: string;
}

export interface OpsStore {
  // Doctor fees: the source of truth for what a booking is charged.
  getDoctorFee(doctorId: string): Promise<DoctorFee | null>;
  listDoctorFees(): Promise<DoctorFee[]>;
  setDoctorFee(doctorId: string, feeMinor: number): Promise<void>;
  // Settings.
  getSetting(key: string): Promise<unknown | null>;
  setSetting(key: string, value: unknown): Promise<void>;
  // Payments.
  createPayment(payment: PaymentRecord): Promise<"ok" | "exists">;
  getPayment(id: string): Promise<PaymentRecord | null>;
  getPaymentByAppointment(appointmentId: string): Promise<PaymentRecord | null>;
  getPaymentByOrder(orderId: string): Promise<PaymentRecord | null>;
  getPaymentByProviderPayment(providerPaymentId: string): Promise<PaymentRecord | null>;
  listPayments(filter?: { appointmentIds?: string[] }): Promise<PaymentRecord[]>;
  /** Record a failed attempt. Only while the payment is still open (created or failed). */
  markPaymentFailed(id: string, reason: string, providerPaymentId?: string): Promise<boolean>;
  /** Atomically capture the payment and book the held visit. */
  confirmPayment(id: string, providerPaymentId: string | null, method: string): Promise<{ outcome: ConfirmOutcome; appointmentId?: string }>;
  /** Release holds that ran out, together with their payments. Returns the visit ids. */
  expireHolds(now: Date): Promise<string[]>;
  // Provider events.
  /** "new": process it. "retry": stored earlier but never finished: process it again. "duplicate": already processed. */
  claimEvent(event: { id: string; provider: string; type: string; payload: unknown }): Promise<"new" | "retry" | "duplicate">;
  finishEvent(id: string, outcome: string): Promise<void>;
  // Refunds.
  createRefund(refund: RefundRecord): Promise<"ok" | "duplicate_key" | "active_exists">;
  getRefund(id: string): Promise<RefundRecord | null>;
  getRefundByProviderId(providerRefundId: string): Promise<RefundRecord | null>;
  listRefunds(filter?: { paymentId?: string; appointmentIds?: string[]; status?: RefundStatus }): Promise<RefundRecord[]>;
  updateRefund(id: string, patch: Partial<Pick<RefundRecord, "status" | "providerRefundId" | "failureReason" | "processedAt">>): Promise<RefundRecord | null>;
  // Notification outbox.
  enqueueNotification(notification: NewNotification): Promise<"queued" | "exists">;
  /** Cancel scheduled (not yet sent) notifications of a visit, optionally only those of one kind. Returns how many. */
  cancelNotifications(appointmentId: string, kind?: string): Promise<number>;
  claimDueNotifications(limit: number, now: Date): Promise<NotificationRecord[]>;
  finishNotification(id: string, status: Extract<NotificationStatus, "sent" | "failed" | "skipped" | "cancelled">, error?: string): Promise<void>;
  listNotifications(filter?: { appointmentId?: string; status?: NotificationStatus; kind?: string }): Promise<NotificationRecord[]>;
}
