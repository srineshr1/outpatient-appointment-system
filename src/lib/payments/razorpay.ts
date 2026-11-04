import { createHmac, timingSafeEqual } from "node:crypto";
import {
  PaymentNotConfiguredError,
  ProviderError,
  type CheckoutProof,
  type CreateOrderInput,
  type CreateRefundInput,
  type PaymentProvider,
  type ProviderEvent,
  type ProviderOrder,
  type ProviderRefund,
  type ProviderRefundStatus,
} from "./provider";

const API = "https://api.razorpay.com/v1";

/** Hex HMAC-SHA256. */
export function hmacHex(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/** Constant-time comparison of two hex signatures. False for anything malformed. */
export function signaturesMatch(expected: string, given: string | null | undefined): boolean {
  if (!given) return false;
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(given.trim(), "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** The signature Razorpay Checkout returns: HMAC-SHA256 of "order_id|payment_id" with the key secret. */
export function checkoutSignature(keySecret: string, orderId: string, paymentId: string): string {
  return hmacHex(keySecret, `${orderId}|${paymentId}`);
}

type Json = Record<string, unknown>;

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function refundStatus(value: unknown): ProviderRefundStatus {
  return value === "processed" ? "processed" : value === "failed" ? "failed" : "pending";
}

function entityOf(payload: Json, key: string): Json | null {
  const holder = payload[key];
  if (holder && typeof holder === "object" && "entity" in holder) {
    const entity = (holder as Json).entity;
    if (entity && typeof entity === "object") return entity as Json;
  }
  return null;
}

/** Turn a verified Razorpay webhook body into a ProviderEvent. Pure, so it is tested without the network. */
export function parseRazorpayEvent(rawBody: string, eventIdHeader: string | null): ProviderEvent {
  let body: Json;
  try {
    body = JSON.parse(rawBody) as Json;
  } catch {
    throw new ProviderError("The webhook body is not JSON.", false);
  }
  const type = str(body.event);
  const payload = (body.payload && typeof body.payload === "object" ? body.payload : {}) as Json;
  const payment = entityOf(payload, "payment");
  const refund = entityOf(payload, "refund");
  const order = entityOf(payload, "order");
  // Razorpay sends a unique id per event in a header. Without one, fall back to what identifies the change.
  const eventId =
    eventIdHeader?.trim() || `${type}:${str(refund?.id) || str(payment?.id) || str(order?.id)}:${str(refund?.status) || str(payment?.status)}`;

  if ((type === "payment.captured" || type === "payment.authorized" || type === "order.paid") && (payment || order)) {
    const orderId = str(payment?.order_id) || str(order?.id);
    return {
      kind: "payment_paid",
      eventId,
      type,
      orderId,
      paymentId: str(payment?.id),
      amountMinor: num(payment?.amount) || num(order?.amount_paid),
      method: str(payment?.method),
    };
  }
  if (type === "payment.failed" && payment) {
    return {
      kind: "payment_failed",
      eventId,
      type,
      orderId: str(payment.order_id),
      paymentId: str(payment.id),
      reason: str(payment.error_description) || str(payment.error_reason) || "The payment did not go through.",
    };
  }
  if ((type === "refund.created" || type === "refund.processed" || type === "refund.failed" || type === "refund.speed_changed") && refund) {
    const notes = refund.notes && typeof refund.notes === "object" ? (refund.notes as Json) : {};
    return {
      kind: "refund_update",
      eventId,
      type,
      refundId: str(refund.id),
      paymentId: str(refund.payment_id),
      amountMinor: num(refund.amount),
      status: type === "refund.failed" ? "failed" : type === "refund.processed" ? "processed" : refundStatus(refund.status),
      reason: str(refund.error_description) || "",
      ourRefundId: str(notes.refund_id),
    };
  }
  return { kind: "ignored", eventId, type };
}

export class RazorpayProvider implements PaymentProvider {
  readonly name = "razorpay";

  private keyId(): string {
    return process.env.RAZORPAY_KEY_ID?.trim() ?? "";
  }
  private keySecret(): string {
    return process.env.RAZORPAY_KEY_SECRET?.trim() ?? "";
  }
  private webhookSecret(): string {
    return process.env.RAZORPAY_WEBHOOK_SECRET?.trim() ?? "";
  }

  isConfigured(): boolean {
    return Boolean(this.keyId() && this.keySecret());
  }

  webhookConfigured(): boolean {
    return Boolean(this.webhookSecret());
  }

  publicKey(): string | null {
    return this.keyId() || null;
  }

  private async call<T>(path: string, init: { method: "GET" | "POST"; body?: Json; headers?: Record<string, string> }): Promise<T> {
    if (!this.isConfigured()) throw new PaymentNotConfiguredError();
    let response: Response;
    try {
      response = await fetch(`${API}${path}`, {
        method: init.method,
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.keyId()}:${this.keySecret()}`).toString("base64")}`,
          "Content-Type": "application/json",
          ...init.headers,
        },
        ...(init.body ? { body: JSON.stringify(init.body) } : {}),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      throw new ProviderError(`Could not reach Razorpay: ${error instanceof Error ? error.message : "network error"}`, true);
    }
    const text = await response.text();
    let json: Json = {};
    try {
      json = text ? (JSON.parse(text) as Json) : {};
    } catch {
      /* not JSON */
    }
    if (!response.ok) {
      const detail = (json.error && typeof json.error === "object" ? str((json.error as Json).description) : "") || `HTTP ${response.status}`;
      throw new ProviderError(`Razorpay refused the request: ${detail}`, response.status >= 500 || response.status === 429);
    }
    return json as T;
  }

  async createOrder(input: CreateOrderInput): Promise<ProviderOrder> {
    const order = await this.call<Json>("/orders", {
      method: "POST",
      body: { amount: input.amountMinor, currency: input.currency, receipt: input.receipt.slice(0, 40), notes: input.notes ?? {} },
    });
    const id = str(order.id);
    if (!id) throw new ProviderError("Razorpay did not return an order id.", true);
    return { id, amountMinor: num(order.amount) || input.amountMinor, currency: str(order.currency) || input.currency };
  }

  verifyCheckout(proof: CheckoutProof): boolean {
    const secret = this.keySecret();
    if (!secret || !proof.orderId || !proof.paymentId) return false;
    return signaturesMatch(checkoutSignature(secret, proof.orderId, proof.paymentId), proof.signature);
  }

  verifyWebhook(rawBody: string, signature: string | null): boolean {
    const secret = this.webhookSecret();
    if (!secret) return false;
    return signaturesMatch(hmacHex(secret, rawBody), signature);
  }

  parseWebhook(rawBody: string, headers: { get(name: string): string | null }): ProviderEvent {
    return parseRazorpayEvent(rawBody, headers.get("x-razorpay-event-id"));
  }

  async ensureCaptured(providerPaymentId: string, amountMinor: number, currency: string): Promise<void> {
    const payment = await this.call<Json>(`/payments/${encodeURIComponent(providerPaymentId)}`, { method: "GET" });
    if (str(payment.status) !== "authorized") return;
    await this.call<Json>(`/payments/${encodeURIComponent(providerPaymentId)}/capture`, {
      method: "POST",
      body: { amount: amountMinor, currency },
    });
  }

  async createRefund(input: CreateRefundInput): Promise<ProviderRefund> {
    const refund = await this.call<Json>(`/payments/${encodeURIComponent(input.providerPaymentId)}/refund`, {
      method: "POST",
      headers: { "X-Refund-Idempotency": input.idempotencyKey },
      body: { amount: input.amountMinor, speed: "normal", receipt: input.idempotencyKey.slice(0, 40), notes: input.notes ?? {} },
    });
    const id = str(refund.id);
    if (!id) throw new ProviderError("Razorpay did not return a refund id.", true);
    return { id, paymentId: input.providerPaymentId, amountMinor: num(refund.amount) || input.amountMinor, status: refundStatus(refund.status) };
  }
}
