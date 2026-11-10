import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppointmentRecord, ClinicStore, ConsultSession, PublicUser } from "./clinic-types";
import { setNow } from "./clock";
import { getOps, resetOpsForTests } from "./ops";
import { setPaymentProviderForTests } from "./payments/index";
import type { CreateRefundInput, PaymentProvider } from "./payments/provider";
import { SqliteClinicStore } from "./sqlite-store";
import { hashToken } from "./passwords";

const state = vi.hoisted(() => ({ store: null as ClinicStore | null }));
vi.mock("./store", () => ({ getStore: async () => state.store! }));
import {
  acceptOffer,
  cancelOffer,
  displaceAndSave,
  displacedBy,
  displacedFor,
  expireOffers,
  findOffer,
  OFFER_SLOTS,
  pickAlternatives,
  rebookPath,
  rebookToken,
} from "./rebooking";

const session: ConsultSession = { id: "rebook", doctorId: "doctor", label: "Clinic", weekdays: [1],
  startTime: "10:00", endTime: "12:00", room: "Test", mode: "stream", slotMinutes: 30,
  waveMinutes: null, waveCapacity: null, archivedAt: null, createdAt: "", updatedAt: "" };
const doctor = { id: "doctor", doctorId: "doctor", role: "doctor", name: "Dr Example", email: "doctor@example.org", mobile: "", dob: "" } as PublicUser;

function visit(id: string, time: string, patch: Partial<AppointmentRecord> = {}): AppointmentRecord {
  const end = `${time.slice(0, 2)}:${time.slice(3) === "00" ? "30" : "00"}`;
  const endTime = time.slice(3) === "30" ? `${String(Number(time.slice(0, 2)) + 1).padStart(2, "0")}:00` : end;
  return { id, reference: `HSP-${id}`, doctorId: "doctor", slotId: `doctor-2099-01-05-${time.replace(":", "")}`,
    date: "2099-01-05", time, endTime, sessionId: session.id, token: null, waveCapacity: null, reasonId: "new",
    patientName: "Ann Example", patientDob: "", patientMobile: "", patientChi: "", note: "", patientUserId: "patient",
    createdAt: "", status: "booked", ...patch };
}

class FakeProvider implements Partial<PaymentProvider> {
  readonly name = "razorpay";
  refunds: CreateRefundInput[] = [];
  isConfigured = () => true;
  webhookConfigured = () => true;
  publicKey = () => "rzp_test_fake";
  async createRefund(input: CreateRefundInput) {
    this.refunds.push(input);
    return { id: `rfnd_${this.refunds.length}`, paymentId: input.providerPaymentId, amountMinor: input.amountMinor, status: "pending" as const };
  }
}
let provider: FakeProvider;

async function paid(appointmentId: string) {
  await (await getOps()).createPayment({ id: `pay-${appointmentId}`, appointmentId, provider: "razorpay", providerOrderId: `order-${appointmentId}`,
    providerPaymentId: `pay_${appointmentId}`, amountMinor: 50000, currency: "INR", status: "captured", failureReason: "", method: "card",
    holdExpiresAt: "2099-01-01T00:15:00.000Z", createdAt: "2099-01-01T00:00:00.000Z", paidAt: "2099-01-01T00:01:00.000Z" });
}

async function shrinkWithBookings() {
  const store = state.store!;
  expect(await store.createAppointment(visit("late", "11:30"))).toBe("ok");
  expect(await store.createAppointment(visit("hold", "11:00", { status: "pending_payment" }))).toBe("ok");
  expect(await store.createAppointment(visit("kept", "10:30"))).toBe("ok");
  await paid("late");
  const next = { ...session, endTime: "11:00" };
  const result = await displaceAndSave(doctor, session, next, [], { expected: 1 });
  if (!result.ok) throw new Error(`displacement failed: ${result.reason}`);
  return result;
}

beforeEach(async () => {
  setNow(Date.parse("2099-01-01T00:00:00Z"));
  state.store = new SqliteClinicStore(":memory:");
  await state.store.ensureReady();
  await state.store.putConsultSession(session);
  resetOpsForTests();
  provider = new FakeProvider();
  setPaymentProviderForTests(provider as unknown as PaymentProvider);
});

describe("which visits a change displaces", () => {
  it("finds booked visits outside the new hours, or every reservation when the session is removed", () => {
    const visits = [visit("a", "10:30"), visit("b", "11:30"), visit("c", "11:00", { status: "pending_payment" }),
      visit("d", "11:30", { status: "cancelled", slotId: "x" }), visit("e", "11:30", { date: "2098-12-28" })];
    // A payment hold keeps its original time on a shrink, as elastic scheduling already allows.
    expect(displacedBy(visits, session, { ...session, endTime: "11:00" }, "2099-01-01").map((item) => item.id)).toEqual(["b"]);
    expect(displacedBy(visits, session, { ...session, startTime: "09:00" }, "2099-01-01")).toEqual([]);
    expect(displacedBy(visits, session, { ...session, archivedAt: "2099-01-01T00:00:00Z" }, "2099-01-01").map((item) => item.id)).toEqual(["a", "c", "b"]);
  });

  it("offers the nearest free times first, skipping reserved ones", () => {
    const next = { ...session, endTime: "11:00" };
    const picks = pickAlternatives({ visit: visit("b", "11:30"), sessions: [next], trims: [], reserved: [visit("a", "10:30")],
      instant: new Date("2099-01-01T00:00:00Z") });
    expect(picks).toHaveLength(OFFER_SLOTS);
    expect(picks.map((slot) => `${slot.date} ${slot.time}`)).toEqual(["2099-01-05 10:00", "2099-01-12 10:00", "2099-01-12 10:30"]);
  });

  it("gives each wave hold its own token", () => {
    const wave: ConsultSession = { ...session, id: "wave", mode: "wave", slotMinutes: null, waveMinutes: 60, waveCapacity: 2 };
    const taken = visit("w", "10:00", { slotId: "w-wave-2099-01-05-1000#1", sessionId: "wave", token: 1, waveCapacity: 2, endTime: "11:00" });
    const picks = pickAlternatives({ visit: visit("b", "10:00"), sessions: [wave], trims: [], reserved: [taken],
      instant: new Date("2099-01-01T00:00:00Z"), count: 1 });
    expect(picks[0]).toMatchObject({ slotId: "w-wave-2099-01-05-1000#2", token: 2, waveCapacity: 2 });
  });
});

describe("displacing", () => {
  it("keeps the original rows, holds new times and saves the session in one write", async () => {
    const result = await shrinkWithBookings();
    const store = state.store!;
    expect((await store.getConsultSession(session.id))?.endTime).toBe("11:00");
    const late = (await store.getAppointment("late"))!;
    expect(late).toMatchObject({ status: "displaced", time: "11:30", slotId: "doctor-2099-01-05-1130", reference: "HSP-late" });
    expect(late.displacedAt).toBe("2099-01-01T00:00:00.000Z");
    expect((await store.getAppointment("hold"))).toMatchObject({ status: "pending_payment", time: "11:00" });
    expect((await store.getAppointment("kept"))?.status).toBe("booked");

    expect(result.offers).toHaveLength(1);
    const offer = result.offers[0]!;
    expect(offer.appointmentId).toBe("late");
    expect(offer.expiresAt).toBe("2099-01-02T00:00:00.000Z");
    expect(offer.slots.map((slot) => `${slot.date} ${slot.time}`)).toEqual(["2099-01-05 10:00", "2099-01-12 10:00", "2099-01-12 10:30"]);
    // Only the hash is stored, and it matches the link's token.
    expect(offer.tokenHash).toBe(hashToken(rebookToken(offer.id)));
    expect(JSON.stringify(await store.listRebookingOffers())).not.toContain(rebookToken(offer.id));
    expect(rebookPath(offer.id, offer.slots[0]!.slotId)).toBe(`/rebook/${rebookToken(offer.id)}?slot=doctor-2099-01-05-1000`);

    // Held places count as reserved for everybody else.
    expect(await store.listBlockedSlotIds()).toContain("doctor-2099-01-05-1000");
    expect(await store.createAppointment(visit("thief", "10:00", { reference: "HSP-thief" }))).toBe("taken");
  });

  it("releases unpaid holds without an offer when the whole session is removed", async () => {
    await state.store!.createAppointment(visit("late", "11:30"));
    await state.store!.createAppointment(visit("hold", "11:00", { status: "pending_payment" }));
    const result = await displaceAndSave(doctor, session, { ...session, archivedAt: "2099-01-01T00:00:00.000Z" }, [], { expected: 2 });
    expect(result.ok).toBe(true);
    expect((await state.store!.getConsultSession(session.id))?.archivedAt).toBe("2099-01-01T00:00:00.000Z");
    expect((await state.store!.getAppointment("hold"))?.status).toBe("displaced");
    // No other session runs, so the offer has no times to hold; the patient can still cancel for a refund.
    if (result.ok) expect(result.offers.map((offer) => [offer.appointmentId, offer.slots.length])).toEqual([["late", 0]]);
    expect((await displacedFor("doctor")).map((entry) => [entry.visit.id, entry.status]).sort()).toEqual([["hold", "released"], ["late", "pending"]]);
  });

  it("asks again when a different number of patients is affected, and changes nothing", async () => {
    await state.store!.createAppointment(visit("late", "11:30"));
    const result = await displaceAndSave(doctor, session, { ...session, endTime: "11:00" }, [], { expected: 2 });
    expect(result).toEqual({ ok: false, reason: "changed" });
    expect((await state.store!.getAppointment("late"))?.status).toBe("booked");
    expect((await state.store!.getConsultSession(session.id))?.endTime).toBe("12:00");
  });

  it("refuses a stale read without writing anything", async () => {
    await state.store!.createAppointment(visit("late", "11:30"));
    const outcome = await state.store!.saveSessionDisplacing({ ...session, endTime: "11:00" }, [], [
      { appointmentId: "late", fromStatus: "pending_payment", fromSlotId: "doctor-2099-01-05-1130", reason: "x", at: "2099-01-01T00:00:00Z", offer: null },
    ]);
    expect(outcome).toBe("stale");
    expect((await state.store!.getAppointment("late"))?.status).toBe("booked");
    expect((await state.store!.getConsultSession(session.id))?.endTime).toBe("12:00");
  });
});

describe("the patient's choice", () => {
  it("moves the visit to an offered time, keeps the payment and releases the other holds", async () => {
    const { offers } = await shrinkWithBookings();
    const offer = offers[0]!;
    const token = rebookToken(offer.id);
    expect((await findOffer(token)).state).toBe("pending");

    const result = await acceptOffer(token, offer.slots[1]!.slotId);
    expect(result.ok).toBe(true);
    const moved = (await state.store!.getAppointment("late"))!;
    expect(moved).toMatchObject({ status: "booked", date: "2099-01-12", time: "10:00", reference: "HSP-late", displacedAt: "2099-01-01T00:00:00.000Z" });
    expect((await state.store!.listRebookingOffers({ appointmentId: "late" }))[0]).toMatchObject({ status: "accepted", chosenSlotId: offer.slots[1]!.slotId, slots: [] });
    expect(await state.store!.listReschedules({ appointmentId: "late" })).toHaveLength(1);
    // Same payment, nothing charged again or refunded.
    expect((await (await getOps()).listPayments()).filter((payment) => payment.appointmentId === "late")).toHaveLength(1);
    expect(provider.refunds).toHaveLength(0);
    // The other offered times are free again.
    expect(await state.store!.createAppointment(visit("other", "10:00", { reference: "HSP-other" }))).toBe("ok");

    expect(await acceptOffer(token, offer.slots[2]!.slotId)).toEqual({ ok: false, reason: "closed" });
    expect((await findOffer(token)).state).toBe("accepted");
  });

  it("rejects unknown or malformed tokens", async () => {
    await shrinkWithBookings();
    expect((await findOffer("not a token")).state).toBe("invalid");
    expect((await findOffer(rebookToken("someone-else"))).state).toBe("invalid");
    expect(await acceptOffer(rebookToken("someone-else"), "doctor-2099-01-05-1000")).toEqual({ ok: false, reason: "invalid" });
  });

  it("cancels and refunds in full once, through the refund flow", async () => {
    const { offers } = await shrinkWithBookings();
    const token = rebookToken(offers[0]!.id);
    const result = await cancelOffer(token);
    expect(result.ok).toBe(true);
    expect((await state.store!.getAppointment("late"))).toMatchObject({ status: "cancelled", time: "11:30" });
    expect(provider.refunds).toHaveLength(1);
    expect(provider.refunds[0]).toMatchObject({ amountMinor: 50000, providerPaymentId: "pay_late" });
    const refunds = await (await getOps()).listRefunds({ appointmentIds: ["late"] });
    expect(refunds).toHaveLength(1);
    expect(refunds[0]).toMatchObject({ kind: "doctor_cancel", policyPercent: 100 });
    expect(await state.store!.listBlockedSlotIds()).not.toContain("doctor-2099-01-05-1000");
    expect(await cancelOffer(token)).toEqual({ ok: false, reason: "closed" });
    expect(provider.refunds).toHaveLength(1);
  });

  it("expires unanswered offers once: cancels, refunds and frees the holds", async () => {
    const { offers } = await shrinkWithBookings();
    const token = rebookToken(offers[0]!.id);
    setNow(Date.parse("2099-01-02T00:00:01Z"));
    expect(await acceptOffer(token, offers[0]!.slots[0]!.slotId)).toEqual({ ok: false, reason: "expired" });
    const closed = await expireOffers();
    expect(closed).toHaveLength(1);
    expect(closed[0]!.refund?.refund?.amountMinor).toBe(50000);
    expect((await state.store!.getAppointment("late"))?.status).toBe("cancelled");
    expect(await expireOffers()).toEqual([]);
    expect(provider.refunds).toHaveLength(1);
    expect((await findOffer(token)).state).toBe("expired");
  });

  it("lists displaced patients for the doctor with their status", async () => {
    const { offers } = await shrinkWithBookings();
    expect((await displacedFor("doctor")).map((entry) => [entry.visit.id, entry.status])).toEqual([["late", "pending"]]);
    await acceptOffer(rebookToken(offers[0]!.id), offers[0]!.slots[0]!.slotId);
    expect((await displacedFor("doctor")).find((entry) => entry.visit.id === "late")?.status).toBe("rebooked");
  });
});
