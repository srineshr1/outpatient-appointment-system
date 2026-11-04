import type { PaymentProvider } from "./provider";
import { RazorpayProvider } from "./razorpay";

let override: PaymentProvider | null = null;

/** Tests pin a fake provider here. Pass null to go back to the real one. */
export function setPaymentProviderForTests(provider: PaymentProvider | null): void {
  override = provider;
}

/** The configured provider. PAYMENT_PROVIDER picks it; Razorpay is the only one so far. */
export function getPaymentProvider(): PaymentProvider {
  if (override) return override;
  // A second provider (Stripe) would be added here behind the same interface.
  return new RazorpayProvider();
}

/** Whether a patient can pay online right now. False shows the graceful "not set up" state. */
export function onlinePaymentsAvailable(): boolean {
  return getPaymentProvider().isConfigured();
}
