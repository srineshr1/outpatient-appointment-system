import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppointmentRecord, ConsultSession, PublicUser } from "../clinic-types";
import { setNow } from "../clock";
import { slotId } from "../sessions";
import { getStore } from "../store";
import { resetConfirmationsForTests } from "./confirm-token";
import { doctorAppointments } from "./read";
import { handleTurn, resetTurnsForTests } from "./turn";

// Friday 13 Nov 2026, 10:50 at the clinic (IST): the day of the "no appointments" screenshot.
const FRIDAY_MORNING = Date.UTC(2026, 10, 13, 5, 20);

let seq = 0;

function doctorUser(doctorId: string): PublicUser {
  return { id: doctorId, email: `${doctorId}@example.test`, name: "Dr Strange", role: "doctor", doctorId, mobile: "", dob: "" };
}

function session(doctorId: string, overrides: Partial<ConsultSession> = {}): ConsultSession {
  return {
    id: `s-${doctorId}-${(seq += 1)}`,
    doctorId,
    label: "",
    weekdays: [5],
    startTime: "12:00",
    endTime: "16:00",
    room: "67",
    mode: "wave",
    slotMinutes: null,
    waveMinutes: null,
    waveCapacity: 6,
    startDate: "2026-11-13",
    endDate: "2026-11-17",
    onDate: null,
    archivedAt: null,
    createdAt: "2026-11-13T05:19:13.341Z",
    updatedAt: "2026-11-13T05:19:13.341Z",
    ...overrides,
  };
}

function visit(doctorId: string, overrides: Partial<AppointmentRecord> = {}): AppointmentRecord {
  seq += 1;
  return {
    id: `v-${doctorId}-${seq}`,
    reference: `HSP-9${String(seq).padStart(5, "0")}`,
    slotId: `slot-${doctorId}-${seq}`,
    doctorId,
    date: "2026-11-13",
    time: "11:20",
    endTime: "11:40",
    reasonId: "bp",
    patientName: "TylerTheCreator",
    patientDob: "1990-01-01",
    patientMobile: "07700900123",
    patientChi: "0101901234",
    note: "",
    status: "booked",
    patientUserId: "user-patient-demo",
    createdAt: "2026-11-13T05:21:54.791Z",
    sessionId: null,
    ...overrides,
  };
}

async function withModel<T>(replies: unknown[], run: (fetchMock: ReturnType<typeof vi.fn>) => Promise<T>): Promise<T> {
  const saved = { xai: process.env.XAI_API_KEY, gemini: process.env.GEMINI_API_KEY };
  process.env.XAI_API_KEY = "test-key";
  delete process.env.GEMINI_API_KEY;
  const fetchMock = vi.fn(async () => ({ ok: true, status: 200, text: async () => JSON.stringify(replies.shift()) }));
  vi.stubGlobal("fetch", fetchMock);
  try {
    return await run(fetchMock);
  } finally {
    vi.unstubAllGlobals();
    if (saved.xai === undefined) delete process.env.XAI_API_KEY;
    else process.env.XAI_API_KEY = saved.xai;
    if (saved.gemini !== undefined) process.env.GEMINI_API_KEY = saved.gemini;
  }
}

beforeEach(() => {
  process.env.ASSISTANT_TOKEN_SECRET = "assistant-test-secret";
  resetConfirmationsForTests();
  resetTurnsForTests();
  setNow(FRIDAY_MORNING);
});

describe("assistant: the doctor's day", () => {
  it("reports a session with no bookings as a clinic day, not an empty one", async () => {
    const doctorId = `doc-empty-wave-${Date.now()}`;
    const store = await getStore();
    await store.putConsultSession(session(doctorId));
    const day = await doctorAppointments(doctorUser(doctorId), "today");
    expect(day).toMatchObject({ date: "2026-11-13", inClinic: true, count: 0, activeVisits: 0 });
    if (!("sessions" in day)) throw new Error("expected a day");
    expect(day.sessions).toEqual([
      expect.objectContaining({ mode: "wave", startTime: "12:00", endTime: "16:00", places: 6, booked: 0, placesLeft: 6, label: "Consulting session" }),
    ]);
    expect(day.summary).toMatch(/in clinic/i);
    expect(day.summary).toMatch(/not empty/i);
    expect(day.summary).not.toMatch(/out of clinic/i);
  });

  it("includes a booked visit today with patient, time and reason, and counts it in its session", async () => {
    const doctorId = `doc-booked-${Date.now()}`;
    const store = await getStore();
    const morning = session(doctorId, { mode: "stream", startTime: "09:00", endTime: "12:00", slotMinutes: 20, waveCapacity: null, weekdays: [1, 2, 3, 4, 5], startDate: "2026-11-11", endDate: "2026-11-13" });
    await store.putConsultSession(morning);
    expect(await store.createAppointment(visit(doctorId, { sessionId: morning.id, slotId: slotId(doctorId, "2026-11-13", "11:20") }))).toBe("ok");
    await store.createAppointment(visit(doctorId, { time: "09:15", endTime: "09:35", status: "cancelled", patientName: "Someone Else" }));
    const day = await doctorAppointments(doctorUser(doctorId), "today");
    if (!("sessions" in day)) throw new Error("expected a day");
    expect(day.inClinic).toBe(true);
    expect(day.activeVisits).toBe(1);
    expect(day.sessions[0]).toMatchObject({ mode: "stream", startTime: "09:00", endTime: "12:00", places: 9, booked: 1, placesLeft: 8 });
    expect(day.appointments).toEqual(
      expect.arrayContaining([expect.objectContaining({ time: "11:20", patientName: "TylerTheCreator", reason: expect.stringMatching(/blood/i), status: "booked" })]),
    );
    // Private details never reach the model.
    expect(JSON.stringify(day)).not.toContain("07700900123");
  });

  it("still lists a visit booked outside any session", async () => {
    const doctorId = `doc-orphan-${Date.now()}`;
    const store = await getStore();
    await store.createAppointment(visit(doctorId));
    const day = await doctorAppointments(doctorUser(doctorId), "today");
    if (!("sessions" in day)) throw new Error("expected a day");
    expect(day.inClinic).toBe(false);
    expect(day.summary).toMatch(/1 visit is on the book/);
    expect(day.appointments[0]).toMatchObject({ time: "11:20" });
  });

  it("calls a day empty only when there is no session and no visit", async () => {
    const day = await doctorAppointments(doctorUser(`doc-nothing-${Date.now()}`), "today");
    expect(day).toMatchObject({ inClinic: false, count: 0, sessions: [] });
    if (!("summary" in day)) throw new Error("expected a day");
    expect(day.summary).toMatch(/out of clinic/);
  });

  it("uses the clinic's date for 'today' just after midnight at the clinic, whatever the server zone", async () => {
    // 18:45 UTC on Thursday is 00:15 on Friday 13 Nov at the clinic.
    setNow(Date.UTC(2026, 10, 12, 18, 45));
    const doctorId = `doc-midnight-${Date.now()}`;
    await (await getStore()).putConsultSession(session(doctorId));
    const day = await doctorAppointments(doctorUser(doctorId), "today");
    expect(day).toMatchObject({ date: "2026-11-13", inClinic: true });
  });

  it("hands the model the sessions and the 'not empty' rule when a doctor asks about today", async () => {
    const doctorId = `doc-turn-${Date.now()}`;
    await (await getStore()).putConsultSession(session(doctorId));
    const replies = [
      { output: [{ type: "function_call", name: "list_appointments", call_id: "c1", arguments: JSON.stringify({ date: "today" }) }] },
      { output_text: "Your wave session runs 12:00–16:00 today. No one is booked yet (0 of 6)." },
    ];
    await withModel(replies, async (fetchMock) => {
      const result = await handleTurn(doctorUser(doctorId), [{ role: "user", content: "What's on my schedule today?" }], null);
      expect(result.reply).toMatch(/12:00–16:00/);
      const first = JSON.parse((fetchMock.mock.calls[0]?.[1] as { body: string }).body) as { input: { role?: string; content?: string }[] };
      const system = first.input.find((item) => item.role === "system")?.content ?? "";
      expect(system).toMatch(/call list_appointments/);
      expect(system).toMatch(/Never say the schedule is empty/);
      const second = (fetchMock.mock.calls[1]?.[1] as { body: string }).body;
      expect(second).toContain("12:00");
      expect(second).toContain("not empty");
      expect(second).toContain("placesLeft");
    });
  });
});
