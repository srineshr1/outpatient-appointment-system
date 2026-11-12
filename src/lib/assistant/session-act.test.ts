import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppointmentRecord, ClinicStore, ConsultSession, PublicUser } from "../clinic-types";
import { setNow } from "../clock";
import { SqliteClinicStore } from "../sqlite-store";

const state = vi.hoisted(() => ({ store: null as ClinicStore | null }));
vi.mock("../store", () => ({ getStore: async () => state.store! }));
vi.mock("../doctors", () => ({ loadDoctors: vi.fn(async () => []) }));
vi.mock("../audit", () => ({ recordEvent: vi.fn(), recordEventSoon: vi.fn(), actorOf: (user: PublicUser) => user, visitSummary: () => "" }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const notify = vi.hoisted(() => ({ booked: vi.fn() }));
vi.mock("../notifications/service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../notifications/service")>()),
  onBookingConfirmedSoon: notify.booked,
}));

import { confirmPending, rejectPending } from "./act";
import { resetConfirmationsForTests } from "./confirm-token";
import { normaliseTime } from "./session-act";
import { runTool, toolSpecs } from "./tools";
import { handleTurn, resetTurnsForTests } from "./turn";

// Monday 5 January 2099, 08:30 at the clinic.
const MONDAY = Date.parse("2099-01-05T03:00:00Z");
const TODAY = "2099-01-05";

const doctor: PublicUser = { id: "doom", doctorId: "doom", role: "doctor", name: "Dr Doom", email: "doom@example.org", mobile: "", dob: "" };
const patient: PublicUser = { id: "srinesh", doctorId: null, role: "patient", name: "Srinesh", email: "patient@example.org", mobile: "", dob: "" };

const weekly: ConsultSession = {
  id: "morning", doctorId: "doom", label: "Morning", weekdays: [1, 2, 3, 4, 5], startTime: "09:00", endTime: "11:00",
  room: "Room 4", mode: "stream", slotMinutes: 30, waveMinutes: null, waveCapacity: null, archivedAt: null,
  createdAt: "2099-01-01T00:00:00.000Z", updatedAt: "2099-01-01T00:00:00.000Z",
};

function visit(patch: Partial<AppointmentRecord> = {}): AppointmentRecord {
  return { id: "v1", reference: "HSP-300001", doctorId: "doom", slotId: "doom-2099-01-05-1030", date: TODAY, time: "10:30", endTime: "11:00",
    sessionId: weekly.id, token: null, waveCapacity: null, reasonId: "new", patientName: "Example", patientDob: "", patientMobile: "",
    patientChi: "", note: "", patientUserId: "srinesh", createdAt: "", status: "booked", ...patch };
}

async function sessions() {
  return (await state.store!.listConsultSessions("doom")).filter((session) => !session.archivedAt);
}

beforeEach(async () => {
  vi.unstubAllEnvs();
  process.env.ASSISTANT_TOKEN_SECRET = "assistant-test-secret";
  resetConfirmationsForTests();
  resetTurnsForTests();
  notify.booked.mockClear();
  setNow(MONDAY);
  state.store = new SqliteClinicStore(":memory:");
  await state.store.ensureReady();
  await state.store.putConsultSession(weekly);
});

describe("assistant consulting sessions", () => {
  it("reads 2 pm and similar times", () => {
    expect(normaliseTime("2 pm")).toBe("14:00");
    expect(normaliseTime("12")).toBe("12:00");
    expect(normaliseTime("12 pm")).toBe("12:00");
    expect(normaliseTime("12:30am")).toBe("00:30");
    expect(normaliseTime("9.15")).toBe("09:15");
    expect(normaliseTime("25:00")).toBeNull();
  });

  it("adds a stream from 12 to 2 pm today only after the doctor confirms", async () => {
    const offered = await runTool(doctor, "propose_add_session", { date: "today", startTime: "12:00", endTime: "2 pm" });
    expect(offered.pending).toBeTruthy();
    expect(offered.pending!.title).toBe("Add this session?");
    expect(offered.pending!.summary).toContain("Add a stream on Monday 5 January 2099 only, 12:00–14:00, Clinic, 15-minute slots (8 places).");
    // A one-off session replaces the weekly ones that day, so the summary says so.
    expect(offered.pending!.summary).toMatch(/replaces your weekly session \(Morning 09:00–11:00\)/);
    expect(await sessions()).toHaveLength(1);

    const done = await handleTurn(doctor, [{ role: "user", content: "yes" }], offered.pending!.token);
    expect(done.reply).toMatch(/^Added New session, stream on Monday 5 January 2099 only, 12:00–14:00/);
    const added = (await sessions()).find((session) => session.id !== weekly.id);
    expect(added).toMatchObject({ onDate: TODAY, startTime: "12:00", endTime: "14:00", mode: "stream", slotMinutes: 15, room: "Clinic" });

    const again = await confirmPending(doctor, offered.pending!.token);
    expect(again.ok).toBe(false);
    expect(await sessions()).toHaveLength(2);
    expect(notify.booked).not.toHaveBeenCalled();
  });

  it("writes nothing when the doctor says no", async () => {
    const offered = await runTool(doctor, "propose_add_session", { date: TODAY, startTime: "12:00", endTime: "14:00" });
    await rejectPending(doctor, offered.pending!.token);
    expect((await confirmPending(doctor, offered.pending!.token)).ok).toBe(false);
    expect(await sessions()).toHaveLength(1);
  });

  it("returns the editor's validation errors and prepares nothing", async () => {
    const backwards = await runTool(doctor, "propose_add_session", { date: TODAY, startTime: "14:00", endTime: "12:00" });
    expect(backwards.pending).toBeUndefined();
    expect(backwards.forModel).toEqual({ error: "The session must end after it starts." });
    const sunday = await runTool(doctor, "propose_add_session", { date: "2099-01-04", startTime: "12:00", endTime: "14:00" });
    expect(sunday.forModel).toMatchObject({ error: expect.stringContaining("Monday to Saturday") });
    const ragged = await runTool(doctor, "propose_add_session", { date: TODAY, startTime: "12:00", endTime: "12:50", slotMinutes: 20 });
    expect(ragged.forModel).toMatchObject({ error: expect.stringContaining("not a whole number") });
    const noEnd = await runTool(doctor, "propose_add_session", { date: TODAY, startTime: "12:00", endTime: "14:00", weekdays: [1] });
    expect(noEnd.forModel).toMatchObject({ error: expect.stringContaining("until which date") });
    expect(await sessions()).toHaveLength(1);
  });

  it("refuses patients, and doctors whose book the practice manages", async () => {
    expect(toolSpecs(patient).map((tool) => tool.name)).not.toContain("propose_add_session");
    const asPatient = await runTool(patient, "propose_add_session", { date: TODAY, startTime: "12:00", endTime: "14:00" });
    expect(asPatient.pending).toBeUndefined();
    expect(asPatient.forModel).toMatchObject({ error: expect.stringMatching(/isn't available/) });
    const edit = await runTool(patient, "propose_update_session", { sessionId: weekly.id, endTime: "12:00" });
    expect(edit.pending).toBeUndefined();

    const managed: PublicUser = { ...doctor, id: "user-doom", doctorId: "doom" };
    const refused = await runTool(managed, "propose_add_session", { date: TODAY, startTime: "12:00", endTime: "14:00" });
    expect(refused.forModel).toMatchObject({ error: expect.stringContaining("their own consulting sessions") });
    expect(await sessions()).toHaveLength(1);
  });

  it("changes a weekly session's hours for the whole series, and says so", async () => {
    const offered = await runTool(doctor, "propose_update_session", { sessionId: weekly.id, endTime: "12:00" });
    expect(offered.pending!.summary).toContain("hours 09:00–11:00 → 09:00–12:00");
    expect(offered.pending!.summary).toContain("This changes every week of the series, not one day");
    expect((await state.store!.getConsultSession(weekly.id))?.endTime).toBe("11:00");
    const done = await confirmPending(doctor, offered.pending!.token);
    expect(done).toMatchObject({ ok: true, summary: expect.stringMatching(/^Changed Morning/) });
    expect((await state.store!.getConsultSession(weekly.id))?.endTime).toBe("12:00");
  });

  it("will not strand booked patients, and leaves that to the Schedule page", async () => {
    expect(await state.store!.createAppointment(visit())).toBe("ok");
    const offered = await runTool(doctor, "propose_update_session", { sessionId: weekly.id, endTime: "10:00" });
    expect(offered.pending).toBeUndefined();
    expect(offered.forModel).toMatchObject({ error: expect.stringContaining("Schedule page") });
    expect((await state.store!.getConsultSession(weekly.id))?.endTime).toBe("11:00");
    expect((await state.store!.getAppointment("v1"))?.status).toBe("booked");
  });

  it("does not apply a change if the session was edited after it was prepared", async () => {
    const offered = await runTool(doctor, "propose_update_session", { sessionId: weekly.id, room: "Room 9" });
    expect(offered.pending!.summary).toContain("room Room 4 → Room 9");
    await state.store!.putConsultSession({ ...weekly, label: "Edited", updatedAt: "2099-01-05T02:00:00.000Z" });
    const done = await confirmPending(doctor, offered.pending!.token);
    expect(done).toMatchObject({ ok: false, summary: expect.stringContaining("changed after I prepared this") });
    expect((await state.store!.getConsultSession(weekly.id))?.room).toBe("Room 4");
  });

  it("asks for a one-off session to change a single day of a weekly one", async () => {
    const offered = await runTool(doctor, "propose_update_session", { sessionId: weekly.id, date: TODAY, startTime: "10:00" });
    expect(offered.pending).toBeUndefined();
    expect(offered.forModel).toMatchObject({ error: expect.stringContaining("add a one-off session on that date") });
  });
});
