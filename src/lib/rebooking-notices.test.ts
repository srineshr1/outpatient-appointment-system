import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppointmentRecord, ClinicStore, ConsultSession, PublicUser } from "./clinic-types";
import { setNow } from "./clock";
import { getOps, resetOpsForTests } from "./ops";
import { setPaymentProviderForTests } from "./payments/index";
import type { CreateRefundInput, PaymentProvider } from "./payments/provider";
import { hashToken } from "./passwords";
import { SqliteClinicStore } from "./sqlite-store";

// Nothing leaves the machine: the mailer is replaced, SMS stays in mock mode and any real fetch fails the test.
const state = vi.hoisted(() => ({ store: null as ClinicStore | null, mail: [] as Array<{ to: string; subject: string; text: string; html: string }> }));
vi.mock("./store", () => ({ getStore: async () => state.store! }));
vi.mock("./mailer", () => ({
  sendNotice: vi.fn(async (to: string, message: { subject: string; text: string; html: string }) => {
    state.mail.push({ to, ...message });
    return "sent";
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
import { runCron } from "./cron";
import { dispatchDue } from "./notifications/service";
import { renderSms } from "./notifications/sms";
import { renderNotice } from "./notifications/templates";
import { rebookLinks, rebookToken } from "./rebook-links";
import { displaceAndSave } from "./rebooking";
import { acceptRebookingAction, cancelRebookingAction } from "../server/rebook-actions";

const session: ConsultSession = { id: "notify", doctorId: "doctor", label: "Clinic", weekdays: [1],
  startTime: "10:00", endTime: "12:00", room: "Test", mode: "stream", slotMinutes: 30,
  waveMinutes: null, waveCapacity: null, archivedAt: null, createdAt: "", updatedAt: "" };
const doctor = { id: "doctor-user", doctorId: "doctor", role: "doctor", name: "Dr Example", email: "doctor@example.org", mobile: "", dob: "" } as PublicUser;

function visit(id: string, time: string, patientUserId: string, mobile: string): AppointmentRecord {
  const endTime = time === "11:30" ? "12:00" : "11:30";
  return { id, reference: `HSP-${id}`, doctorId: "doctor", slotId: `doctor-2099-01-05-${time.replace(":", "")}`,
    date: "2099-01-05", time, endTime, sessionId: session.id, token: null, waveCapacity: null, reasonId: "new",
    patientName: "Ann Example", patientDob: "", patientMobile: mobile, patientChi: "", note: "", patientUserId,
    createdAt: "", status: "booked" };
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

/** Two booked patients in the hour the doctor removes: one with an Indian mobile, one without. */
async function displaceTwo() {
  const store = state.store!;
  expect(await store.createAppointment(visit("india", "11:00", "patient-in", "+91 98765 43210"))).toBe("ok");
  expect(await store.createAppointment(visit("abroad", "11:30", "patient-uk", "+44 7700 900123"))).toBe("ok");
  await paid("india");
  const result = await displaceAndSave(doctor, session, { ...session, endTime: "11:00" }, [], { expected: 2 });
  if (!result.ok) throw new Error(result.reason);
  return result;
}

const rows = async (kind?: string) => (await (await getOps()).listNotifications({})).filter((row) => !kind || row.kind === kind);

beforeEach(async () => {
  vi.stubEnv("SMS_MODE", "mock");
  vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("no network in tests"); }));
  setNow(Date.parse("2099-01-01T00:00:00Z"));
  state.mail = [];
  state.store = new SqliteClinicStore(":memory:");
  await state.store.ensureReady();
  await state.store.putConsultSession(session);
  for (const [id, email, mobile, role, doctorId] of [
    ["patient-in", "india@example.org", "+91 98765 43210", "patient", null],
    ["patient-uk", "abroad@example.org", "+44 7700 900123", "patient", null],
    ["doctor-user", "doctor@example.org", "", "doctor", "doctor"],
  ] as const) {
    await state.store.createUser({ id, email, passwordHash: "x", name: id === "doctor-user" ? "Dr Example" : "Ann Example", role, doctorId, mobile, dob: "" });
  }
  resetOpsForTests();
  provider = new FakeProvider();
  setPaymentProviderForTests(provider as unknown as PaymentProvider);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("displaced patient notices", () => {
  it("emails every displaced patient their held times, texts only Indian mobiles, and never stores the link token", async () => {
    const { offers } = await displaceTwo();
    const offerRows = await rows("rebooking_offer");
    expect(offerRows.map((row) => `${row.channel}:${row.recipient}`).sort()).toEqual([
      "email:abroad@example.org",
      "email:india@example.org",
      "sms:+91 98765 43210",
    ]);
    for (const offer of offers) expect(JSON.stringify(offerRows)).not.toContain(rebookToken(offer.id));

    await dispatchDue();
    const india = offers.find((offer) => offer.appointmentId === "india")!;
    const email = state.mail.find((mail) => mail.to === "india@example.org")!;
    expect(email.subject).toBe("Please pick a new time for HSP-india");
    expect(email.text).toContain(`/rebook/${rebookToken(india.id)}?slot=${encodeURIComponent(india.slots[0]!.slotId)}`);
    expect(email.text).toContain("Show more times");
    expect(email.text).toContain("Cancel and get a full refund");
    expect(hashToken(rebookToken(india.id))).toBe(india.tokenHash);
    // The doctor made the change, so the doctor is not emailed about it.
    expect(state.mail.some((mail) => mail.to === "doctor@example.org")).toBe(false);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("renders the offer with escaped held-time buttons and a short text with the page link", () => {
    const data = { firstName: "Ann", patientName: "Ann", reference: "HSP-1", doctorName: "Dr <b>X</b>", when: "Mon 5 Jan, 11:30",
      offerId: "offer", offerSlots: [{ slotId: "s1", when: "Mon 12 Jan, 11:30" }], expiresWhen: "Fri 2 Jan, 05:30" };
    const links = rebookLinks("https://clinic.example", "offer", data.offerSlots);
    const message = renderNotice("rebooking_offer", { ...data, rebookLinks: links });
    expect(message.html).toContain("Dr &lt;b&gt;X&lt;/b&gt;");
    expect(message.html).toContain(`href="${links.slots[0]!.url}"`);
    expect(message.html).toContain("Move to Mon 12 Jan, 11:30");
    expect(renderSms("rebooking_offer", { ...data, rebookLinks: links })).toContain(links.page);
  });

  it("confirms an accepted time to the patient and the doctor, and drops the unsent offer", async () => {
    const { offers } = await displaceTwo();
    const india = offers.find((offer) => offer.appointmentId === "india")!;
    const token = rebookToken(india.id);
    const form = new FormData();
    form.set("token", token);
    form.set("slot", india.slots[0]!.slotId);
    await expect(acceptRebookingAction(form)).rejects.toThrow(`REDIRECT:/rebook/${token}?done=moved`);
    expect(await state.store!.getAppointment("india")).toMatchObject({ status: "booked", slotId: india.slots[0]!.slotId });
    expect((await rows("rebooking_confirmed")).map((row) => row.channel).sort()).toEqual(["email", "sms"]);
    expect((await rows("doctor_rescheduled")).map((row) => row.recipient)).toEqual(["doctor@example.org"]);

    await dispatchDue(50);
    const offerEmails = (await rows("rebooking_offer")).filter((row) => row.recipient === "india@example.org");
    expect(offerEmails[0]!.status).toBe("cancelled");
    expect(state.mail.find((mail) => mail.to === "india@example.org")?.subject).toContain("moved to");
  });

  it("asks before cancelling, then refunds the payment in full and sends the final email", async () => {
    const { offers } = await displaceTwo();
    const india = offers.find((offer) => offer.appointmentId === "india")!;
    const token = rebookToken(india.id);
    const form = new FormData();
    form.set("token", token);
    await expect(cancelRebookingAction(form)).rejects.toThrow("cancel=1&notice=confirm");
    expect((await state.store!.getAppointment("india"))?.status).toBe("displaced");

    form.set("confirm", "yes");
    await expect(cancelRebookingAction(form)).rejects.toThrow(`REDIRECT:/rebook/${token}?done=cancelled`);
    expect((await state.store!.getAppointment("india"))?.status).toBe("cancelled");
    expect(provider.refunds).toEqual([expect.objectContaining({ amountMinor: 50000 })]);
    const [closed] = (await rows("rebooking_closed")).filter((row) => row.channel === "email");
    expect(closed!.payload).toMatchObject({ offerOutcome: "cancelled", refundMinor: 50000 });
  });

  it("rejects a forged token without touching anything", async () => {
    await displaceTwo();
    const form = new FormData();
    form.set("token", "A".repeat(43));
    form.set("slot", "doctor-2099-01-12-1100");
    await expect(acceptRebookingAction(form)).rejects.toThrow("notice=invalid");
    form.set("token", "../../etc");
    await expect(acceptRebookingAction(form)).rejects.toThrow("REDIRECT:/rebook/invalid");
  });

  it("expires lapsed offers on the cron tick: cancels, refunds and sends the final email once", async () => {
    await displaceTwo();
    setNow(Date.parse("2099-01-02T00:00:01Z"));
    const first = await runCron();
    expect(first.offersExpired).toBe(2);
    expect(first.errors).toEqual([]);
    expect((await state.store!.getAppointment("india"))?.status).toBe("cancelled");
    expect(provider.refunds).toHaveLength(1);
    const finals = state.mail.filter((mail) => mail.subject === "Appointment HSP-india cancelled");
    expect(finals).toHaveLength(1);
    expect(finals[0]!.text).toContain("no new time was chosen in time");
    // The unsent offer emails were dropped rather than sent after the times lapsed.
    expect(state.mail.some((mail) => mail.subject.startsWith("Please pick a new time"))).toBe(false);

    const second = await runCron();
    expect(second.offersExpired).toBe(0);
    expect(provider.refunds).toHaveLength(1);
  });
});
