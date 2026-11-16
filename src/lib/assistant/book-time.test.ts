import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicUser } from "../clinic-types";
import { addDays, now, setNow, todayIso } from "../clock";
import { getSlots } from "../repository";
import { openSlots } from "../schedule";
import { getStore } from "../store";
import { confirmPending } from "./act";
import { asciiDigits, bookTime, candidateTimes, matchDoctors, parseTime } from "./book-time";
import { resetConfirmationsForTests } from "./confirm-token";
import { askClinic, CLARIFY_BOOKING } from "./grok";
import { runTool } from "./tools";
import { handleSlotPick, resetTurnsForTests } from "./turn";

const KEYS = ["GEMINI_API_KEY", "GEMINI_API_KEY_2", "GROQ_API_KEY", "XAI_API_KEY"] as const;
let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  process.env.ASSISTANT_TOKEN_SECRET = "assistant-test-secret";
  resetConfirmationsForTests();
  resetTurnsForTests();
  setNow(Date.UTC(2026, 9, 26, 13, 40));
  saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
  for (const key of KEYS) delete process.env[key];
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

async function account(id: string): Promise<PublicUser> {
  const user = await (await getStore()).getUserById(id);
  if (!user) throw new Error(`Missing ${id}`);
  return user;
}

async function choTomorrow() {
  const tomorrow = addDays(todayIso(now()), 1);
  const open = openSlots(await getSlots("cho"), [], now()).filter((slot) => slot.date === tomorrow);
  expect(open.length).toBeGreaterThan(1);
  return { tomorrow, open };
}

describe("reading a spoken time", () => {
  it("understands the ways people say a time, in any script", () => {
    expect(parseTime("11")).toEqual({ hour: 11, minute: 0, fixed: false });
    expect(parseTime("i want to book 11 kavya")).toMatchObject({ hour: 11, minute: 0 });
    expect(parseTime("11:00")).toMatchObject({ hour: 11, minute: 0 });
    expect(parseTime("1120")).toMatchObject({ hour: 11, minute: 20 });
    expect(parseTime("11.20")).toMatchObject({ hour: 11, minute: 20 });
    expect(parseTime("प्लीज बुक 1120 स्लॉट")).toMatchObject({ hour: 11, minute: 20 });
    expect(parseTime("११:२०")).toMatchObject({ hour: 11, minute: 20 });
    expect(parseTime("11 बजे")).toMatchObject({ hour: 11, minute: 0 });
    expect(parseTime("2 pm")).toEqual({ hour: 14, minute: 0, fixed: true });
    expect(parseTime("2:30pm")).toEqual({ hour: 14, minute: 30, fixed: true });
    expect(parseTime("14:40")).toEqual({ hour: 14, minute: 40, fixed: true });
    expect(parseTime("i am free at 2")).toEqual({ hour: 2, minute: 0, fixed: false });
    expect(parseTime("9 am")).toEqual({ hour: 9, minute: 0, fixed: true });
    expect(parseTime("tomorrow please")).toBeNull();
    expect(asciiDigits("౧౧:౨౦")).toBe("11:20");
    expect(candidateTimes({ hour: 2, minute: 0, fixed: false })).toEqual(["02:00", "14:00"]);
  });

  it("finds a doctor from a first name or surname", () => {
    expect(matchDoctors("helen").map((doctor) => doctor.id)).toEqual(["cho"]);
    expect(matchDoctors("Dr Cho").map((doctor) => doctor.id)).toEqual(["cho"]);
    expect(matchDoctors("nobody at all")).toEqual([]);
  });
});

describe("booking from chat", () => {
  it("prepares the booking card from 'book <time> with helen tomorrow' in one call", async () => {
    const patient = await account("user-patient-demo");
    const { tomorrow, open } = await choTomorrow();
    const slot = open[1]!;
    const result = await runTool(patient, "book_time", { doctor: "helen", date: "tomorrow", time: slot.time.replace(":", "") });
    expect(result.pending).toBeDefined();
    expect(result.pending!.summary).toContain(slot.time);
    expect(result.pending!.title).toBe("Book this visit?");
    expect(result.forModel).toMatchObject({ needsConfirmation: true });
    expect(slot.date).toBe(tomorrow);
  });

  it("offers the nearest open times when that time isn't free, and books nothing", async () => {
    const patient = await account("user-patient-demo");
    const result = await runTool(patient, "book_time", { doctor: "helen", date: "tomorrow", time: "03:07" });
    expect(result.pending).toBeUndefined();
    expect(result.forModel).toMatchObject({ available: false });
    expect(result.slots?.length).toBeGreaterThan(0);
  });

  it("asks one question instead of guessing", async () => {
    const patient = await account("user-patient-demo");
    expect((await bookTime(patient, { doctor: "", date: "tomorrow", time: "", reasonId: "", payOnline: false, note: "" })).forModel).toMatchObject({ needsAnswer: true });
    expect((await bookTime(patient, { doctor: "zzzz", date: "", time: "11", reasonId: "", payOnline: false, note: "" })).forModel).toMatchObject({ needsAnswer: true });
    const doctor = await account("user-cho");
    expect((await runTool(doctor, "book_time", { time: "11" })).forModel).toMatchObject({ error: expect.any(String) });
  });

  it("books a tapped time with no model call, then really books on confirm", async () => {
    const patient = await account("user-patient-demo");
    const { open } = await choTomorrow();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const picked = await handleSlotPick(patient, open[0]!.id);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(picked.pending?.title).toBe("Book this visit?");
    const store = await getStore();
    const before = (await store.listAppointments({ patientUserId: patient.id })).length;
    const done = await confirmPending(patient, picked.pending!.token);
    expect(done.ok).toBe(true);
    expect(done.summary).toMatch(/Booked HSP-/);
    expect(await store.listAppointments({ patientUserId: patient.id })).toHaveLength(before + 1);
    // The same time can't be prepared twice now.
    expect((await handleSlotPick(patient, open[0]!.id)).pending).toBeNull();
  });

  it("uses the conversation for a bare '11:20' and never dead-ends", async () => {
    process.env.XAI_API_KEY = "test-xai";
    const patient = await account("user-patient-demo");
    const { open } = await choTomorrow();
    const slot = open[2]!;
    const replies: unknown[] = [
      { output: [{ type: "function_call", name: "book_time", call_id: "b1", arguments: JSON.stringify({ doctor: "Helen Cho", date: "tomorrow", time: slot.time }) }] },
      { output_text: "Please confirm the booking below." },
    ];
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, text: async () => JSON.stringify(replies.shift()) })));
    const answer = await askClinic(patient, [
      { role: "user", content: "times with helen tomorrow?" },
      { role: "assistant", content: "Dr Helen Cho has times tomorrow.\n\n[Open times shown under this reply: Dr Helen Cho on 2026-10-27: 09:00]" },
      { role: "user", content: slot.time },
    ]);
    expect(answer.pending?.summary).toContain(slot.time);
  });

  it("answers with a question when the model keeps calling tools, and the last step has no tools", async () => {
    process.env.XAI_API_KEY = "test-xai";
    const patient = await account("user-patient-demo");
    const bodies: { tools?: unknown }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: { body: string }) => {
        bodies.push(JSON.parse(init.body) as { tools?: unknown });
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ output: [{ type: "function_call", name: "search_doctors", call_id: `c${bodies.length}`, arguments: "{}" }] }),
        };
      }),
    );
    const answer = await askClinic(patient, [{ role: "user", content: "book kavya" }]);
    expect(answer.reply).toBe(CLARIFY_BOOKING);
    expect(answer.reply).not.toMatch(/couldn't finish/);
    expect(bodies.at(-1)).not.toHaveProperty("tools");
    expect(bodies[0]).toHaveProperty("tools");
  });
});
