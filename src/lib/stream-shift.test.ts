import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppointmentRecord, ClinicStore, ConsultSession, PublicUser } from "./clinic-types";
import { setNow } from "./clock";
import { resetOpsForTests } from "./ops";
import { SqliteClinicStore } from "./sqlite-store";
import { planStreamShift, type ShiftableVisit } from "./sessions";

const state = vi.hoisted(() => ({ store: null as ClinicStore | null, user: null as PublicUser | null }));
vi.mock("./store", () => ({ getStore: async () => state.store! }));
vi.mock("./session", () => ({ getCurrentUser: async () => state.user, safeNext: (value: string) => value }));
vi.mock("./doctors", () => ({ loadDoctors: vi.fn(async () => []) }));
vi.mock("./audit", async (importOriginal) => ({ ...(await importOriginal<typeof import("./audit")>()), recordEvent: vi.fn(), actorOf: (user: PublicUser) => user }));
vi.mock("./notifications/service", () => ({
  rescheduleReminders: vi.fn(async () => 0),
  queueNotice: vi.fn(async () => true),
  queueDoctorNotice: vi.fn(async () => true),
  dispatchSoon: vi.fn(async () => undefined),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
import { saveSession } from "../server/profile-actions";
import { queueNotice, rescheduleReminders } from "./notifications/service";

const DAY = "2099-01-05"; // a Monday
const wave: ConsultSession = { id: "wave", doctorId: "doctor", label: "Wave", weekdays: [], onDate: DAY, startDate: null, endDate: null,
  startTime: "09:10", endTime: "12:00", room: "Test", mode: "wave", slotMinutes: null, waveMinutes: null, waveCapacity: 6,
  archivedAt: null, createdAt: "", updatedAt: "" };
const stream: ConsultSession = { ...wave, id: "stream", label: "New session", startTime: "12:00", endTime: "16:00", mode: "stream",
  slotMinutes: 20, waveCapacity: null };

function at(time: string, patch: Partial<ShiftableVisit> = {}): ShiftableVisit {
  const [h, m] = time.split(":").map(Number);
  const end = h! * 60 + m! + 20;
  return { id: `v${time}`, status: "booked", date: DAY, time, endTime: `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`, sessionId: "stream", ...patch };
}
const grown = (endTime: string): ConsultSession => ({ ...wave, endTime });

describe("planStreamShift", () => {
  it("starts the stream at the next slot boundary and moves the patient to the next free slot", () => {
    const plan = planStreamShift(grown("12:40"), [stream], [at("12:00")], "2099-01-01");
    expect(plan).toMatchObject({
      ok: true,
      trims: [{ sessionId: "stream", date: DAY, startTime: "12:00", endTime: "12:40" }],
      starts: [{ sessionId: "stream", date: DAY, time: "12:40" }],
      moves: [{ visitId: "v12:00", fromTime: "12:00", toTime: "12:40", toEndTime: "13:00" }],
    });
  });

  it("keeps the order and skips later slots that are already booked", () => {
    const plan = planStreamShift(grown("12:40"), [stream], [at("12:20"), at("12:00"), at("12:40"), at("13:20")], "2099-01-01");
    expect(plan && plan.ok && plan.moves.map((move) => `${move.fromTime}>${move.toTime}`)).toEqual(["12:00>13:00", "12:20>13:40"]);
  });

  it("refuses when the rest of the stream has too few free slots", () => {
    const short = { ...stream, endTime: "13:00" };
    const plan = planStreamShift(grown("12:40"), [short], [at("12:00"), at("12:20"), at("12:40")], "2099-01-01");
    expect(plan).toEqual({ ok: false, message: expect.stringContaining("only 0 free later slots") });
  });

  it("does not apply to unpaid holds, started visits, waves, the end of a stream or a cut through a slot", () => {
    expect(planStreamShift(grown("12:40"), [stream], [at("12:00", { status: "pending_payment" })], "2099-01-01")).toBeNull();
    expect(planStreamShift(grown("12:40"), [stream], [at("12:00")], "2099-01-01", [], () => false)).toBeNull();
    const laterWave = { ...stream, mode: "wave" as const, slotMinutes: null, waveCapacity: 6 };
    expect(planStreamShift(grown("12:40"), [laterWave], [at("12:00")], "2099-01-01")).toBeNull();
    const before = { ...stream, startTime: "08:00", endTime: "09:10" };
    expect(planStreamShift({ ...wave, startTime: "08:40" }, [before], [at("08:40")], "2099-01-01")).toBeNull();
    expect(planStreamShift(grown("12:30"), [stream], [at("12:20")], "2099-01-01")).toBeNull();
  });

  it("is not needed when the taken part is free", () => {
    expect(planStreamShift(grown("12:40"), [stream], [at("13:00")], "2099-01-01")).toBeNull();
  });
});

function visit(time: string, patch: Partial<AppointmentRecord> = {}): AppointmentRecord {
  const [h, m] = time.split(":").map(Number);
  const end = h! * 60 + m! + 20;
  return { id: `a${time.replace(":", "")}`, reference: `HSP-5${time.replace(":", "")}`, doctorId: "doctor", slotId: `doctor-${DAY}-${time.replace(":", "")}`,
    date: DAY, time, endTime: `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`, sessionId: "stream",
    token: null, waveCapacity: null, reasonId: "new", patientName: `Patient ${time}`, patientDob: "", patientMobile: "",
    patientChi: "", note: "", patientUserId: "patient", createdAt: "", status: "booked", ...patch };
}

function waveForm(endTime: string, patch: Record<string, string> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ id: "wave", label: "Wave", kind: "once", onDate: DAY, startDate: "", endDate: "",
    startTime: "09:10", endTime, room: "Test", mode: "wave", slotMinutes: "", waveMinutes: "", waveCapacity: "6", ...patch })) data.set(key, value);
  return data;
}

describe("growing a wave into a stream with patients (saveSession)", () => {
  beforeEach(async () => {
    vi.unstubAllEnvs();
    vi.mocked(queueNotice).mockClear();
    vi.mocked(rescheduleReminders).mockClear();
    setNow(Date.parse("2099-01-01T00:00:00Z"));
    resetOpsForTests();
    state.store = new SqliteClinicStore(":memory:");
    await state.store.ensureReady();
    await state.store.putConsultSession(wave);
    await state.store.putConsultSession(stream);
    state.user = { id: "doctor", doctorId: "doctor", role: "doctor", name: "Dr Example", email: "doctor@example.org", mobile: "", dob: "" };
  });

  it("asks first, then moves the patient later in the same stream, saves the wave and tells the patient", async () => {
    expect(await state.store!.createAppointment(visit("12:00"))).toBe("ok");
    const asked = await saveSession(null, waveForm("12:40"));
    expect(asked).toMatchObject({ ok: false, shift: { count: 1, lines: ["Patient 12:00 12:00 → 12:40"] } });
    expect(asked?.message).toContain("start at 12:40");
    expect((await state.store!.getConsultSession("wave"))?.endTime).toBe("12:00");
    expect(await state.store!.getAppointment("a1200")).toMatchObject({ time: "12:00" });

    await expect(saveSession(null, waveForm("12:40", { shift: "confirm", shiftCount: "1" }))).rejects.toThrow(/saved=updated.*&shifted=1/);
    expect((await state.store!.getConsultSession("wave"))?.endTime).toBe("12:40");
    expect(await state.store!.listSessionTrims("doctor")).toEqual([
      expect.objectContaining({ sessionId: "stream", date: DAY, startTime: "12:00", endTime: "12:40", absorbedBy: "wave" }),
    ]);
    expect(await state.store!.getAppointment("a1200")).toMatchObject({
      status: "booked", time: "12:40", endTime: "13:00", slotId: `doctor-${DAY}-1240`, sessionId: "stream", reference: "HSP-51200",
    });
    expect(await state.store!.listReschedules({ appointmentId: "a1200" })).toEqual([
      expect.objectContaining({ fromTime: "12:00", toTime: "12:40", byUserId: "doctor", reason: "The clinic session times changed" }),
    ]);
    expect(rescheduleReminders).toHaveBeenCalledTimes(1);
    expect(queueNotice).toHaveBeenCalledWith(
      "appointment_rescheduled",
      expect.objectContaining({ id: "a1200", time: "12:40" }),
      expect.objectContaining({ extra: expect.objectContaining({ previousWhen: expect.stringContaining("12:00") }) }),
    );
  });

  it("asks again when the number of patients changed", async () => {
    expect(await state.store!.createAppointment(visit("12:00"))).toBe("ok");
    expect(await state.store!.createAppointment(visit("12:20"))).toBe("ok");
    expect(await saveSession(null, waveForm("12:40", { shift: "confirm", shiftCount: "1" }))).toMatchObject({
      ok: false, message: expect.stringContaining("changed to 2"), shift: { count: 2 },
    });
    expect(await state.store!.getAppointment("a1200")).toMatchObject({ time: "12:00" });
  });

  it("refuses with a clear message when the stream has no room later that day", async () => {
    await state.store!.putConsultSession({ ...stream, endTime: "13:00" });
    expect(await state.store!.createAppointment(visit("12:00"))).toBe("ok");
    expect(await state.store!.createAppointment(visit("12:40"))).toBe("ok");
    const refused = await saveSession(null, waveForm("12:40", { shift: "confirm", shiftCount: "1" }));
    expect(refused).toMatchObject({ ok: false, message: expect.stringContaining("only 0 free later slots") });
    expect(refused?.shift).toBeUndefined();
    expect((await state.store!.getConsultSession("wave"))?.endTime).toBe("12:00");
    expect(queueNotice).not.toHaveBeenCalled();
  });

  it("keeps the plain rule for an unpaid hold in the way", async () => {
    expect(await state.store!.createAppointment(visit("12:00", { status: "pending_payment" }))).toBe("ok");
    expect(await saveSession(null, waveForm("12:40"))).toMatchObject({ ok: false, message: expect.stringContaining("You can extend to 12:00") });
  });

  it("does not move anyone on the legacy Blob store", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "x");
    vi.stubEnv("DATA_STORE", "blob");
    expect(await state.store!.createAppointment(visit("12:00"))).toBe("ok");
    expect(await saveSession(null, waveForm("12:40", { shift: "confirm", shiftCount: "1" }))).toMatchObject({ ok: false });
    expect(await state.store!.getAppointment("a1200")).toMatchObject({ time: "12:00" });
  });

  it("store: all or nothing when a target slot was taken meanwhile", async () => {
    expect(await state.store!.createAppointment(visit("12:00"))).toBe("ok");
    expect(await state.store!.createAppointment(visit("12:40"))).toBe("ok");
    const result = await state.store!.saveSessionShifting(grown("12:40"), [{ sessionId: "stream", date: DAY, startTime: "12:00", endTime: "12:40", absorbedBy: "wave" }], [{
      appointmentId: "a1200", fromSlotId: `doctor-${DAY}-1200`,
      to: { slotId: `doctor-${DAY}-1240`, date: DAY, time: "12:40", endTime: "13:00", sessionId: "stream", token: null, waveCapacity: null },
      history: { id: "h", appointmentId: "a1200", reference: "HSP-51200", doctorId: "doctor", patientUserId: "patient", byUserId: "doctor", byName: "", byRole: "doctor",
        fromSlotId: `doctor-${DAY}-1200`, fromDate: DAY, fromTime: "12:00", fromToken: null, toSlotId: `doctor-${DAY}-1240`, toDate: DAY, toTime: "12:40", toToken: null, reason: "", at: "" },
    }]);
    expect(result).toBe("taken");
    expect((await state.store!.getConsultSession("wave"))?.endTime).toBe("12:00");
    expect(await state.store!.listSessionTrims("doctor")).toEqual([]);
    expect(await state.store!.saveSessionShifting(grown("12:40"), [{ sessionId: "stream", date: DAY, startTime: "12:00", endTime: "12:40", absorbedBy: "wave" }], []))
      .toBe("stale");
  });
});
