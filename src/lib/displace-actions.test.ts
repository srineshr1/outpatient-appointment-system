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
import { archiveSession, saveSession } from "../server/profile-actions";
import { displacedFor } from "./rebooking";

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
  return { id: "v", reference: "HSP-300001", doctorId: "doctor", slotId: "doctor-2099-01-05-1130",
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

describe("doctor confirms displacing booked visits", () => {
  it("asks first and changes nothing without the doctor's confirmation", async () => {
    const booked = visit();
    expect(await state.store!.createAppointment(booked)).toBe("ok");
    expect(await saveSession(null, form({ endTime: "11:00" }))).toMatchObject({
      ok: false,
      message: expect.stringContaining("1 of 1 booked visit falls outside the new hours"),
      displace: { count: 1, times: [expect.stringContaining("11:30")] },
    });
    expect((await state.store!.getConsultSession(session.id))?.endTime).toBe("12:00");
    expect(await state.store!.getAppointment(booked.id)).toEqual(booked);
    expect(await state.store!.listRebookingOffers({ doctorId: "doctor" })).toEqual([]);
  });

  it("moves the visit off, keeps it, and offers held times once confirmed", async () => {
    expect(await state.store!.createAppointment(visit())).toBe("ok");
    await expect(saveSession(null, form({ endTime: "11:00", displace: "confirm", displaceCount: "1", displaceReason: "Theatre list overran" })))
      .rejects.toThrow(/REDIRECT:\/dashboard\/sessions\?saved=updated.*&displaced=1/);
    expect((await state.store!.getConsultSession(session.id))?.endTime).toBe("11:00");
    expect(await state.store!.getAppointment("v")).toMatchObject({ status: "displaced", displacedReason: "Theatre list overran" });
    const [offer] = await state.store!.listRebookingOffers({ doctorId: "doctor" });
    expect(offer).toMatchObject({ appointmentId: "v", status: "pending" });
    expect(offer!.slots.length).toBeGreaterThan(0);
    expect((await displacedFor("doctor")).map((entry) => entry.status)).toEqual(["pending"]);
  });

  it("asks again if the number of affected patients changed since the doctor looked", async () => {
    expect(await state.store!.createAppointment(visit())).toBe("ok");
    expect(await state.store!.createAppointment(visit({ id: "w", reference: "HSP-300002", slotId: "doctor-2099-01-05-1100", time: "11:00", endTime: "11:30" }))).toBe("ok");
    expect(await saveSession(null, form({ endTime: "11:00", displace: "confirm", displaceCount: "1" }))).toMatchObject({
      ok: false,
      message: expect.stringContaining("changed to 2"),
      displace: { count: 2 },
    });
    expect((await state.store!.getConsultSession(session.id))?.endTime).toBe("12:00");
    expect((await state.store!.getAppointment("v"))?.status).toBe("booked");
  });

  it("moves a visit that no longer fits a confirmed structural change (another slot length)", async () => {
    expect(await state.store!.createAppointment(visit())).toBe("ok");
    expect(await saveSession(null, form({ slotMinutes: "15" }))).toMatchObject({ ok: false, displace: { count: 1 } });
    expect((await state.store!.getConsultSession(session.id))?.slotMinutes).toBe(30);
    await expect(saveSession(null, form({ slotMinutes: "15", displace: "confirm", displaceCount: "1" }))).rejects.toThrow(/displaced=1/);
    expect((await state.store!.getConsultSession(session.id))?.slotMinutes).toBe(15);
    expect((await state.store!.getAppointment("v"))?.status).toBe("displaced");
  });

  it("asks before removing a booked session, then displaces every upcoming visit on confirm", async () => {
    expect(await state.store!.createAppointment(visit())).toBe("ok");
    expect(await state.store!.createAppointment(visit({ id: "h", reference: "HSP-300003", slotId: "doctor-2099-01-05-1000", time: "10:00", endTime: "10:30", status: "pending_payment" }))).toBe("ok");
    await expect(archiveSession(form())).rejects.toThrow(`notice=busy&n=2&displace=${session.id}`);
    expect((await state.store!.getConsultSession(session.id))?.archivedAt).toBeNull();

    await expect(archiveSession(form({ displace: "confirm", displaceCount: "2" }))).rejects.toThrow("saved=removed&displaced=2");
    expect((await state.store!.getConsultSession(session.id))?.archivedAt).toBeTruthy();
    expect((await state.store!.getAppointment("v"))?.status).toBe("displaced");
    expect((await state.store!.getAppointment("h"))?.status).toBe("displaced");
    // The paid visit gets an offer; the unpaid hold is simply released.
    expect((await state.store!.listRebookingOffers({ doctorId: "doctor" })).map((offer) => offer.appointmentId)).toEqual(["v"]);
    expect((await displacedFor("doctor")).map((entry) => entry.status).sort()).toEqual(["pending", "released"]);
  });

  it("refuses another doctor's session", async () => {
    state.user = { ...state.user!, id: "intruder", doctorId: "intruder" };
    await expect(archiveSession(form({ displace: "confirm", displaceCount: "0" }))).rejects.toThrow("notice=missing");
  });
});
