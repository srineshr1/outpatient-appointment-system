import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicUser } from "../clinic-types";
import { setNow } from "../clock";
import { getStore } from "../store";
import { resetConfirmationsForTests } from "./confirm-token";
import { askClinic, geminiThinkingLevel, timingLine } from "./grok";
import { runTool } from "./tools";
import { resetTurnsForTests } from "./turn";

const KEYS = ["GEMINI_API_KEY", "GEMINI_API_KEY_2", "GROQ_API_KEY", "XAI_API_KEY", "GEMINI_MODEL", "GROQ_MODEL"] as const;
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

function replying(replies: unknown[]) {
  const fetchMock = vi.fn(async (_url: string, _init: { body: string }) => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify(replies.shift()),
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("all-doctor availability", () => {
  it("answers 'what is free tomorrow' for every doctor in one tool call", async () => {
    const patient = await account("user-patient-demo");
    const result = await runTool(patient, "list_open_slots", { date: "tomorrow" });
    const forModel = result.forModel as { date: string; doctorCount: number; doctors: { doctorId: string; count: number }[]; slots: { date: string; doctorId: string }[] };
    expect(forModel.date).toBe("2026-10-27");
    expect(forModel.doctorCount).toBeGreaterThan(1);
    expect(forModel.slots.every((slot) => slot.date === "2026-10-27")).toBe(true);
    const doctorsWithLinks = new Set(result.slots?.map((slot) => slot.doctorId));
    expect(doctorsWithLinks.size).toBeGreaterThan(1);
    expect(result.slots!.every((slot) => slot.href?.startsWith("/book/details?slot="))).toBe(true);
    // No slot ids or patient details beyond the open times themselves.
    expect(JSON.stringify(forModel)).not.toMatch(/patientName|mobile|dob/i);
  });

  it("still serves one doctor when doctorId is given, and only patients get the all-doctor list", async () => {
    const patient = await account("user-patient-demo");
    const one = await runTool(patient, "list_open_slots", { doctorId: "cho" });
    expect((one.forModel as { doctorId: string }).doctorId).toBe("cho");
    const cho = await account("user-cho");
    const own = await runTool(cho, "list_open_slots", {});
    expect(own.slots!.every((slot) => slot.doctorId === "cho")).toBe(true);
  });
});

describe("assistant latency", () => {
  it("asks Gemini for minimal thinking and steers patients to the one-call availability tool", async () => {
    process.env.GEMINI_API_KEY = "test-gemini";
    const patient = await account("user-patient-demo");
    const fetchMock = replying([
      { steps: [{ type: "function_call", name: "list_open_slots", id: "c1", arguments: { date: "tomorrow" } }] },
      { output_text: "Several doctors have times tomorrow. Tap one to book it." },
    ]);
    const answer = await askClinic(patient, [{ role: "user", content: "What times are free tomorrow?" }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body) as { generation_config: { thinking_level: string }; system_instruction: string };
    expect(body.generation_config.thinking_level).toBe("minimal");
    expect(body.system_instruction).toMatch(/call list_open_slots once without doctorId/);
    expect(new Set(answer.slots.map((slot) => slot.doctorId)).size).toBeGreaterThan(1);
    expect(answer.timing).toMatchObject({ provider: "gemini-1", tools: ["list_open_slots"] });
    expect(answer.timing!.modelMs).toHaveLength(2);
  });

  it("runs one step's tool calls as a single batch and keeps their order", async () => {
    process.env.GEMINI_API_KEY = "test-gemini";
    const patient = await account("user-patient-demo");
    const fetchMock = replying([
      {
        steps: [
          { type: "function_call", name: "list_open_slots", id: "a", arguments: { doctorId: "cho", date: "tomorrow" } },
          { type: "function_call", name: "list_visit_reasons", id: "b", arguments: {} },
        ],
      },
      { output_text: "Done." },
    ]);
    const answer = await askClinic(patient, [{ role: "user", content: "Cho tomorrow, and what can I book for?" }]);
    expect(answer.timing!.toolMs).toHaveLength(1);
    expect(answer.timing!.tools).toEqual(["list_open_slots", "list_visit_reasons"]);
    const second = JSON.parse(fetchMock.mock.calls[1]![1].body) as { input: { type: string; call_id?: string; name?: string }[] };
    const results = second.input.filter((item) => item.type === "function_result");
    expect(results.map((item) => item.call_id)).toEqual(["a", "b"]);
  });

  it("lets only the first proposed change wait when two arrive in one batch", async () => {
    process.env.XAI_API_KEY = "test-xai";
    const patient = await account("user-patient-demo");
    const open = await runTool(patient, "list_open_slots", { doctorId: "cho" });
    const [one, two] = open.slots!;
    const fetchMock = replying([
      {
        output: [
          { type: "function_call", name: "propose_book", call_id: "p1", arguments: JSON.stringify({ slotId: one!.id, reasonId: "follow" }) },
          { type: "function_call", name: "propose_book", call_id: "p2", arguments: JSON.stringify({ slotId: two!.id, reasonId: "follow" }) },
        ],
      },
      { output_text: "Confirm the first booking?" },
    ]);
    const answer = await askClinic(patient, [{ role: "user", content: "book both" }]);
    expect(answer.pending).not.toBeNull();
    const second = JSON.parse(fetchMock.mock.calls[1]![1].body) as { input: { type: string; call_id?: string; output?: string }[] };
    const p2 = second.input.find((item) => item.call_id === "p2" && item.type === "function_call_output");
    expect(p2?.output).toMatch(/Only one change can wait/);
  });

  it("asks Groq's gpt-oss for low reasoning effort", async () => {
    process.env.GROQ_API_KEY = "test-groq";
    const patient = await account("user-patient-demo");
    const fetchMock = replying([{ choices: [{ message: { role: "assistant", content: "Hello." } }] }]);
    await askClinic(patient, [{ role: "user", content: "hi" }]);
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body) as { reasoning_effort?: string };
    expect(body.reasoning_effort).toBe("low");
  });

  it("fails over quickly and records the failed provider", async () => {
    process.env.GEMINI_API_KEY = "test-gemini";
    process.env.GROQ_API_KEY = "test-groq";
    const patient = await account("user-patient-demo");
    const replies = [
      { ok: false, status: 429, body: { error: { message: "quota" } } },
      { ok: true, status: 200, body: { choices: [{ message: { role: "assistant", content: "Hi from the backup." } }] } },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        const next = replies.shift()!;
        return { ok: next.ok, status: next.status, text: async () => JSON.stringify(next.body) };
      }),
    );
    const answer = await askClinic(patient, [{ role: "user", content: "hi" }]);
    expect(answer.reply).toBe("Hi from the backup.");
    expect(answer.timing!.provider).toBe("groq");
    expect(answer.timing!.failed).toEqual([expect.objectContaining({ id: "gemini-1", status: 429 })]);
    expect(timingLine(answer.timing!)).toMatch(/^provider=groq failed=gemini-1:429:\d+ model=[\d+]+ tools=0 calls=- total=\d+$/);
  });

  it("picks the lowest thinking level each Gemini model accepts", () => {
    expect(geminiThinkingLevel("gemini-3.5-flash-lite")).toBe("minimal");
    expect(geminiThinkingLevel("gemini-3.1-flash-lite")).toBe("minimal");
    expect(geminiThinkingLevel("gemini-3.8-flash")).toBe("low");
    expect(geminiThinkingLevel("gemini-4-hydrogen")).toBe("low");
  });
});

describe("gemini settings fallback", () => {
  it("retries without generation_config when Gemini rejects it, and keeps it off afterwards", async () => {
    process.env.GEMINI_API_KEY = "test-gemini";
    const patient = await account("user-patient-demo");
    const bodies: Record<string, unknown>[] = [];
    const replies = [
      { ok: false, status: 400, body: { error: { message: "Unknown field generation_config" } } },
      { ok: true, status: 200, body: { output_text: "Hello." } },
      { ok: true, status: 200, body: { output_text: "Hello again." } },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: { body: string }) => {
        bodies.push(JSON.parse(init.body) as Record<string, unknown>);
        const next = replies.shift()!;
        return { ok: next.ok, status: next.status, text: async () => JSON.stringify(next.body) };
      }),
    );
    expect((await askClinic(patient, [{ role: "user", content: "hi" }])).reply).toBe("Hello.");
    expect((await askClinic(patient, [{ role: "user", content: "hi" }])).reply).toBe("Hello again.");
    expect(bodies.map((body) => "generation_config" in body)).toEqual([true, false, false]);
  });
});
