import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppointmentRecord, ClinicStore, ConsultSession, PublicUser } from "./clinic-types";
import { setNow } from "./clock";
import { resetOpsForTests } from "./ops";
import { SqliteClinicStore } from "./sqlite-store";

const state = vi.hoisted(() => ({ store: null as ClinicStore | null, user: null as PublicUser | null }));
vi.mock("./store", () => ({ getStore: async () => state.store! }));
vi.mock("./session", () => ({ getCurrentUser: async () => state.user, safeNext: (value: string) => value }));
vi.mock("./doctors", () => ({ loadDoctors: vi.fn(async () => []) }));
vi.mock("./audit", async (importOriginal) => ({ ...(await importOriginal<typeof import("./audit")>()), recordEvent: vi.fn(), actorOf: (user: PublicUser) => user }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
import { saveSession } from "../server/profile-actions";
import { stillFits } from "./elastic-scheduling";

const session: ConsultSession = { id: "displace-action", doctorId: "doctor", label: "Clinic", weekdays: [1],
  startDate: "2099-01-01", endDate: "2099-12-31", startTime: "10:00", endTime: "12:00", room: "Test", mode: "stream",
  slotMinutes: 30, waveMinutes: null, waveCapacity: null, archivedAt: null, createdAt: "", updatedAt: "" };

function form(patch: Record<string, string> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ id: session.id, label: session.label, kind: "recurring", weekdays: "1",
    startDate: "2099-01-01", endDate: "2099-12-31", startTime: "10:00", endTime: "12:00", room: "Test", mode: "stream",
    slotMinutes: "30", ...patch })) data.set(key, value);
  return data;
}

function visit(patch: Partial<AppointmentRecord> = {}): AppointmentRecord {
  return { id: "v", reference: "HSP-400001", doctorId: "doctor", slotId: "doctor-2099-01-05-1130",
    date: "2099-01-05", time: "11:30", endTime: "12:00", sessionId: session.id,
    token: null, waveCapacity: null, reasonId: "new", patientName: "Example", patientDob: "", patientMobile: "",
    patientChi: "", note: "", patientUserId: "patient", createdAt: "", status: "booked", ...patch };
}

beforeEach(async () => {
  vi.unstubAllEnvs();
  setNow(Date.parse("2099-01-01T00:00:00Z"));
  resetOpsForTests();
  state.store = new SqliteClinicStore(":memory:");
  await state.store.ensureReady();
  await state.store.putConsultSession(session);
  state.user = { id: "doctor", doctorId: "doctor", role: "doctor", name: "Example", email: "example@example.org", mobile: "", dob: "" };
});

const wave: ConsultSession = { ...session, mode: "wave", slotMinutes: null, waveMinutes: null, waveCapacity: 6 };
function waveForm(patch: Record<string, string> = {}) {
  return form({ mode: "wave", slotMinutes: "", waveCapacity: "6", ...patch });
}
function seat(token: number, patch: Partial<AppointmentRecord> = {}): AppointmentRecord {
  return visit({ id: `t${token}`, reference: `HSP-40010${token}`, slotId: `w-${session.id}-2099-01-05-1000#${token}`,
    time: "10:00", endTime: "12:00", token, waveCapacity: 6, ...patch });
}

describe("reducing a session's structure with reservations", () => {
  it("keeps every patient when fewer places per wave still seat them all", async () => {
    await state.store!.putConsultSession(wave);
    for (const token of [1, 2]) expect(await state.store!.createAppointment(seat(token))).toBe("ok");
    await expect(saveSession(null, waveForm({ waveCapacity: "4" }))).rejects.toThrow("REDIRECT:/dashboard/sessions?saved=updated");
    expect((await state.store!.getConsultSession(session.id))?.waveCapacity).toBe(4);
    expect(await state.store!.getAppointment("t1")).toEqual(seat(1));
    expect(await state.store!.getAppointment("t2")).toEqual(seat(2));
  });

  it("asks before reducing patients per wave below a booked token, then moves only that patient", async () => {
    await state.store!.putConsultSession(wave);
    for (const token of [1, 2, 3]) expect(await state.store!.createAppointment(seat(token))).toBe("ok");
    expect(await saveSession(null, waveForm({ waveCapacity: "2" }))).toMatchObject({
      ok: false,
      message: expect.stringContaining("no longer fits the changed session"),
      displace: { count: 1 },
    });
    expect((await state.store!.getConsultSession(session.id))?.waveCapacity).toBe(6);
    await expect(saveSession(null, waveForm({ waveCapacity: "2", displace: "confirm", displaceCount: "1" })))
      .rejects.toThrow(/saved=updated.*&displaced=1/);
    expect((await state.store!.getConsultSession(session.id))?.waveCapacity).toBe(2);
    expect(await state.store!.getAppointment("t3")).toMatchObject({ status: "displaced" });
    expect(await state.store!.getAppointment("t1")).toEqual(seat(1));
    const [offer] = await state.store!.listRebookingOffers({ doctorId: "doctor" });
    expect(offer).toMatchObject({ appointmentId: "t3", status: "pending" });
    expect(offer!.slots.length).toBeGreaterThan(0);
  });

  it("splitting a whole-session wave into 30-minute waves moves the patients whose wave no longer exists", async () => {
    await state.store!.putConsultSession(wave);
    expect(await state.store!.createAppointment(seat(1))).toBe("ok");
    expect(await saveSession(null, waveForm({ waveMinutes: "30" }))).toMatchObject({ ok: false, displace: { count: 1 } });
    await expect(saveSession(null, waveForm({ waveMinutes: "30", displace: "confirm", displaceCount: "1" }))).rejects.toThrow(/displaced=1/);
    expect((await state.store!.getConsultSession(session.id))?.waveMinutes).toBe(30);
    expect(await state.store!.getAppointment("t1")).toMatchObject({ status: "displaced" });
  });

  it("another stream slot length moves the visits that no longer start and end on the new grid", async () => {
    const early = visit({ id: "early", reference: "HSP-400201", slotId: "doctor-2099-01-05-1000", time: "10:00", endTime: "10:30" });
    expect(await state.store!.createAppointment(visit())).toBe("ok");
    expect(await state.store!.createAppointment(early)).toBe("ok");
    // 20-minute slots: 10:00 now ends 10:20 and 11:30 is off the grid, so both move.
    expect(await saveSession(null, form({ slotMinutes: "20" }))).toMatchObject({ ok: false, displace: { count: 2 } });
    await expect(saveSession(null, form({ slotMinutes: "20", displace: "confirm", displaceCount: "2" }))).rejects.toThrow(/displaced=2/);
    expect((await state.store!.getConsultSession(session.id))?.slotMinutes).toBe(20);
    expect((await state.store!.getAppointment("early"))?.status).toBe("displaced");
  });

  it("counts an unpaid hold that no longer fits a structural change, and releases it", async () => {
    await state.store!.putConsultSession(wave);
    expect(await state.store!.createAppointment(seat(1))).toBe("ok");
    expect(await state.store!.createAppointment(seat(2, { status: "pending_payment" }))).toBe("ok");
    expect(await saveSession(null, waveForm({ waveCapacity: "1" }))).toMatchObject({ ok: false, displace: { count: 1 } });
    await expect(saveSession(null, waveForm({ waveCapacity: "1", displace: "confirm", displaceCount: "1" }))).rejects.toThrow(/saved=updated/);
    expect((await state.store!.getAppointment("t2"))?.status).not.toBe("pending_payment");
    expect(await state.store!.getAppointment("t1")).toEqual(seat(1));
  });

  it("the store refuses a structural change that would strand a reservation", async () => {
    await state.store!.putConsultSession(wave);
    expect(await state.store!.createAppointment(seat(3))).toBe("ok");
    await expect(state.store!.saveConsultSession({ ...wave, waveCapacity: 2 }, [])).rejects.toThrow("Reserved sessions may change");
    await state.store!.saveConsultSession({ ...wave, waveCapacity: 3 }, []);
    expect((await state.store!.getConsultSession(session.id))?.waveCapacity).toBe(3);
  });

  it("keeps the legacy Blob store's rule: no structural change while reserved", async () => {
    vi.stubEnv("DATA_STORE", "blob"); vi.stubEnv("BLOB_READ_WRITE_TOKEN", "test-only");
    expect(await state.store!.createAppointment(visit())).toBe("ok");
    expect(await saveSession(null, form({ slotMinutes: "20" }))).toMatchObject({ ok: false, message: expect.stringContaining("reserved visit uses") });
  });
});

describe("stillFits", () => {
  it("checks the slot, its length, the kind of place and the wave's room", () => {
    expect(stillFits(seat(2), wave)).toBe(true);
    expect(stillFits(seat(2), { ...wave, waveCapacity: 1 })).toBe(false);
    expect(stillFits(seat(2), { ...wave, waveMinutes: 30 })).toBe(false);
    expect(stillFits(seat(2), { ...wave, mode: "stream", slotMinutes: 30, waveCapacity: null })).toBe(false);
    expect(stillFits(visit(), session)).toBe(true);
    expect(stillFits(visit(), { ...session, slotMinutes: 20 })).toBe(false);
    expect(stillFits(visit({ slotId: "doctor-2099-01-05-1000", time: "10:00", endTime: "10:30" }), { ...session, endTime: "11:00" })).toBe(true);
    expect(stillFits(visit(), { ...session, weekdays: [2] })).toBe(false);
    expect(stillFits(visit(), { ...session, archivedAt: "2099-01-01" })).toBe(false);
  });
});
