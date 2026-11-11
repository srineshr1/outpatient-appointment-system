import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppointmentRecord, ClinicStore, ConsultSession, PublicUser } from "./clinic-types";
import { setNow } from "./clock";
import { SqliteClinicStore } from "./sqlite-store";
import { slotsForSession } from "./sessions";

const state = vi.hoisted(() => ({ store: null as ClinicStore | null, user: null as PublicUser | null }));
vi.mock("./store", () => ({ getStore: async () => state.store! }));
vi.mock("./session", () => ({ getCurrentUser: async () => state.user, safeNext: (value: string) => value }));
vi.mock("./doctors", () => ({ loadDoctors: vi.fn(async () => []) }));
vi.mock("./audit", () => ({ recordEvent: vi.fn(), actorOf: (user: PublicUser) => user }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
import { archiveSession, saveSession } from "../server/profile-actions";

const session: ConsultSession = { id: "elastic-action", doctorId: "doctor", label: "Clinic", weekdays: [1],
  startTime: "10:00", endTime: "12:00", room: "Test", mode: "stream", slotMinutes: 30,
  waveMinutes: null, waveCapacity: null, archivedAt: null, createdAt: "", updatedAt: "" };
function form(patch: Record<string, string> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ id: session.id, label: session.label, kind: "recurring", weekdays: "1",
    startTime: "10:00", endTime: "12:00", room: "Test", mode: "stream", slotMinutes: "30", ...patch })) data.set(key, value);
  return data;
}
function visit(patch: Partial<AppointmentRecord> = {}): AppointmentRecord {
  return { id: "v", reference: "HSP-200001", doctorId: "doctor", slotId: "doctor-2099-01-05-1130",
    date: "2099-01-05", time: "11:30", endTime: "12:00", sessionId: session.id,
    token: null, waveCapacity: null, reasonId: "new", patientName: "Example", patientDob: "", patientMobile: "",
    patientChi: "", note: "", patientUserId: "patient", createdAt: "", status: "booked", ...patch };
}
beforeEach(async () => {
  vi.unstubAllEnvs();
  setNow(Date.parse("2099-01-01T00:00:00Z"));
  state.store = new SqliteClinicStore(":memory:");
  await state.store.ensureReady(); await state.store.putConsultSession(session);
  state.user = { id: "doctor", doctorId: "doctor", role: "doctor", name: "Example", email: "example@example.org", mobile: "", dob: "" };
});

describe("doctor elastic scheduling action", () => {
  it("blocks shrinking that would strand a booked visit outside the new hours", async () => {
    const booked = visit({ status: "booked" }); expect(await state.store!.createAppointment(booked)).toBe("ok");
    expect(await saveSession(null, form({ endTime: "11:00" }))).toMatchObject({
      ok: false,
      message: expect.stringContaining("1 of 1 booked visit falls outside the new hours (2099-01-05 11:30)"),
    });
    expect((await state.store!.getConsultSession(session.id))?.endTime).toBe("12:00");
    expect(await state.store!.getAppointment(booked.id)).toEqual(booked);
  });
  it("allows shrinking with a pending_payment hold and preserves every field", async () => {
    const hold = visit({ status: "pending_payment" }); expect(await state.store!.createAppointment(hold)).toBe("ok");
    await expect(saveSession(null, form({ endTime: "11:00" }))).rejects.toThrow("REDIRECT:/dashboard/sessions?saved=updated");
    expect(await state.store!.getAppointment(hold.id)).toEqual(hold);
    const resized = (await state.store!.getConsultSession(session.id))!;
    expect(slotsForSession(resized, "doctor", hold.date, hold.date).map(slot => slot.time)).toEqual(["10:00", "10:30"]);
    expect(await state.store!.transitionStatus(hold.id, "pending_payment", "booked")).toBe("ok");
    expect((await state.store!.getAppointment(hold.id))?.time).toBe("11:30");
  });
  it("expands availability and retains a booked late visit", async () => {
    const booked = visit(); await state.store!.createAppointment(booked);
    await expect(saveSession(null, form({ startTime: "09:00" }))).rejects.toThrow("REDIRECT:");
    const resized = (await state.store!.getConsultSession(session.id))!;
    expect(slotsForSession(resized, "doctor", booked.date, booked.date)).toHaveLength(6);
    expect(await state.store!.getAppointment(booked.id)).toEqual(booked);
  });
  it("still blocks structural changes and archiving with payment holds", async () => {
    await state.store!.createAppointment(visit({ status: "pending_payment" }));
    expect(await saveSession(null, form({ slotMinutes: "15" }))).toMatchObject({ ok: false });
    await expect(archiveSession(form())).rejects.toThrow("notice=busy");
    expect((await state.store!.getConsultSession(session.id))?.slotMinutes).toBe(30);
  });
  it("returns a form error if a reservation wins the edit race", async () => {
    const spy = vi.spyOn(state.store!, "saveConsultSession").mockRejectedValueOnce(new Error("Reserved sessions may change hours, name and room only"));
    expect(await saveSession(null, form({ slotMinutes: "15" }))).toMatchObject({ ok: false, message: expect.stringContaining("changed while you edited") });
    spy.mockRestore();
  });
  it("shows a busy notice if a reservation wins the archive race", async () => {
    const spy = vi.spyOn(state.store!, "saveConsultSession").mockRejectedValueOnce(new Error("Reserved sessions may change hours, name and room only"));
    await expect(archiveSession(form())).rejects.toThrow("notice=busy");
    spy.mockRestore();
  });
  it("rejects an invalid range and absorbs an empty neighbour without moving its row", async () => {
    expect(await saveSession(null, form({ endTime: "09:00" }))).toMatchObject({ ok: false });
    await state.store!.putConsultSession({ ...session, id: "other", startTime: "09:00", endTime: "10:00" });
    await expect(saveSession(null, form({ startTime: "09:00" }))).rejects.toThrow("REDIRECT:");
    const trims = await state.store!.listSessionTrims("doctor");
    expect(trims.some((trim) => trim.sessionId === "other" && trim.date === "2099-01-05" && trim.startTime === "09:00" && trim.endTime === "10:00")).toBe(true);
    expect(await state.store!.getConsultSession("other")).toMatchObject({ startTime: "09:00", endTime: "10:00" });
    expect(await state.store!.listAppointments()).toEqual([]);
  });
  it("refuses a booked edge and does not cancel the visit", async () => {
    await state.store!.putConsultSession({ ...session, id: "other", startTime: "09:00", endTime: "10:00" });
    const booked = visit({ id: "edge", reference: "HSP-200010", sessionId: "other", slotId: "doctor-2099-01-05-0900", time: "09:00", endTime: "09:30" });
    expect(await state.store!.createAppointment(booked)).toBe("ok");
    const saved = await saveSession(null, form({ startTime: "09:00" }));
    expect(saved).toMatchObject({ ok: false, message: expect.stringContaining("09:00") });
    expect((await state.store!.getConsultSession(session.id))?.startTime).toBe("10:00");
    expect(await state.store!.getAppointment(booked.id)).toEqual(booked);
    expect(await state.store!.listSessionTrims("doctor")).toEqual([]);
  });
  it("books the lent slot on the extended session only", async () => {
    await state.store!.putConsultSession({ ...session, id: "other", startTime: "09:00", endTime: "10:00" });
    await expect(saveSession(null, form({ startTime: "09:00" }))).rejects.toThrow("REDIRECT:");
    expect(await state.store!.createAppointment(visit({
      id: "neighbour-slot", reference: "HSP-200011", sessionId: "other", slotId: "doctor-2099-01-05-0900", time: "09:00", endTime: "09:30",
    }))).toBe("taken");
    expect(await state.store!.createAppointment(visit({
      id: "absorbed-slot", reference: "HSP-200012", sessionId: session.id, slotId: "doctor-2099-01-05-0900", time: "09:00", endTime: "09:30",
    }))).toBe("ok");
    expect(await state.store!.getAppointment("absorbed-slot")).toMatchObject({ time: "09:00", sessionId: session.id });
  });
  it("gives the free edge back when the session shrinks or is removed", async () => {
    await state.store!.putConsultSession({ ...session, id: "other", startTime: "09:00", endTime: "10:00" });
    await expect(saveSession(null, form({ startTime: "09:00" }))).rejects.toThrow("REDIRECT:");
    await expect(saveSession(null, form({ startTime: "10:00" }))).rejects.toThrow("REDIRECT:");
    expect(await state.store!.listSessionTrims("doctor")).toEqual([]);
    expect(await state.store!.createAppointment(visit({
      id: "returned", reference: "HSP-200013", sessionId: "other", slotId: "doctor-2099-01-05-0900", time: "09:00", endTime: "09:30",
    }))).toBe("ok");
    await state.store!.updateStatus("returned", "cancelled");
    await expect(saveSession(null, form({ startTime: "09:00" }))).rejects.toThrow("REDIRECT:");
    await expect(archiveSession(form())).rejects.toThrow("saved=removed");
    expect(await state.store!.listSessionTrims("doctor")).toEqual([]);
  });
  it("enforces doctor ownership and refuses patient access", async () => {
    state.user = { ...state.user!, id: "other", doctorId: "other" };
    expect(await saveSession(null, form({ endTime: "11:00" }))).toMatchObject({ ok: false });
    state.user = { ...state.user!, role: "patient" };
    await expect(saveSession(null, form())).rejects.toThrow("REDIRECT:/dashboard");
    expect((await state.store!.getConsultSession(session.id))?.endTime).toBe("12:00");
  });
  it("rejects Blob resizing instead of claiming unsafe cross-ID locking", async () => {
    vi.stubEnv("DATA_STORE", "blob"); vi.stubEnv("BLOB_READ_WRITE_TOKEN", "test-only");
    expect(await saveSession(null, form({ endTime: "11:00" }))).toMatchObject({ ok: false, message: expect.stringContaining("legacy Blob") });
  });
  it("retains legacy multi-wave steps when the form has no wave length field", async () => {
    const wave = { ...session, mode: "wave" as const, slotMinutes: null, waveMinutes: 30, waveCapacity: 2 };
    await state.store!.putConsultSession(wave);
    await state.store!.createAppointment(visit({ slotId: "w-elastic-action-2099-01-05-1130#1", token: 1, waveCapacity: 2 }));
    await expect(saveSession(null, form({ mode: "wave", waveCapacity: "2", startTime: "09:00" }))).rejects.toThrow("REDIRECT:");
    expect((await state.store!.getConsultSession(session.id))?.waveMinutes).toBe(30);
  });
});

describe("weekly session dates", () => {
  it("resizes an undated weekly session with a booked visit without asking for dates", async () => {
    const booked = visit(); expect(await state.store!.createAppointment(booked)).toBe("ok");
    await expect(saveSession(null, form({ startTime: "09:00" }))).rejects.toThrow("REDIRECT:/dashboard/sessions?saved=updated");
    expect(await state.store!.getConsultSession(session.id)).toMatchObject({ startTime: "09:00", endTime: "12:00", startDate: null, endDate: null });
    expect(await state.store!.getAppointment(booked.id)).toEqual(booked);
  });
  it("still requires both dates for a new weekly session and for a dated one", async () => {
    expect(await saveSession(null, form({ id: "" }))).toMatchObject({ ok: false, message: expect.stringContaining("starts") });
    await state.store!.putConsultSession({ ...session, startDate: "2099-01-01", endDate: "2099-12-31" });
    expect(await saveSession(null, form({ endTime: "11:30" }))).toMatchObject({ ok: false, message: expect.stringContaining("starts") });
    expect(await saveSession(null, form({ startDate: "2099-01-05" }))).toMatchObject({ ok: false, message: expect.stringContaining("ends") });
  });
});

describe("transactional placement after resize", () => {
  it("rejects a removed stale placement even if the service previously checked it", async () => {
    await state.store!.putConsultSession({ ...session, endTime: "11:00" });
    expect(await state.store!.createAppointment(visit())).toBe("taken");
    expect(await state.store!.listAppointments()).toEqual([]);
  });
  it("keeps weekly reservations protected when a one-off overrides their date", async () => {
    const booked = visit(); await state.store!.createAppointment(booked);
    const once = { ...session, id: "elastic-once", weekdays: [], onDate: booked.date, startTime: "09:00", slotMinutes: 20 };
    await state.store!.putConsultSession(once);
    expect(await state.store!.createAppointment(visit({ id: "new", reference: "HSP-200002", sessionId: once.id,
      slotId: "doctor-2099-01-05-1120", time: "11:20", endTime: "11:40" }))).toBe("taken");
    expect(await state.store!.getAppointment(booked.id)).toEqual(booked);
    expect(await state.store!.createAppointment(visit({ id: "stale", reference: "HSP-200003", slotId: "doctor-2099-01-05-1000", time: "10:00", endTime: "10:30" }))).toBe("taken");
  });
  it("rejects a non-aligned overlap even with a different slot ID", async () => {
    const booked = visit(); await state.store!.createAppointment(booked);
    await state.store!.putConsultSession({ ...session, startTime: "09:15", endTime: "12:15" });
    expect(await state.store!.createAppointment(visit({ id: "other", reference: "HSP-200002", slotId: "doctor-2099-01-05-1115", time: "11:15", endTime: "11:45" }))).toBe("taken");
    expect(await state.store!.getAppointment(booked.id)).toEqual(booked);
  });
});
