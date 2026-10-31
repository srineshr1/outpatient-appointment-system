import { afterEach, beforeAll, describe, expect, it } from "vitest";
import type { AppointmentRecord, UserAccount } from "../clinic-types";
import { now, setNow } from "../clock";
import { forgetBlockedSlots, blockedSlotIds } from "../blocked-slots";
import { cronAuthorised } from "../cron";
import { loadDoctors } from "../doctors";
import { dispatchDue, scheduleReminders } from "../notifications/service";
import { renderNotice } from "../notifications/templates";
import type { NoticeData } from "../notifications/types";
import { getOps } from "../ops";
import type { OpsStore } from "../ops/types";
import { confirmBooking, getUpcoming } from "../repository";
import { rescheduleVisit } from "../reschedule";
import { slotStart } from "../schedule";
import { getStore } from "../store";
import { changeAppointmentStatus } from "../visits";
import { setPaymentProviderForTests } from "./index";
import { releaseExpiredHolds } from "./holds";
import {
  ProviderError,
  type CheckoutProof,
  type CreateOrderInput,
  type CreateRefundInput,
  type PaymentProvider,
  type ProviderRefund,
} from "./provider";
import { checkoutSignature, hmacHex, parseRazorpayEvent, RazorpayProvider, signaturesMatch } from "./razorpay";
import { computeRefund, DEFAULT_REFUND_POLICY, normalisePolicy } from "./refund-policy";
import { beginCheckout, handleWebhook, issueRefund, PaymentError, retryRefunds, verifyCheckout } from "./service";

const KEY_SECRET = "test_key_secret";
const WEBHOOK_SECRET = "test_webhook_secret";
const MONDAY = Date.UTC(2026, 9, 26, 13, 40);

/** A stand-in for Razorpay: real signature maths, no network. */
let orderCounter = 0;
let refundCounter = 0;

class FakeProvider implements PaymentProvider {
  readonly name = "razorpay";
  orders: CreateOrderInput[] = [];
  refunds: CreateRefundInput[] = [];
  refundError: ProviderError | null = null;
  refundStatus: ProviderRefund["status"] = "pending";
  private refundIds = new Map<string, string>();
  isConfigured = () => true;
  webhookConfigured = () => true;
  publicKey = () => "rzp_test_fake";
  async createOrder(input: CreateOrderInput) {
    this.orders.push(input);
    orderCounter += 1;
    return { id: `order_${orderCounter}`, amountMinor: input.amountMinor, currency: input.currency };
  }
  verifyCheckout(proof: CheckoutProof) {
    return signaturesMatch(checkoutSignature(KEY_SECRET, proof.orderId, proof.paymentId), proof.signature);
  }
  verifyWebhook(rawBody: string, signature: string | null) {
    return signaturesMatch(hmacHex(WEBHOOK_SECRET, rawBody), signature);
  }
  parseWebhook(rawBody: string, headers: { get(name: string): string | null }) {
    return parseRazorpayEvent(rawBody, headers.get("x-razorpay-event-id"));
  }
  async ensureCaptured() {}
  async createRefund(input: CreateRefundInput): Promise<ProviderRefund> {
    this.refunds.push(input);
    if (this.refundError) throw this.refundError;
    // The same key always gives the same refund, like the real API.
    const id = this.refundIds.get(input.idempotencyKey) ?? `rfnd_${++refundCounter}`;
    this.refundIds.set(input.idempotencyKey, id);
    return { id, paymentId: input.providerPaymentId, amountMinor: input.amountMinor, status: this.refundStatus };
  }
}

function proofFor(orderId: string, paymentId: string): CheckoutProof {
  return { orderId, paymentId, signature: checkoutSignature(KEY_SECRET, orderId, paymentId) };
}

function webhook(event: string, entities: Record<string, unknown>, id: string) {
  const rawBody = JSON.stringify({ event, payload: entities });
  const headers = new Headers({ "x-razorpay-signature": hmacHex(WEBHOOK_SECRET, rawBody), "x-razorpay-event-id": id });
  return { rawBody, headers };
}

const paid = (orderId: string, paymentId: string, amount: number, event = "payment.captured") =>
  ({ payment: { entity: { id: paymentId, order_id: orderId, amount, method: "upi", status: "captured" } } }) as Record<string, unknown>;

const refundEvent = (status: string, refundId: string, paymentId: string, amount: number) =>
  ({ refund: { entity: { id: refundId, payment_id: paymentId, amount, status } } }) as Record<string, unknown>;

describe("refund policy maths", () => {
  const startsAt = new Date("2026-11-02T10:00:00.000Z");
  const hoursBefore = (hours: number) => new Date(startsAt.getTime() - hours * 3_600_000);
  const decide = (hours: number, cancelledBy: "patient" | "clinic" = "patient", paidMinor = 100_000) =>
    computeRefund({ paidMinor, startsAt, cancelledAt: hoursBefore(hours), cancelledBy });

  it("refunds in full more than 24 hours ahead, half from 2 to 24 hours, nothing under 2 hours", () => {
    expect(decide(48)).toMatchObject({ percent: 100, refundMinor: 100_000 });
    expect(decide(24)).toMatchObject({ percent: 100, refundMinor: 100_000 });
    expect(decide(23.9)).toMatchObject({ percent: 50, refundMinor: 50_000 });
    expect(decide(2)).toMatchObject({ percent: 50, refundMinor: 50_000 });
    expect(decide(1.99)).toMatchObject({ percent: 0, refundMinor: 0 });
    expect(decide(-1)).toMatchObject({ percent: 0, refundMinor: 0 });
  });

  it("refunds a cancellation by the doctor or clinic in full, however late", () => {
    expect(decide(0.5, "clinic")).toMatchObject({ percent: 100, refundMinor: 100_000 });
    expect(decide(-3, "clinic")).toMatchObject({ percent: 100 });
  });

  it("rounds down to whole paise and never refunds more than was paid", () => {
    expect(decide(10, "patient", 33_333).refundMinor).toBe(16_666);
    expect(decide(10, "patient", 1).refundMinor).toBe(0);
    const generous = normalisePolicy({ tiers: [{ minHours: 0, percent: 250 }], doctorCancelPercent: 100 });
    expect(computeRefund({ paidMinor: 500, startsAt, cancelledAt: hoursBefore(5), cancelledBy: "patient", policy: generous }).refundMinor).toBe(500);
  });

  it("reads a stored policy, sorts its tiers, and falls back to the default for junk", () => {
    expect(normalisePolicy(null)).toEqual(DEFAULT_REFUND_POLICY);
    expect(normalisePolicy("nonsense")).toEqual(DEFAULT_REFUND_POLICY);
    const custom = normalisePolicy({
      tiers: [{ minHours: 0, percent: 0 }, { minHours: 72, percent: 100 }, { minHours: 12, percent: 25 }, { minHours: -5, percent: 100 }, { minHours: "x" }],
      doctorCancelPercent: 80,
    });
    expect(custom.tiers.map((tier) => tier.minHours)).toEqual([72, 12, 0]);
    expect(decide(0.5, "clinic", 1000)).toMatchObject({ percent: 100 });
    expect(computeRefund({ paidMinor: 1000, startsAt, cancelledAt: hoursBefore(20), cancelledBy: "patient", policy: custom }).refundMinor).toBe(250);
    expect(computeRefund({ paidMinor: 1000, startsAt, cancelledAt: hoursBefore(20), cancelledBy: "clinic", policy: custom }).refundMinor).toBe(800);
  });
});

describe("signature verification", () => {
  const provider = new RazorpayProvider();
  const saved = { ...process.env };
  afterEach(() => {
    process.env.RAZORPAY_KEY_ID = saved.RAZORPAY_KEY_ID;
    process.env.RAZORPAY_KEY_SECRET = saved.RAZORPAY_KEY_SECRET;
    process.env.RAZORPAY_WEBHOOK_SECRET = saved.RAZORPAY_WEBHOOK_SECRET;
  });

  it("accepts the checkout signature only for the right order, payment and secret", () => {
    process.env.RAZORPAY_KEY_ID = "rzp_test_x";
    process.env.RAZORPAY_KEY_SECRET = KEY_SECRET;
    const good = proofFor("order_A", "pay_A");
    expect(provider.verifyCheckout(good)).toBe(true);
    expect(provider.verifyCheckout({ ...good, paymentId: "pay_B" })).toBe(false);
    expect(provider.verifyCheckout({ ...good, orderId: "order_B" })).toBe(false);
    expect(provider.verifyCheckout({ ...good, signature: "" })).toBe(false);
    expect(provider.verifyCheckout({ ...good, signature: good.signature.slice(0, -1) })).toBe(false);
    process.env.RAZORPAY_KEY_SECRET = "";
    expect(provider.verifyCheckout(good)).toBe(false);
  });

  it("verifies the webhook over the raw body, and refuses when no secret is set", () => {
    process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
    const body = '{"event":"payment.captured"}';
    expect(provider.verifyWebhook(body, hmacHex(WEBHOOK_SECRET, body))).toBe(true);
    expect(provider.verifyWebhook(`${body} `, hmacHex(WEBHOOK_SECRET, body))).toBe(false);
    expect(provider.verifyWebhook(body, null)).toBe(false);
    process.env.RAZORPAY_WEBHOOK_SECRET = "";
    expect(provider.verifyWebhook(body, hmacHex(WEBHOOK_SECRET, body))).toBe(false);
    expect(provider.webhookConfigured()).toBe(false);
  });

  it("does not call itself configured without both keys", () => {
    process.env.RAZORPAY_KEY_ID = "";
    process.env.RAZORPAY_KEY_SECRET = "";
    expect(provider.isConfigured()).toBe(false);
  });
});

describe("payments, holds, refunds and reminders", () => {
  let fake: FakeProvider;
  let ops: OpsStore;
  let patient: UserAccount;
  let slotCursor: Record<string, number> = {};

  async function nextSlot(doctorId: string, minHoursAway = 0) {
    const slots = (await getUpcoming(60))[doctorId]!;
    const slot = slots.slice(slotCursor[doctorId] ?? 0).find((candidate) => slotStart({ date: candidate.date, time: candidate.time }).getTime() - now().getTime() >= minHoursAway * 3_600_000);
    if (!slot) throw new Error("no slot");
    slotCursor[doctorId] = slots.indexOf(slot) + 1;
    return slot;
  }

  async function bookOnline(doctorId = "reid", minHoursAway = 0) {
    const slot = await nextSlot(doctorId, minHoursAway);
    const result = await confirmBooking({ slot, reasonId: "follow", patientName: "Ann Lee", patientUserId: "user-patient-demo", payOnline: true });
    return { slot, visit: result.visit };
  }

  async function pay(visit: AppointmentRecord, paymentRef = "pay_1") {
    const session = await beginCheckout(visit);
    const result = await verifyCheckout(session.paymentId, proofFor(session.orderId, paymentRef));
    return { session, result };
  }

  const status = async (id: string) => (await (await getStore()).getAppointment(id))!.status;
  const kinds = async (appointmentId: string, state?: "scheduled" | "sent" | "cancelled") =>
    (await ops.listNotifications({ appointmentId })).filter((row) => !state || row.status === state).map((row) => row.kind);

  beforeAll(async () => {
    setNow(MONDAY);
    ops = await getOps();
    patient = (await (await getStore()).getUserById("user-patient-demo"))!;
    await loadDoctors(true);
  });

  afterEach(() => {
    setPaymentProviderForTests(null);
    setNow(MONDAY);
  });

  function useFake() {
    fake = new FakeProvider();
    setPaymentProviderForTests(fake);
    setNow(MONDAY);
    forgetBlockedSlots();
  }

  describe("checkout", () => {
    it("holds the place, then charges the doctor's stored fee, never a client amount", async () => {
      useFake();
      await ops.setDoctorFee("reid", 123_400);
      const { slot, visit } = await bookOnline("reid");
      expect(visit.status).toBe("pending_payment");
      forgetBlockedSlots();
      expect(await blockedSlotIds()).toContain(slot.id);

      const session = await beginCheckout(visit);
      expect(fake.orders).toHaveLength(1);
      expect(fake.orders[0]).toMatchObject({ amountMinor: 123_400, currency: "INR" });
      expect(session).toMatchObject({ amountMinor: 123_400, publicKey: "rzp_test_fake" });
      // Asking again for the same visit gives the same order, not a second charge.
      expect((await beginCheckout(visit)).orderId).toBe(session.orderId);
      expect(fake.orders).toHaveLength(1);
      expect(new Date(session.holdExpiresAt).getTime() - now().getTime()).toBe(15 * 60_000);
      await ops.setDoctorFee("reid", 40_000);
    });

    it("confirms only on a valid signature for this visit's own order", async () => {
      useFake();
      const { visit } = await bookOnline("adeyemi");
      const session = await beginCheckout(visit);
      await expect(verifyCheckout(session.paymentId, { orderId: session.orderId, paymentId: "pay_x", signature: "bad" })).rejects.toMatchObject({ code: "bad_signature" });
      await expect(verifyCheckout(session.paymentId, proofFor("order_other", "pay_x"))).rejects.toMatchObject({ code: "mismatch" });
      expect(await status(visit.id)).toBe("pending_payment");

      const result = await verifyCheckout(session.paymentId, proofFor(session.orderId, "pay_ok"));
      expect(result.status).toBe("confirmed");
      expect(await status(visit.id)).toBe("booked");
      expect((await ops.getPayment(session.paymentId))).toMatchObject({ status: "captured", providerPaymentId: "pay_ok" });
      // A second verify (double click, or the webhook first) changes nothing and queues no second email.
      expect((await verifyCheckout(session.paymentId, proofFor(session.orderId, "pay_ok"))).status).toBe("confirmed");
      expect((await kinds(visit.id)).filter((kind) => kind === "payment_confirmed")).toHaveLength(1);
      expect((await kinds(visit.id)).filter((kind) => kind === "booking_confirmed")).toHaveLength(1);
    });

    it("books a fee-free doctor without payment", async () => {
      useFake();
      await ops.setDoctorFee("cho", 0);
      const slot = await nextSlot("cho");
      const result = await confirmBooking({ slot, reasonId: "follow", patientName: "Ann Lee", patientUserId: "user-patient-demo" });
      expect(result.visit.status).toBe("booked");
      expect(result.payment).toMatchObject({ amountPence: 0 });
      await ops.setDoctorFee("cho", 50_000);
    });
  });

  describe("webhooks", () => {
    it("refuses a bad signature and a missing secret before touching anything", async () => {
      useFake();
      const { rawBody, headers } = webhook("payment.captured", paid("order_1", "pay_1", 100), "evt_bad");
      headers.set("x-razorpay-signature", "0".repeat(64));
      expect((await handleWebhook(rawBody, headers)).status).toBe(400);
      fake.webhookConfigured = () => false;
      expect((await handleWebhook(rawBody, headers)).status).toBe(503);
    });

    it("confirms on payment.captured, and a repeated delivery does nothing more", async () => {
      useFake();
      const { visit } = await bookOnline("rahman");
      const session = await beginCheckout(visit);
      const first = webhook("payment.captured", paid(session.orderId, "pay_wh", session.amountMinor), "evt_1");
      expect(await handleWebhook(first.rawBody, first.headers)).toMatchObject({ status: 200, body: { outcome: "confirmed" } });
      expect(await status(visit.id)).toBe("booked");
      expect(await handleWebhook(first.rawBody, first.headers)).toMatchObject({ status: 200, body: { duplicate: true } });
      // The same payment under a different event id (authorized, then captured) is also harmless.
      const again = webhook("order.paid", paid(session.orderId, "pay_wh", session.amountMinor), "evt_2");
      expect((await handleWebhook(again.rawBody, again.headers)).status).toBe(200);
      expect((await kinds(visit.id)).filter((kind) => kind === "payment_confirmed")).toHaveLength(1);
    });

    it("ignores a captured amount that is not what the order was for", async () => {
      useFake();
      const { visit } = await bookOnline("rahman");
      const session = await beginCheckout(visit);
      const event = webhook("payment.captured", paid(session.orderId, "pay_short", session.amountMinor - 1), "evt_amt");
      expect(await handleWebhook(event.rawBody, event.headers)).toMatchObject({ status: 200, body: { outcome: "amount_mismatch" } });
      expect(await status(visit.id)).toBe("pending_payment");
    });

    it("answers 500 when processing fails so the provider redelivers, and finishes on the retry", async () => {
      useFake();
      const { visit } = await bookOnline("rahman");
      const session = await beginCheckout(visit);
      const event = webhook("payment.captured", paid(session.orderId, "pay_retry", session.amountMinor), "evt_retry");
      const original = ops.confirmPayment.bind(ops);
      let calls = 0;
      ops.confirmPayment = async (...args) => {
        calls += 1;
        if (calls === 1) throw new Error("database blip");
        return original(...args);
      };
      try {
        expect((await handleWebhook(event.rawBody, event.headers)).status).toBe(500);
        expect(await status(visit.id)).toBe("pending_payment");
        expect(await handleWebhook(event.rawBody, event.headers)).toMatchObject({ status: 200, body: { outcome: "confirmed" } });
        expect(await status(visit.id)).toBe("booked");
        expect(await handleWebhook(event.rawBody, event.headers)).toMatchObject({ body: { duplicate: true } });
      } finally {
        ops.confirmPayment = original;
      }
    });

    it("records a failed payment and tells the patient while the place is still held", async () => {
      useFake();
      const { visit } = await bookOnline("rahman");
      const session = await beginCheckout(visit);
      const failed = webhook(
        "payment.failed",
        { payment: { entity: { id: "pay_fail", order_id: session.orderId, error_description: "Card declined" } } },
        "evt_fail",
      );
      expect(await handleWebhook(failed.rawBody, failed.headers)).toMatchObject({ status: 200, body: { outcome: "failed_recorded" } });
      expect(await status(visit.id)).toBe("pending_payment");
      expect(await kinds(visit.id)).toContain("payment_failed");
      // Trying again with a good payment still works.
      const retry = await verifyCheckout(session.paymentId, proofFor(session.orderId, "pay_good"));
      expect(retry.status).toBe("confirmed");
    });
  });

  describe("holds that run out", () => {
    it("releases an unpaid hold after the time limit and frees the place", async () => {
      useFake();
      const { slot, visit } = await bookOnline("adeyemi");
      const session = await beginCheckout(visit);
      setNow(MONDAY + 14 * 60_000);
      expect(await releaseExpiredHolds()).toEqual([]);
      setNow(MONDAY + 16 * 60_000);
      forgetBlockedSlots();
      expect(await releaseExpiredHolds()).toContain(visit.id);
      expect(await status(visit.id)).toBe("expired");
      expect((await ops.getPayment(session.paymentId))?.status).toBe("expired");
      expect(await blockedSlotIds()).not.toContain(slot.id);
      expect(await kinds(visit.id)).toContain("hold_expired");
      await expect(beginCheckout(visit)).rejects.toBeInstanceOf(PaymentError);
      // Nothing to sweep the second time.
      expect(await releaseExpiredHolds()).toEqual([]);
    });

    it("confirms a late payment when the place is still free", async () => {
      useFake();
      const { visit } = await bookOnline("adeyemi");
      const session = await beginCheckout(visit);
      setNow(MONDAY + 20 * 60_000);
      await releaseExpiredHolds();
      expect(await status(visit.id)).toBe("expired");
      const event = webhook("payment.captured", paid(session.orderId, "pay_late", session.amountMinor), "evt_late_ok");
      expect(await handleWebhook(event.rawBody, event.headers)).toMatchObject({ status: 200, body: { outcome: "confirmed" } });
      expect(await status(visit.id)).toBe("booked");
      expect(fake.refunds).toHaveLength(0);
    });

    it("refunds a late payment in full when someone else took the place", async () => {
      useFake();
      const { slot, visit } = await bookOnline("adeyemi");
      const session = await beginCheckout(visit);
      setNow(MONDAY + 20 * 60_000);
      await releaseExpiredHolds();
      forgetBlockedSlots();
      // Another patient books the freed place.
      const taken = await confirmBooking({ slot, reasonId: "follow", patientName: "Bo Lee", patientUserId: "user-patient-demo" });
      expect(taken.visit.status).toBe("booked");

      const event = webhook("payment.captured", paid(session.orderId, "pay_lost", session.amountMinor), "evt_late_lost");
      expect(await handleWebhook(event.rawBody, event.headers)).toMatchObject({ status: 200, body: { outcome: "refunded_late" } });
      expect(await status(visit.id)).toBe("expired");
      expect(fake.refunds).toHaveLength(1);
      expect(fake.refunds[0]).toMatchObject({ providerPaymentId: "pay_lost", amountMinor: session.amountMinor });
      const [refund] = await ops.listRefunds({ appointmentIds: [visit.id] });
      expect(refund).toMatchObject({ kind: "late_payment", status: "pending", amountMinor: session.amountMinor });
      expect(await kinds(visit.id)).toContain("refund_initiated");
      expect(await kinds(taken.visit.id)).not.toContain("refund_initiated");
    });
  });

  describe("cancelling and refunds", () => {
    it("refunds a payment in full when a patient cancels well ahead, and says it is only initiated", async () => {
      useFake();
      const { visit } = await bookOnline("reid", 30);
      await pay(visit, "pay_c1");
      expect(await changeAppointmentStatus(patient, visit.id, "cancelled")).toBe("ok");
      expect(fake.refunds).toHaveLength(1);
      expect(fake.refunds[0]).toMatchObject({ providerPaymentId: "pay_c1", amountMinor: 40_000 });
      const [refund] = await ops.listRefunds({ appointmentIds: [visit.id] });
      expect(refund).toMatchObject({ kind: "patient_cancel", status: "pending", amountMinor: 40_000 });
      // The cancellation email carries the refund, worded as started rather than finished.
      const [cancelled] = (await ops.listNotifications({ appointmentId: visit.id })).filter((row) => row.kind === "appointment_cancelled");
      const data = cancelled!.payload as unknown as NoticeData;
      expect(data.refundMinor).toBe(40_000);
      const text = JSON.stringify(renderNotice("appointment_cancelled", data)).toLowerCase();
      expect(text).toContain("initiated");
      expect(text).not.toMatch(/has been refunded|was refunded|refunded in full/);
    });

    it("gives half back from 2 to 24 hours ahead and nothing under 2 hours", async () => {
      useFake();
      const half = await bookOnline("reid", 6);
      await pay(half.visit, "pay_half");
      setNow(slotStart(half.visit).getTime() - 10 * 3_600_000);
      expect(await changeAppointmentStatus(patient, half.visit.id, "cancelled")).toBe("ok");
      expect((await ops.listRefunds({ appointmentIds: [half.visit.id] }))[0]).toMatchObject({ amountMinor: 20_000 });

      setNow(MONDAY);
      const none = await bookOnline("reid", 6);
      await pay(none.visit, "pay_none");
      setNow(slotStart(none.visit).getTime() - 60 * 60_000);
      expect(await changeAppointmentStatus(patient, none.visit.id, "cancelled")).toBe("ok");
      expect(await ops.listRefunds({ appointmentIds: [none.visit.id] })).toHaveLength(0);
    });

    it("refunds in full when the doctor's side cancels, even at the last minute", async () => {
      useFake();
      const { visit } = await bookOnline("reid", 6);
      await pay(visit, "pay_doc");
      setNow(slotStart(visit).getTime() - 30 * 60_000);
      const desk = (await (await getStore()).getUserById("user-desk"))!;
      expect(await changeAppointmentStatus(desk, visit.id, "cancelled", "Doctor called in sick")).toBe("ok");
      expect((await ops.listRefunds({ appointmentIds: [visit.id] }))[0]).toMatchObject({ kind: "doctor_cancel", amountMinor: 40_000 });
    });

    it("allows one active refund per payment and treats a repeat request as the same refund", async () => {
      useFake();
      const { visit } = await bookOnline("reid", 30);
      await pay(visit, "pay_dup");
      const payment = (await ops.getPaymentByAppointment(visit.id))!;
      const first = await issueRefund({ payment, visit, kind: "admin", amountMinor: 10_000, percent: 25, reason: "Goodwill" });
      expect(first.outcome).toBe("created");
      const second = await issueRefund({ payment, visit, kind: "admin", amountMinor: 10_000, percent: 25, reason: "Goodwill" });
      expect(second.outcome).toBe("existing");
      expect(second.refund?.id).toBe(first.refund?.id);
      const other = await issueRefund({ payment, visit, kind: "patient_cancel", amountMinor: 30_000, percent: 75, reason: "Cancelled" });
      expect(other.outcome).toBe("existing");
      expect(fake.refunds).toHaveLength(1);
      expect(await ops.listRefunds({ paymentId: payment.id })).toHaveLength(1);
    });

    it("moves a refund to completed only when the provider confirms, once", async () => {
      useFake();
      const { visit } = await bookOnline("reid", 30);
      await pay(visit, "pay_done");
      await changeAppointmentStatus(patient, visit.id, "cancelled");
      const [refund] = await ops.listRefunds({ appointmentIds: [visit.id] });
      expect(refund!.status).toBe("pending");
      const providerRefundId = (await ops.getRefund(refund!.id))!.providerRefundId!;
      expect(providerRefundId).toMatch(/^rfnd_/);

      const processed = webhook("refund.processed", refundEvent("processed", providerRefundId, "pay_done", 40_000), "evt_rf1");
      expect((await handleWebhook(processed.rawBody, processed.headers)).status).toBe(200);
      expect((await ops.getRefund(refund!.id))?.status).toBe("processed");
      expect(await kinds(visit.id)).toContain("refund_completed");
      // A late "created" event cannot move it backwards, and a repeat adds no second email.
      const stale = webhook("refund.created", refundEvent("pending", providerRefundId, "pay_done", 40_000), "evt_rf2");
      await handleWebhook(stale.rawBody, stale.headers);
      await handleWebhook(processed.rawBody, processed.headers);
      expect((await ops.getRefund(refund!.id))?.status).toBe("processed");
      expect((await kinds(visit.id)).filter((kind) => kind === "refund_completed")).toHaveLength(1);
    });

    it("marks a refused refund failed and tells the patient, then retries it with a new attempt", async () => {
      useFake();
      const { visit } = await bookOnline("reid", 30);
      await pay(visit, "pay_refuse");
      fake.refundError = new ProviderError("The payment has already been fully refunded", false);
      await changeAppointmentStatus(patient, visit.id, "cancelled");
      const [failed] = await ops.listRefunds({ appointmentIds: [visit.id] });
      expect(failed).toMatchObject({ status: "failed" });
      expect(await kinds(visit.id)).toContain("refund_failed");
      const copy = JSON.stringify(await ops.listNotifications({ appointmentId: visit.id }));
      expect(copy).not.toContain("refund_completed");

      // The cron gives a failed refund that never reached the provider another go once it has aged.
      fake.refundError = null;
      setNow(MONDAY + 30 * 60_000);
      expect(await retryRefunds()).toBeGreaterThanOrEqual(1);
      const refunds = await ops.listRefunds({ appointmentIds: [visit.id] });
      expect(refunds.some((refund) => refund.status === "pending" && refund.providerRefundId)).toBe(true);
    });

    it("leaves a refund pending on a network error and sends it again with the same key", async () => {
      useFake();
      const { visit } = await bookOnline("reid", 30);
      await pay(visit, "pay_net");
      fake.refundError = new ProviderError("network down", true);
      await changeAppointmentStatus(patient, visit.id, "cancelled");
      const [pending] = await ops.listRefunds({ appointmentIds: [visit.id] });
      expect(pending).toMatchObject({ status: "pending", providerRefundId: null });
      fake.refundError = null;
      setNow(MONDAY + 5 * 60_000);
      expect(await retryRefunds()).toBe(1);
      const [after] = await ops.listRefunds({ appointmentIds: [visit.id] });
      expect(after).toMatchObject({ id: pending!.id, status: "pending" });
      expect(after!.providerRefundId).toMatch(/^rfnd_/);
      expect(new Set(fake.refunds.slice(-2).map((call) => call.idempotencyKey)).size).toBe(1);
    });
  });

  describe("reminders", () => {
    async function bookDesk(doctorId: string, minHoursAway: number) {
      const slot = await nextSlot(doctorId, minHoursAway);
      const result = await confirmBooking({ slot, reasonId: "follow", patientName: "Ann Lee", patientUserId: "user-patient-demo" });
      const { onBookingConfirmed } = await import("../notifications/service");
      await onBookingConfirmed(result.visit);
      return result.visit;
    }
    const reminders = async (id: string, state: "scheduled" | "sent" | "cancelled" = "scheduled") =>
      (await ops.listNotifications({ appointmentId: id, kind: "reminder", status: state })).sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));

    it("schedules 24 h and 2 h reminders, and skips one whose time has already passed", async () => {
      useFake();
      const far = await bookDesk("cho", 40);
      const rows = await reminders(far.id);
      expect(rows).toHaveLength(2);
      const start = slotStart(far).getTime();
      expect(rows.map((row) => start - new Date(row.scheduledFor).getTime())).toEqual([1440 * 60_000, 120 * 60_000]);

      // Booked 10 hours before the start: the 24 h reminder is already past, so only the 2 h one is planned.
      const slot = await nextSlot("cho", 40);
      const nearVisit = (await confirmBooking({ slot, reasonId: "follow", patientName: "Ann Lee", patientUserId: "user-patient-demo" })).visit;
      setNow(slotStart(nearVisit).getTime() - 10 * 3_600_000);
      expect(await scheduleReminders(nearVisit)).toBe(1);
      expect(await reminders(nearVisit.id)).toHaveLength(1);
    });

    it("recalculates reminders when the visit moves", async () => {
      useFake();
      const visit = await bookDesk("cho", 40);
      const before = await reminders(visit.id);
      const later = await nextSlot("cho", 100);
      const outcome = await rescheduleVisit(patient, visit.id, later.id);
      expect(outcome.ok).toBe(true);
      const moved = (await (await getStore()).getAppointment(visit.id))!;
      expect(moved.slotId).toBe(later.id);
      expect((await reminders(visit.id, "cancelled")).map((row) => row.id).sort()).toEqual(before.map((row) => row.id).sort());
      const fresh = await reminders(visit.id);
      expect(fresh).toHaveLength(2);
      expect(slotStart(moved).getTime() - new Date(fresh[0]!.scheduledFor).getTime()).toBe(1440 * 60_000);
    });

    it("stops reminders when the visit is cancelled", async () => {
      useFake();
      const visit = await bookDesk("cho", 40);
      expect(await reminders(visit.id)).toHaveLength(2);
      expect(await changeAppointmentStatus(patient, visit.id, "cancelled")).toBe("ok");
      expect(await reminders(visit.id)).toHaveLength(0);
      expect(await reminders(visit.id, "cancelled")).toHaveLength(2);
    });

    it("stops reminders when the visit is completed", async () => {
      useFake();
      const visit = await bookDesk("cho", 40);
      const desk = (await (await getStore()).getUserById("user-desk"))!;
      expect(await changeAppointmentStatus(desk, visit.id, "completed")).toBe("ok");
      expect(await reminders(visit.id)).toHaveLength(0);
    });

    it("re-checks the visit before sending, and sends a reminder for a booked one when it is due", async () => {
      useFake();
      const stale = await bookDesk("cho", 40);
      const live = await bookDesk("cho", 40);
      // The visit gets cancelled behind the outbox's back (as if the cancel had missed the reminders).
      await (await getStore()).transitionStatus(stale.id, "booked", "cancelled");
      setNow(Math.min(slotStart(live).getTime(), slotStart(stale).getTime()) - 3 * 3_600_000);
      const summary = await dispatchDue(1000);
      expect(summary.failed).toBe(0);
      expect((await reminders(stale.id, "cancelled")).length).toBeGreaterThanOrEqual(1);
      expect(await reminders(stale.id, "sent")).toHaveLength(0);
      const liveRows = await ops.listNotifications({ appointmentId: live.id, kind: "reminder" });
      expect(liveRows.some((row) => row.status === "sent" || row.status === "skipped")).toBe(true);
      expect(liveRows.some((row) => row.status === "cancelled")).toBe(false);
    });
  });
});

describe("cron authorisation", () => {
  const saved = process.env.CRON_SECRET;
  afterEach(() => {
    process.env.CRON_SECRET = saved;
  });

  it("accepts the environment secret or the stored one, and nothing else", async () => {
    const ops = await getOps();
    await ops.setSetting("cron_secret", "stored-secret-value-1234");
    process.env.CRON_SECRET = "env-secret-value-123456";
    expect(await cronAuthorised("Bearer env-secret-value-123456")).toBe(true);
    expect(await cronAuthorised("Bearer stored-secret-value-1234")).toBe(true);
    expect(await cronAuthorised("Bearer wrong-secret-value-12345")).toBe(false);
    expect(await cronAuthorised("env-secret-value-123456")).toBe(false);
    expect(await cronAuthorised(null)).toBe(false);
    expect(await cronAuthorised("Bearer short")).toBe(false);
    process.env.CRON_SECRET = "";
    expect(await cronAuthorised("Bearer env-secret-value-123456")).toBe(false);
  });
});
