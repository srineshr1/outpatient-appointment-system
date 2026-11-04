/**
 * The payment provider interface. Razorpay is the first implementation (razorpay.ts); Stripe or
 * another gateway would implement the same interface and be selected with PAYMENT_PROVIDER. The
 * rest of the app (service.ts, the webhook route, the UI) only talks to this interface.
 */

export interface CreateOrderInput {
  /** Whole minor units (paise). Always computed on the server from the stored doctor fee. */
  amountMinor: number;
  currency: string;
  /** Our reference for the order, e.g. the booking reference. */
  receipt: string;
  notes?: Record<string, string>;
}

export interface ProviderOrder {
  id: string;
  amountMinor: number;
  currency: string;
}

export type ProviderRefundStatus = "pending" | "processed" | "failed";

export interface ProviderRefund {
  id: string;
  paymentId: string;
  amountMinor: number;
  status: ProviderRefundStatus;
}

export interface CreateRefundInput {
  providerPaymentId: string;
  amountMinor: number;
  /** The same key always gives the same refund: a retry can never refund twice. */
  idempotencyKey: string;
  notes?: Record<string, string>;
}

/** A provider webhook, reduced to what the app acts on. */
export type ProviderEvent =
  | { kind: "payment_paid"; eventId: string; type: string; orderId: string; paymentId: string; amountMinor: number; method: string }
  | { kind: "payment_failed"; eventId: string; type: string; orderId: string; paymentId: string; reason: string }
  | { kind: "refund_update"; eventId: string; type: string; refundId: string; paymentId: string; amountMinor: number; status: ProviderRefundStatus; reason: string; ourRefundId: string }
  | { kind: "ignored"; eventId: string; type: string };

export interface CheckoutProof {
  orderId: string;
  paymentId: string;
  signature: string;
}

export interface PaymentProvider {
  readonly name: string;
  /** Whether the keys needed to take payments are present. */
  isConfigured(): boolean;
  /** Whether the webhook secret is present, so webhooks can be verified. */
  webhookConfigured(): boolean;
  /** What the browser needs to open the provider's checkout. Never the secret. */
  publicKey(): string | null;
  createOrder(input: CreateOrderInput): Promise<ProviderOrder>;
  /** True only when the signature matches: the browser's word that it paid is never taken on trust. */
  verifyCheckout(proof: CheckoutProof): boolean;
  verifyWebhook(rawBody: string, signature: string | null): boolean;
  parseWebhook(rawBody: string, headers: { get(name: string): string | null }): ProviderEvent;
  /** Capture a payment that was only authorised, so it can be refunded later. A no-op when already captured. */
  ensureCaptured(providerPaymentId: string, amountMinor: number, currency: string): Promise<void>;
  createRefund(input: CreateRefundInput): Promise<ProviderRefund>;
}

export class PaymentNotConfiguredError extends Error {
  constructor() {
    super("Online payments are not set up yet.");
    this.name = "PaymentNotConfiguredError";
  }
}

export class ProviderError extends Error {
  /** True when retrying later may work (network, 5xx). False for a refusal such as "amount too high". */
  readonly transient: boolean;
  constructor(message: string, transient: boolean) {
    super(message);
    this.name = "ProviderError";
    this.transient = transient;
  }
}
