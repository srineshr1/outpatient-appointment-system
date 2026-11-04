import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseServiceKey } from "../supabase-store";
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

/** Payments, refunds, events, settings and the outbox in the practice's Supabase Postgres. Server only. */
const UNIQUE_VIOLATION = "23505";

type Row = Record<string, unknown>;
interface DbError {
  code?: string;
  message: string;
}

function fail(error: DbError | null): void {
  if (error) throw new Error(`Clinic database: ${error.message}`);
}

const s = (value: unknown): string => (typeof value === "string" ? value : "");
const sn = (value: unknown): string | null => (typeof value === "string" ? value : null);
const n = (value: unknown): number => (typeof value === "number" ? value : Number(value ?? 0));
const iso = (value: unknown): string => (typeof value === "string" ? new Date(value).toISOString() : new Date(0).toISOString());
const isoN = (value: unknown): string | null => (typeof value === "string" ? new Date(value).toISOString() : null);

function toPayment(row: Row): PaymentRecord {
  return {
    id: s(row.id),
    appointmentId: s(row.appointment_id),
    provider: s(row.provider),
    providerOrderId: sn(row.provider_order_id),
    providerPaymentId: sn(row.provider_payment_id),
    amountMinor: n(row.amount_minor),
    currency: s(row.currency),
    status: s(row.status) as PaymentRecord["status"],
    failureReason: s(row.failure_reason),
    method: s(row.method),
    holdExpiresAt: iso(row.hold_expires_at),
    createdAt: iso(row.created_at),
    paidAt: isoN(row.paid_at),
  };
}

function toRefund(row: Row): RefundRecord {
  return {
    id: s(row.id),
    paymentId: s(row.payment_id),
    appointmentId: s(row.appointment_id),
    amountMinor: n(row.amount_minor),
    currency: s(row.currency),
    status: s(row.status) as RefundRecord["status"],
    kind: s(row.kind) as RefundRecord["kind"],
    reason: s(row.reason),
    policyPercent: n(row.policy_percent),
    idempotencyKey: s(row.idempotency_key),
    providerRefundId: sn(row.provider_refund_id),
    failureReason: s(row.failure_reason),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    processedAt: isoN(row.processed_at),
  };
}

function toNotification(row: Row): NotificationRecord {
  return {
    id: s(row.id),
    dedupeKey: s(row.dedupe_key),
    kind: s(row.kind),
    channel: s(row.channel),
    recipient: s(row.recipient),
    appointmentId: sn(row.appointment_id),
    payload: (row.payload && typeof row.payload === "object" ? row.payload : {}) as Record<string, unknown>,
    status: s(row.status) as NotificationStatus,
    attempts: n(row.attempts),
    lastError: s(row.last_error),
    scheduledFor: iso(row.scheduled_for),
    sentAt: isoN(row.sent_at),
    createdAt: iso(row.created_at),
  };
}

export class SupabaseOps implements OpsStore {
  private readonly db: SupabaseClient;

  constructor(url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = supabaseServiceKey()) {
    if (!url || !key) throw new Error("DATA_STORE=supabase needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    this.db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  async getDoctorFee(doctorId: string): Promise<DoctorFee | null> {
    const { data, error } = await this.db.from("clinic_doctor_fees").select("*").eq("doctor_id", doctorId).maybeSingle();
    fail(error);
    return data ? { doctorId, feeMinor: n(data.fee_minor), currency: s(data.currency) } : null;
  }
  async listDoctorFees(): Promise<DoctorFee[]> {
    const { data, error } = await this.db.from("clinic_doctor_fees").select("*");
    fail(error);
    return (data ?? []).map((row) => ({ doctorId: s(row.doctor_id), feeMinor: n(row.fee_minor), currency: s(row.currency) }));
  }
  async setDoctorFee(doctorId: string, feeMinor: number): Promise<void> {
    const { error } = await this.db.from("clinic_doctor_fees").upsert({ doctor_id: doctorId, fee_minor: feeMinor, updated_at: new Date().toISOString() });
    fail(error);
  }

  async getSetting(key: string): Promise<unknown | null> {
    const { data, error } = await this.db.from("clinic_settings").select("value").eq("key", key).maybeSingle();
    fail(error);
    return data ? data.value : null;
  }
  async setSetting(key: string, value: unknown): Promise<void> {
    const { error } = await this.db.from("clinic_settings").upsert({ key, value, updated_at: new Date().toISOString() });
    fail(error);
  }

  async createPayment(payment: PaymentRecord): Promise<"ok" | "exists"> {
    const { error } = await this.db.from("clinic_payments").insert({
      id: payment.id,
      appointment_id: payment.appointmentId,
      provider: payment.provider,
      provider_order_id: payment.providerOrderId,
      provider_payment_id: payment.providerPaymentId,
      amount_minor: payment.amountMinor,
      currency: payment.currency,
      status: payment.status,
      failure_reason: payment.failureReason,
      method: payment.method,
      hold_expires_at: payment.holdExpiresAt,
      created_at: payment.createdAt,
      paid_at: payment.paidAt,
    });
    if (error?.code === UNIQUE_VIOLATION) return "exists";
    fail(error);
    return "ok";
  }
  private async one(column: string, value: string): Promise<PaymentRecord | null> {
    const { data, error } = await this.db.from("clinic_payments").select("*").eq(column, value).maybeSingle();
    fail(error);
    return data ? toPayment(data) : null;
  }
  getPayment(id: string) {
    return this.one("id", id);
  }
  getPaymentByAppointment(appointmentId: string) {
    return this.one("appointment_id", appointmentId);
  }
  getPaymentByOrder(orderId: string) {
    return this.one("provider_order_id", orderId);
  }
  getPaymentByProviderPayment(providerPaymentId: string) {
    return this.one("provider_payment_id", providerPaymentId);
  }
  async listPayments(filter: { appointmentIds?: string[] } = {}): Promise<PaymentRecord[]> {
    if (filter.appointmentIds && filter.appointmentIds.length === 0) return [];
    let query = this.db.from("clinic_payments").select("*");
    if (filter.appointmentIds) query = query.in("appointment_id", filter.appointmentIds);
    const { data, error } = await query.order("created_at", { ascending: false }).limit(1000);
    fail(error);
    return (data ?? []).map(toPayment);
  }
  async markPaymentFailed(id: string, reason: string, providerPaymentId?: string): Promise<boolean> {
    const patch: Row = { status: "failed", failure_reason: reason.slice(0, 300), updated_at: new Date().toISOString() };
    if (providerPaymentId) {
      // Keep the first attempt's payment id; a later successful attempt overwrites it on capture.
      const current = await this.getPayment(id);
      if (current && !current.providerPaymentId) patch.provider_payment_id = providerPaymentId;
    }
    const { data, error } = await this.db.from("clinic_payments").update(patch).eq("id", id).in("status", ["created", "failed"]).select("id");
    fail(error);
    return (data?.length ?? 0) > 0;
  }

  async confirmPayment(id: string, providerPaymentId: string | null, method: string): Promise<{ outcome: ConfirmOutcome; appointmentId?: string }> {
    const { data, error } = await this.db.rpc("clinic_confirm_payment", {
      p_payment_id: id,
      p_provider_payment_id: providerPaymentId,
      p_method: method,
    });
    fail(error);
    const result = (data ?? {}) as { outcome?: ConfirmOutcome; appointment_id?: string };
    return { outcome: result.outcome ?? "not_found", ...(result.appointment_id ? { appointmentId: result.appointment_id } : {}) };
  }

  async expireHolds(now: Date): Promise<string[]> {
    const { data, error } = await this.db.rpc("clinic_expire_holds", { p_now: now.toISOString() });
    fail(error);
    return Array.isArray(data) ? (data as string[]) : [];
  }

  async claimEvent(event: { id: string; provider: string; type: string; payload: unknown }): Promise<"new" | "retry" | "duplicate"> {
    const { error } = await this.db
      .from("clinic_payment_events")
      .insert({ id: event.id, provider: event.provider, type: event.type, payload: event.payload });
    if (!error) return "new";
    if (error.code !== UNIQUE_VIOLATION) fail(error);
    const { data, error: readError } = await this.db.from("clinic_payment_events").select("processed_at").eq("id", event.id).maybeSingle();
    fail(readError);
    return data?.processed_at ? "duplicate" : "retry";
  }
  async finishEvent(id: string, outcome: string): Promise<void> {
    const { error } = await this.db.from("clinic_payment_events").update({ processed_at: new Date().toISOString(), outcome: outcome.slice(0, 200) }).eq("id", id);
    fail(error);
  }

  async createRefund(refund: RefundRecord): Promise<"ok" | "duplicate_key" | "active_exists"> {
    const { error } = await this.db.from("clinic_refunds").insert({
      id: refund.id,
      payment_id: refund.paymentId,
      appointment_id: refund.appointmentId,
      amount_minor: refund.amountMinor,
      currency: refund.currency,
      status: refund.status,
      kind: refund.kind,
      reason: refund.reason,
      policy_percent: refund.policyPercent,
      idempotency_key: refund.idempotencyKey,
      provider_refund_id: refund.providerRefundId,
      failure_reason: refund.failureReason,
      created_at: refund.createdAt,
      updated_at: refund.updatedAt,
      processed_at: refund.processedAt,
    });
    if (!error) return "ok";
    if (error.code === UNIQUE_VIOLATION) return error.message.includes("idempotency_key") ? "duplicate_key" : "active_exists";
    fail(error);
    return "ok";
  }
  async getRefund(id: string): Promise<RefundRecord | null> {
    const { data, error } = await this.db.from("clinic_refunds").select("*").eq("id", id).maybeSingle();
    fail(error);
    return data ? toRefund(data) : null;
  }
  async getRefundByProviderId(providerRefundId: string): Promise<RefundRecord | null> {
    const { data, error } = await this.db.from("clinic_refunds").select("*").eq("provider_refund_id", providerRefundId).maybeSingle();
    fail(error);
    return data ? toRefund(data) : null;
  }
  async listRefunds(filter: { paymentId?: string; appointmentIds?: string[]; status?: RefundStatus } = {}): Promise<RefundRecord[]> {
    if (filter.appointmentIds && filter.appointmentIds.length === 0) return [];
    let query = this.db.from("clinic_refunds").select("*");
    if (filter.paymentId) query = query.eq("payment_id", filter.paymentId);
    if (filter.appointmentIds) query = query.in("appointment_id", filter.appointmentIds);
    if (filter.status) query = query.eq("status", filter.status);
    const { data, error } = await query.order("created_at", { ascending: false }).limit(1000);
    fail(error);
    return (data ?? []).map(toRefund);
  }
  async updateRefund(id: string, patch: Partial<Pick<RefundRecord, "status" | "providerRefundId" | "failureReason" | "processedAt">>): Promise<RefundRecord | null> {
    const row: Row = { updated_at: new Date().toISOString() };
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.providerRefundId !== undefined) row.provider_refund_id = patch.providerRefundId;
    if (patch.failureReason !== undefined) row.failure_reason = patch.failureReason.slice(0, 300);
    if (patch.processedAt !== undefined) row.processed_at = patch.processedAt;
    const { data, error } = await this.db.from("clinic_refunds").update(row).eq("id", id).select("*").maybeSingle();
    fail(error);
    return data ? toRefund(data) : null;
  }

  async enqueueNotification(notification: NewNotification): Promise<"queued" | "exists"> {
    const { data, error } = await this.db.rpc("clinic_enqueue_notification", {
      p: {
        id: crypto.randomUUID(),
        dedupe_key: notification.dedupeKey,
        kind: notification.kind,
        channel: notification.channel ?? "email",
        recipient: notification.recipient,
        appointment_id: notification.appointmentId,
        payload: notification.payload,
        scheduled_for: notification.scheduledFor ?? new Date().toISOString(),
      },
    });
    fail(error);
    return data === "queued" ? "queued" : "exists";
  }
  async cancelNotifications(appointmentId: string, kind?: string): Promise<number> {
    let query = this.db.from("clinic_notifications").update({ status: "cancelled" }).eq("appointment_id", appointmentId).eq("status", "scheduled");
    if (kind) query = query.eq("kind", kind);
    const { data, error } = await query.select("id");
    fail(error);
    return data?.length ?? 0;
  }
  async claimDueNotifications(limit: number, now: Date): Promise<NotificationRecord[]> {
    const { data, error } = await this.db.rpc("clinic_claim_notifications", { p_limit: limit, p_now: now.toISOString() });
    fail(error);
    return ((data ?? []) as Row[]).map(toNotification);
  }
  async finishNotification(id: string, status: "sent" | "failed" | "skipped" | "cancelled", error = ""): Promise<void> {
    const patch: Row = { status, last_error: error.slice(0, 300) };
    if (status === "sent") patch.sent_at = new Date().toISOString();
    if (status === "failed") patch.claimed_at = new Date().toISOString();
    const { error: dbError } = await this.db.from("clinic_notifications").update(patch).eq("id", id);
    fail(dbError);
  }
  async listNotifications(filter: { appointmentId?: string; status?: NotificationStatus; kind?: string } = {}): Promise<NotificationRecord[]> {
    let query = this.db.from("clinic_notifications").select("*");
    if (filter.appointmentId) query = query.eq("appointment_id", filter.appointmentId);
    if (filter.status) query = query.eq("status", filter.status);
    if (filter.kind) query = query.eq("kind", filter.kind);
    const { data, error } = await query.order("scheduled_for").limit(1000);
    fail(error);
    return (data ?? []).map(toNotification);
  }
}
