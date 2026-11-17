import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppointmentRecord, PublicUser } from "../clinic-types";
import { setNow } from "../clock";
import { confirmBooking, getSlots } from "../repository";
import { openSlots } from "../schedule";
import { now } from "../clock";
import { getStore } from "../store";
import { confirmPending } from "./act";
import { resetConfirmationsForTests, issueConfirmation } from "./confirm-token";
import { isEcho } from "./echo";
import { interpretReply } from "./intent";
import { lockedLanguage } from "./language";
import { prescriptions, searchDoctors, visitConflicts } from "./read";
import { bookingHref, mergeSlotLinks, type SlotLink } from "./slot-links";
import { runTool } from "./tools";
import { allowTurn, ASSISTANT_MAX_BYTES, beginModelTurn, endModelTurn, handleTurn, readAssistantJson, resetTurnsForTests } from "./turn";

beforeEach(() => {
  process.env.ASSISTANT_TOKEN_SECRET = "assistant-test-secret";
  resetConfirmationsForTests();
  resetTurnsForTests();
  setNow(Date.UTC(2026, 9, 26, 13, 40));
});

function visit(overrides: Partial<AppointmentRecord>): AppointmentRecord {
  return {
    id: "v",
    reference: "HSP-100000",
    slotId: "slot",
    doctorId: "cho",
    date: "2026-11-12",
    time: "10:00",
    endTime: "10:15",
    reasonId: "follow",
    patientName: "Ann Lee",
    patientDob: "1980-03-14",
    patientMobile: "07700900123",
    patientChi: "1403801234",
    note: "private note",
    status: "booked",
    patientUserId: "user-patient-demo",
    createdAt: "2026-11-01T00:00:00.000Z",
    ...overrides,
  };
}

async function account(id: string): Promise<PublicUser> {
  const user = await (await getStore()).getUserById(id);
  if (!user) throw new Error(`Missing ${id}`);
  return user;
}

async function freeChoSlot() {
  const slots = openSlots(await getSlots("cho"), [], now());
  const slot = slots[0];
  if (!slot) throw new Error("No open slot for Dr Cho");
  return slot;
}

describe("assistant intent and echo", () => {
  it("accepts a short yes in English, Hindi and Hinglish, and refuses a changed request", () => {
    expect(interpretReply("yes")).toBe("confirm");
    expect(interpretReply("हाँ")).toBe("confirm");
    expect(interpretReply("theek hai")).toBe("confirm");
    expect(interpretReply("book karo")).toBe("confirm");
    expect(interpretReply("no")).toBe("reject");
    expect(interpretReply("नहीं")).toBe("reject");
    expect(interpretReply("nahi")).toBe("reject");
    expect(interpretReply("yes but make it 15:00")).toBe("chat");
    expect(interpretReply("yesterday")).toBe("chat");
    expect(interpretReply("please book Dr Cho tomorrow")).toBe("chat");
  });

  it("accepts a short yes or no in the major Indian languages, Urdu, Spanish and French", () => {
    for (const yes of ["అవును", "ஆம்", "ஆமாம்", "ಹೌದು", "അതെ", "हो", "होय", "হ্যাঁ", "હા", "ਹਾਂ", "ਹਾਂ ਜੀ", "جی", "ہاں", "جی ہاں", "avunu", "sí", "oui", "ठीक आहे।"]) {
      expect(interpretReply(yes), yes).toBe("confirm");
    }
    for (const no of ["కాదు", "வேண்டாம்", "இல்லை", "ಇಲ್ಲ", "ഇല്ല", "नाही", "नको", "না", "ના", "ਨਹੀਂ", "نہیں", "vaddu", "non"]) {
      expect(interpretReply(no), no).toBe("reject");
    }
  });

  it("keeps the safeguards for other languages: a changed time, a date word or a longer request is chat", () => {
    expect(interpretReply("అవును 3 గంటలకు")).toBe("chat");
    expect(interpretReply("हो ३ वाजता")).toBe("chat");
    expect(interpretReply("sí, but tomorrow")).toBe("chat");
    expect(interpretReply("అవును కానీ రేపు సాయంత్రం మార్చండి దయచేసి ఇంకా")).toBe("chat");
    expect(interpretReply("ఎప్పుడు")).toBe("chat");
    expect(interpretReply("doctor")).toBe("chat");
  });

  it("treats the assistant's own words as an echo", () => {
    expect(isEcho("Booked with Dr Cho on Thursday", "Booked with Dr Cho on Thursday at 10:00.")).toBe(true);
    expect(isEcho("book Dr Reid tomorrow morning", "Booked with Dr Cho on Thursday")).toBe(false);
  });
});

describe("assistant conflicts", () => {
  it("finds overlapping visits and ignores cancelled ones and other doctors", () => {
    const clashes = visitConflicts([
      visit({ id: "a", reference: "HSP-1", time: "10:00", endTime: "10:20" }),
      visit({ id: "b", reference: "HSP-2", time: "10:10", endTime: "10:30", patientName: "Ben" }),
      visit({ id: "c", reference: "HSP-3", time: "11:00", endTime: "11:15" }),
      visit({ id: "d", reference: "HSP-4", status: "cancelled", time: "10:00", endTime: "10:20", patientName: "Cara" }),
      visit({ id: "e", reference: "HSP-5", doctorId: "reid", time: "10:00", endTime: "10:20", patientName: "Dev" }),
    ]);
    expect(clashes).toEqual([
      expect.objectContaining({ referenceA: "HSP-1", referenceB: "HSP-2" }),
    ]);
  });
});

describe("assistant clinic actions", () => {
  it("does not book until the patient confirms, then books for real and refuses a second use", async () => {
    const patient = await account("user-patient-demo");
    const cho = await account("user-cho");
    const reid = await account("user-reid");
    const slot = await freeChoSlot();
    const store = await getStore();
    const before = (await store.listAppointments({ patientUserId: patient.id })).length;

    const proposed = await runTool(patient, "propose_book", { slotId: slot.id, reasonId: "follow", payOnline: false });
    expect(proposed.pending?.summary).toContain("Dr");
    expect(await store.listAppointments({ patientUserId: patient.id })).toHaveLength(before);

    const refused = await handleTurn(patient, [{ role: "user", content: "no thanks" }], proposed.pending!.token);
    expect(refused.reply).toMatch(/have not booked/i);
    expect(await store.listAppointments({ patientUserId: patient.id })).toHaveLength(before);

    const again = await runTool(patient, "propose_book", { slotId: slot.id, reasonId: "follow", payOnline: false });
    const booked = await handleTurn(patient, [{ role: "user", content: "yes" }], again.pending!.token);
    expect(booked.reply).toMatch(/Booked HSP-/);
    expect(booked.pending).toBeNull();
    const visits = await store.listAppointments({ patientUserId: patient.id });
    expect(visits).toHaveLength(before + 1);
    const visit = visits.find((item) => item.slotId === slot.id || item.slotId.startsWith(`${slot.id}#`));
    expect(visit?.status).toBe("booked");
    expect(visit?.patientDob).toBe(patient.dob);

    const replay = await confirmPending(patient, again.pending!.token);
    expect(replay.ok).toBe(false);
    expect(await store.listAppointments({ patientUserId: patient.id })).toHaveLength(before + 1);

    const listed = await runTool(cho, "list_appointments", { date: slot.date });
    const body = JSON.stringify(listed.forModel);
    expect(body).toContain(visit!.reference);
    expect(body).not.toContain(patient.mobile);
    expect(body).not.toContain(patient.dob);
    expect(body).not.toContain("private");

    const stats = await runTool(cho, "appointment_stats", { from: slot.date, to: slot.date });
    expect(stats.forModel).toMatchObject({ confirmed: expect.any(Number) });
    expect((stats.forModel as { confirmed: number }).confirmed).toBeGreaterThan(0);

    const hidden = await runTool(reid, "list_appointments", { date: slot.date });
    expect(JSON.stringify(hidden.forModel)).not.toContain(visit!.reference);

    const patientView = await runTool(patient, "list_appointments", { which: "upcoming" });
    expect(JSON.stringify(patientView.forModel)).toContain(visit!.reference);
    expect(JSON.stringify(patientView.forModel)).not.toContain("Ann Lee");

    expect(await runTool(patient, "appointment_stats", { from: slot.date })).toEqual({
      forModel: { error: "That action isn't available to this account." },
    });
    expect((await runTool(cho, "propose_book", { slotId: slot.id, reasonId: "follow" })).forModel).toMatchObject({
      error: expect.stringMatching(/isn't available|patient/i),
    });
  });

  it("rechecks the slot and books nothing if it was taken after the offer", async () => {
    const patient = await account("user-patient-demo");
    const slot = await freeChoSlot();
    const proposed = await runTool(patient, "propose_book", { slotId: slot.id, reasonId: "new", payOnline: false });
    await confirmBooking({ slot, reasonId: "bp", patientName: "Someone Else", patientUserId: "user-other" });
    const outcome = await confirmPending(patient, proposed.pending!.token);
    expect(outcome.ok).toBe(false);
    expect(outcome.summary).toMatch(/taken|no longer|Nothing was changed/i);
    const mine = await (await getStore()).listAppointments({ patientUserId: patient.id });
    expect(mine.some((item) => item.patientName === "Someone Else")).toBe(false);
  });

  it("rejects an expired confirmation and one sealed for someone else", async () => {
    const patient = await account("user-patient-demo");
    const cho = await account("user-cho");
    const expired = await issueConfirmation(patient, { type: "cancel", visitId: "missing" }, { title: "Cancel?", summary: "Cancel it", confirmLabel: "Cancel" }, Date.now() - 1000);
    const outcome = await confirmPending(patient, expired.token);
    expect(outcome.ok).toBe(false);
    expect(outcome.summary).toMatch(/expired/);

    const foreign = await issueConfirmation(cho, { type: "cancel", visitId: "missing" }, { title: "Cancel?", summary: "Cancel it", confirmLabel: "Cancel" });
    const stolen = await confirmPending(patient, foreign.token);
    expect(stolen.ok).toBe(false);
    expect(stolen.summary).toMatch(/another account/);
  });

  it("searches doctors, reports hours, and does not invent prescriptions", async () => {
    const patient = await account("user-patient-demo");
    const cho = await account("user-cho");
    const found = searchDoctors(patient, "diabetes");
    expect(JSON.stringify(found)).toContain("Reid");
    expect(prescriptions()).toMatchObject({ stored: false, prescriptions: [] });
    const hours = await runTool(cho, "working_hours", {});
    expect(JSON.stringify(hours.forModel)).toContain("leavesStored");
    const slot = await freeChoSlot();
    const day = await runTool(cho, "working_hours", { date: slot.date });
    expect(day.forModel).toMatchObject({ inClinic: true });
    const next = await runTool(patient, "next_available", { doctorId: "cho" });
    expect(JSON.stringify(next.forModel)).toContain("cho");
  });

  it("cancels only after confirmation and only for the owning patient", async () => {
    const patient = await account("user-patient-demo");
    const reid = await account("user-reid");
    const slot = await freeChoSlot();
    const booked = await confirmBooking({
      slot,
      reasonId: "meds",
      patientName: patient.name,
      patientDob: patient.dob,
      patientMobile: patient.mobile,
      patientUserId: patient.id,
    });
    const offered = await runTool(reid, "propose_cancel", { visitId: booked.visit.id });
    expect(offered.pending).toBeUndefined();
    expect(offered.forModel).toMatchObject({ error: expect.stringMatching(/own/i) });

    const mine = await runTool(patient, "propose_cancel", { visitId: booked.visit.id });
    expect(mine.pending).toBeTruthy();
    expect((await (await getStore()).getAppointment(booked.visit.id))?.status).toBe("booked");
    const done = await confirmPending(patient, mine.pending!.token);
    expect(done.ok).toBe(true);
    expect((await (await getStore()).getAppointment(booked.visit.id))?.status).toBe("cancelled");
  });
});

const PROVIDER_KEYS = ["GEMINI_API_KEY", "GEMINI_API_KEY_2", "GROQ_API_KEY", "XAI_API_KEY"] as const;

function saveProviderEnv(): Record<(typeof PROVIDER_KEYS)[number], string | undefined> {
  return {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_API_KEY_2: process.env.GEMINI_API_KEY_2,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    XAI_API_KEY: process.env.XAI_API_KEY,
  };
}

function restoreProviderEnv(saved: Record<(typeof PROVIDER_KEYS)[number], string | undefined>): void {
  for (const key of PROVIDER_KEYS) {
    const value = saved[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

/** Leave only the named fake keys, so a developer .env.local cannot pick a different provider. */
function pinProviderKeys(keys: Partial<Record<(typeof PROVIDER_KEYS)[number], string>>): Record<(typeof PROVIDER_KEYS)[number], string | undefined> {
  const saved = saveProviderEnv();
  for (const key of PROVIDER_KEYS) delete process.env[key];
  for (const [key, value] of Object.entries(keys)) {
    if (value) process.env[key] = value;
  }
  return saved;
}

describe("assistant languages", () => {
  async function withXai<T>(replies: unknown[], run: (fetchMock: ReturnType<typeof vi.fn>) => Promise<T>): Promise<T> {
    const saved = pinProviderKeys({ XAI_API_KEY: "test-key" });
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, text: async () => JSON.stringify(replies.shift()) }));
    vi.stubGlobal("fetch", fetchMock);
    try {
      return await run(fetchMock);
    } finally {
      vi.unstubAllGlobals();
      restoreProviderEnv(saved);
    }
  }

  function systemOf(fetchMock: ReturnType<typeof vi.fn>): string {
    const init = fetchMock.mock.calls[0]?.[1] as { body: string };
    const body = JSON.parse(init.body) as { input: { role?: string; content?: string }[] };
    return body.input.find((item) => item.role === "system")?.content ?? "";
  }

  it("tells the model the detected language and returns the reply's locale", async () => {
    const patient = await account("user-patient-demo");
    await withXai([{ output_text: "మీకు ఈ వారం అపాయింట్‌మెంట్‌లు లేవు." }], async (fetchMock) => {
      const result = await handleTurn(patient, [{ role: "user", content: "నా అపాయింట్‌మెంట్‌లు చూపించు" }], null);
      expect(result.locale).toBe("te-IN");
      const system = systemOf(fetchMock);
      expect(system).toMatch(/appears to be in Telugu/);
      expect(system).toMatch(/Do not ask which language they want/);
      expect(system).toMatch(/Do not translate into English unless they wrote in English/);
      // The other rules are still there.
      expect(system).toMatch(/Never invent a time/);
      expect(system).toMatch(/Do not reveal dates of birth/);
    });
  });

  it("keeps the conversation's language for a short follow-up", async () => {
    const patient = await account("user-patient-demo");
    await withXai([{ output_text: "ঠিক আছে।" }], async (fetchMock) => {
      const result = await handleTurn(
        patient,
        [
          { role: "user", content: "আমার অ্যাপয়েন্টমেন্ট কবে?" },
          { role: "assistant", content: "আগামীকাল সকাল ১০টায়।" },
          { role: "user", content: "ok" },
        ],
        null,
      );
      expect(systemOf(fetchMock)).toMatch(/appears to be in Bengali/);
      expect(result.locale).toBe("bn-IN");
    });
  });

  it("honours a language locked in the dock's menu over the language the user writes in", async () => {
    const patient = await account("user-patient-demo");
    await withXai([{ output_text: "You have no visits booked this week." }], async (fetchMock) => {
      const result = await handleTurn(patient, [{ role: "user", content: "When is my appointment?" }], null, lockedLanguage("te"));
      const system = systemOf(fetchMock);
      expect(system).toMatch(/chose Telugu \(Telugu script\) in the assistant's language menu/);
      expect(system).toMatch(/Always reply in Telugu/);
      expect(system).not.toMatch(/Automatically detect the language/);
      expect(system).toMatch(/Never invent a time/);
      // Spoken and listened to in the picked language, even if the model slipped into English.
      expect(result.locale).toBe("te-IN");
    });
  });

  it("speaks the reply in the language it was actually written in", async () => {
    const patient = await account("user-patient-demo");
    await withXai([{ output_text: "You have no visits booked this week." }], async () => {
      const result = await handleTurn(patient, [{ role: "user", content: "नमस्ते, मेरी अपॉइंटमेंट कब है?" }], null);
      expect(result.locale).toBe("en-IN");
    });
  });

  it("confirms with a Telugu yes and rejects with a Bengali no, returning a locale for the summary", async () => {
    const patient = await account("user-patient-demo");
    const store = await getStore();
    const slot = await freeChoSlot();
    const before = (await store.listAppointments({ patientUserId: patient.id })).length;

    const first = await runTool(patient, "propose_book", { slotId: slot.id, reasonId: "follow", payOnline: false });
    const refused = await handleTurn(patient, [{ role: "user", content: "না" }], first.pending!.token);
    expect(refused.reply).toMatch(/have not booked/i);
    expect(refused.locale).toBe("en-IN");
    expect(await store.listAppointments({ patientUserId: patient.id })).toHaveLength(before);

    const second = await runTool(patient, "propose_book", { slotId: slot.id, reasonId: "follow", payOnline: false });
    const booked = await handleTurn(patient, [{ role: "user", content: "అవును" }], second.pending!.token);
    expect(booked.reply).toMatch(/Booked HSP-/);
    // The summary is English, so it is spoken in English.
    expect(booked.locale).toBe("en-IN");
    expect(await store.listAppointments({ patientUserId: patient.id })).toHaveLength(before + 1);
  });
});

describe("assistant open-time links", () => {
  it("returns open times as structured links for patients, and plain times for doctors", async () => {
    const patient = await account("user-patient-demo");
    const cho = await account("user-cho");
    const listed = await runTool(patient, "list_open_slots", { doctorId: "cho" });
    expect(listed.slots?.length).toBeGreaterThan(0);
    const first = listed.slots![0]!;
    expect(first).toMatchObject({ doctorId: "cho", doctor: expect.stringContaining("Cho") });
    expect(first.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(first.time).toMatch(/^\d{2}:\d{2}$/);
    expect(first.href).toBe(bookingHref(first.id));
    expect(first.href).toBe(`/book/details?slot=${encodeURIComponent(first.id)}`);

    const next = await runTool(patient, "next_available", { doctorId: "cho" });
    expect(next.slots).toHaveLength(1);
    const own = await runTool(cho, "list_open_slots", {});
    expect(own.slots?.length).toBeGreaterThan(0);
    expect(own.slots!.every((slot) => slot.href === null)).toBe(true);

    const refused = await runTool(patient, "list_open_slots", { doctorId: "nobody" });
    expect(refused.slots).toBeUndefined();
    expect(await runTool(patient, "list_visit_reasons", {})).not.toHaveProperty("slots");
  });

  it("merges times without repeats, in order, and caps the list", () => {
    const make = (id: string, date: string, time: string): SlotLink => ({ id, doctorId: "cho", doctor: "Dr Cho", date, time, endTime: null, mode: "stream", href: null });
    const merged = mergeSlotLinks([make("b", "2026-11-13", "09:00"), make("a", "2026-11-12", "10:45")], [make("a", "2026-11-12", "10:45")]);
    expect(merged.map((slot) => slot.id)).toEqual(["a", "b"]);
    const many = Array.from({ length: 40 }, (_, index) => make(`s${index}`, "2026-11-12", `${String(9 + Math.floor(index / 4)).padStart(2, "0")}:${String((index % 4) * 15).padStart(2, "0")}`));
    expect(mergeSlotLinks([], many)).toHaveLength(24);
  });

  it("passes the tools' open times through a turn alongside the reply", async () => {
    const patient = await account("user-patient-demo");
    const saved = pinProviderKeys({ XAI_API_KEY: "test-key" });
    const replies = [
      { output: [{ type: "function_call", name: "list_open_slots", call_id: "c1", arguments: JSON.stringify({ doctorId: "cho" }) }] },
      { output_text: "Dr Cho has times today and tomorrow. Tap one to book it." },
    ];
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, text: async () => JSON.stringify(replies.shift()) }));
    vi.stubGlobal("fetch", fetchMock);
    try {
      const result = await handleTurn(patient, [{ role: "user", content: "Can you find the available slots for Cho" }], null);
      expect(result.reply).toBe("Dr Cho has times today and tomorrow. Tap one to book it.");
      expect(result.pending).toBeNull();
      expect(result.slots?.length).toBeGreaterThan(0);
      expect(result.slots![0]!.href).toMatch(/^\/book\/details\?slot=/);
      // Nothing was booked by listing times.
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.unstubAllGlobals();
      restoreProviderEnv(saved);
    }
  });
});

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) };
}

function fetchInit(fetchMock: ReturnType<typeof vi.fn>, index: number): RequestInit {
  const call = fetchMock.mock.calls[index] as [string, RequestInit] | undefined;
  if (!call) throw new Error(`missing fetch call ${index}`);
  return call[1];
}

describe("assistant provider chain", () => {
  const question = [{ role: "user" as const, content: "When is my appointment?" }];

  async function withFetch(keys: Partial<Record<(typeof PROVIDER_KEYS)[number], string>>, fetchMock: ReturnType<typeof vi.fn>, run: () => Promise<void>) {
    const saved = pinProviderKeys(keys);
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", fetchMock);
    try {
      await run();
    } finally {
      errors.mockRestore();
      vi.unstubAllGlobals();
      restoreProviderEnv(saved);
    }
  }

  it("tries the first Gemini account, then the second, then Groq", async () => {
    const patient = await account("user-patient-demo");
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      const headers = new Headers(init.headers);
      const target = String(url);
      if (target.includes("generativelanguage.googleapis.com")) {
        const status = headers.get("x-goog-api-key") === "gemini-2" ? 503 : 429;
        return jsonResponse(status, { error: { message: "unavailable" } });
      }
      if (target.includes("api.groq.com")) {
        return jsonResponse(200, { choices: [{ message: { role: "assistant", content: "From Groq." } }] });
      }
      throw new Error(`unexpected ${target}`);
    });
    await withFetch({ GEMINI_API_KEY: "gemini-1", GEMINI_API_KEY_2: "gemini-2", GROQ_API_KEY: "groq-key" }, fetchMock, async () => {
      const result = await handleTurn(patient, question, null);
      expect(result.reply).toBe("From Groq.");
      expect(fetchMock).toHaveBeenCalledTimes(3);
      const keys = fetchMock.mock.calls.slice(0, 2).map((call) => new Headers((call[1] as RequestInit).headers).get("x-goog-api-key"));
      expect(keys).toEqual(["gemini-1", "gemini-2"]);
      expect(String(fetchMock.mock.calls[2]?.[0])).toContain("api.groq.com");
      const groqHeaders = new Headers(fetchInit(fetchMock, 2).headers);
      expect(groqHeaders.get("authorization")).toBe("Bearer groq-key");
    });
  });

  it("stops when the first Gemini account answers", async () => {
    const patient = await account("user-patient-demo");
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => jsonResponse(200, { output_text: "Hello from Gemini." }));
    await withFetch({ GEMINI_API_KEY: "gemini-1", GROQ_API_KEY: "groq-key" }, fetchMock, async () => {
      const result = await handleTurn(patient, question, null);
      expect(result.reply).toBe("Hello from Gemini.");
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(String(fetchMock.mock.calls[0]?.[0])).toContain("generativelanguage.googleapis.com");
    });
  });

  it("does not try the next account after a 400", async () => {
    const patient = await account("user-patient-demo");
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => jsonResponse(400, { error: { message: "bad request" } }));
    await withFetch({ GEMINI_API_KEY: "gemini-1", GROQ_API_KEY: "groq-key" }, fetchMock, async () => {
      await expect(handleTurn(patient, question, null)).rejects.toThrow(/busy/i);
      // The same Gemini account is tried once more without generation_config. A 400 does not move on to Groq.
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls.map((call) => String(call[0]))).toEqual([
        "https://generativelanguage.googleapis.com/v1beta/interactions",
        "https://generativelanguage.googleapis.com/v1beta/interactions",
      ]);
      const secondBody = JSON.parse(String(fetchInit(fetchMock, 1).body)) as { generation_config?: unknown };
      expect(secondBody.generation_config).toBeUndefined();
    });
  });

  it("skips a cooled-down account until two minutes have passed", async () => {
    const patient = await account("user-patient-demo");
    let now = 1_700_000_000_000;
    const clock = vi.spyOn(Date, "now").mockImplementation(() => now);
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const key = new Headers(init.headers).get("x-goog-api-key");
      if (key === "gemini-1") return jsonResponse(429, { error: { message: "quota" } });
      return jsonResponse(200, { output_text: "Second account." });
    });
    try {
      await withFetch({ GEMINI_API_KEY: "gemini-1", GEMINI_API_KEY_2: "gemini-2" }, fetchMock, async () => {
        const first = await handleTurn(patient, question, null);
        expect(first.reply).toBe("Second account.");
        expect(fetchMock).toHaveBeenCalledTimes(2);
        fetchMock.mockClear();
        const second = await handleTurn(patient, question, null);
        expect(second.reply).toBe("Second account.");
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(new Headers(fetchInit(fetchMock, 0).headers).get("x-goog-api-key")).toBe("gemini-2");
        now += 120_001;
        fetchMock.mockClear();
        await handleTurn(patient, question, null);
        expect(new Headers(fetchInit(fetchMock, 0).headers).get("x-goog-api-key")).toBe("gemini-1");
      });
    } finally {
      clock.mockRestore();
    }
  });

  it("does not start another provider after the failover budget", async () => {
    const patient = await account("user-patient-demo");
    let now = 1_700_000_000_000;
    const clock = vi.spyOn(Date, "now").mockImplementation(() => now);
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => {
      now += 36_000;
      return jsonResponse(429, { error: { message: "quota" } });
    });
    try {
      await withFetch({ GEMINI_API_KEY: "gemini-1", GEMINI_API_KEY_2: "gemini-2", GROQ_API_KEY: "groq-key" }, fetchMock, async () => {
        await expect(handleTurn(patient, question, null)).rejects.toThrow(/busy/i);
        expect(fetchMock).toHaveBeenCalledTimes(1);
      });
    } finally {
      clock.mockRestore();
    }
  });

  it("runs a Groq tool call and sends the result back", async () => {
    const patient = await account("user-patient-demo");
    const replies = [
      {
        choices: [
          {
            message: {
              role: "assistant",
              content: null,
              tool_calls: [{ id: "call_1", type: "function", function: { name: "list_open_slots", arguments: JSON.stringify({ doctorId: "cho" }) } }],
            },
          },
        ],
      },
      { choices: [{ message: { role: "assistant", content: "Dr Cho has open times. Tap one to book it." } }] },
    ];
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => jsonResponse(200, replies.shift()));
    await withFetch({ GROQ_API_KEY: "groq-key" }, fetchMock, async () => {
      const result = await handleTurn(patient, [{ role: "user", content: "Can you find the available slots for Cho" }], null);
      expect(result.reply).toBe("Dr Cho has open times. Tap one to book it.");
      expect(result.slots?.length).toBeGreaterThan(0);
      const firstBody = JSON.parse(String(fetchInit(fetchMock, 0).body)) as { tools: { function: { name: string } }[] };
      expect(firstBody.tools.some((tool) => tool.function.name === "list_open_slots")).toBe(true);
      const secondBody = JSON.parse(String(fetchInit(fetchMock, 1).body)) as { messages: { role: string }[] };
      expect(secondBody.messages.some((message) => message.role === "tool")).toBe(true);
    });
  });
});

describe("assistant usage limits", () => {
  it("allows 8 model turns a minute, still allows a confirmation, and blocks a second turn in flight", () => {
    const at = Date.UTC(2026, 10, 15, 4, 0, 0);
    for (let i = 0; i < 8; i += 1) {
      expect(beginModelTurn("patient-1", at).ok).toBe(true);
      endModelTurn("patient-1");
    }
    expect(beginModelTurn("patient-1", at)).toMatchObject({ ok: false, message: "Too many requests. Wait a minute and try again." });
    expect(allowTurn("patient-1", 20, 60_000, at)).toBe(true);

    expect(beginModelTurn("patient-2", at).ok).toBe(true);
    expect(beginModelTurn("patient-2", at)).toMatchObject({ ok: false, message: "A reply is already in progress." });
    endModelTurn("patient-2");
  });

  it("stops a user after 60 model turns in a clinic day", () => {
    const start = Date.UTC(2026, 10, 15, 4, 0, 0);
    for (let i = 0; i < 60; i += 1) {
      expect(beginModelTurn("patient-day", start + i * 60_000).ok).toBe(true);
      endModelTurn("patient-day");
    }
    expect(beginModelTurn("patient-day", start + 60 * 60_000)).toMatchObject({
      ok: false,
      message: "You've reached today's assistant limit. Try again tomorrow.",
    });
  });

  it("stops the whole server after 40 model turns in a minute", () => {
    const at = Date.UTC(2026, 10, 15, 4, 0, 0);
    for (let i = 0; i < 40; i += 1) {
      expect(beginModelTurn(`user-${i}`, at).ok).toBe(true);
      endModelTurn(`user-${i}`);
    }
    expect(beginModelTurn("user-extra", at)).toMatchObject({ ok: false, message: "Too many requests. Wait a minute and try again." });
  });

  it("rejects an oversized body and a foreign origin without calling a provider", async () => {
    const huge = new Request("https://halden.example/api/assistant", {
      method: "POST",
      headers: { origin: "https://halden.example", "content-type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "x".repeat(ASSISTANT_MAX_BYTES) }] }),
    });
    expect(await readAssistantJson(huge)).toMatchObject({ ok: false, status: 413 });

    const foreign = new Request("https://halden.example/api/assistant", {
      method: "POST",
      headers: { origin: "https://evil.example", "content-type": "application/json" },
      body: "{}",
    });
    expect(await readAssistantJson(foreign)).toMatchObject({ ok: false, status: 403 });

    const sameSite = new Request("https://halden.example/api/assistant", {
      method: "POST",
      headers: { origin: "https://halden.example", "content-type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "Hello" }] }),
    });
    const parsed = await readAssistantJson(sameSite);
    expect(parsed.ok).toBe(true);
  });
});
