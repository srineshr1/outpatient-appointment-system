/**
 * Talks to the xAI Responses API (OpenAI-compatible) with store:false, so clinic details
 * are not kept on the provider for 30 days. The key stays on the server.
 */
import type { PublicUser } from "../clinic-types";
import { practice } from "../data";
import { weekdayLong } from "../format";
import { todayIso, now } from "../clock";
import type { PendingCard } from "./confirm-token";
import { detectConversation, ownLanguage, type DetectedLanguage } from "./language";
import { mergeSlotLinks, type SlotLink } from "./slot-links";
import { runTool, toolSpecs, type ToolResult } from "./tools";

export interface ClinicAnswer {
  reply: string;
  pending: PendingCard | null;
  /** Open times the tools returned this turn. Dropped when a change is waiting for confirmation. */
  slots: SlotLink[];
  /** BCP 47 locale the reply is written in, for the dock's voice (e.g. "te-IN"). */
  locale: string;
  /** Where the turn's time went. Logged and sent as a Server-Timing header, never to the model. */
  timing?: TurnTiming;
}

export interface TurnTiming {
  /** Provider that answered, or "" when none did. */
  provider: string;
  /** Providers that failed first, with how long each took. */
  failed: { id: string; status: number; ms: number }[];
  /** Each model round trip, in order. */
  modelMs: number[];
  /** Each batch of tool calls (run in parallel), in order. */
  toolMs: number[];
  tools: string[];
  totalMs: number;
}

function newTiming(): TurnTiming {
  return { provider: "", failed: [], modelMs: [], toolMs: [], tools: [], totalMs: 0 };
}

type ModelAnswer = Omit<ClinicAnswer, "locale" | "timing">;

function answer(reply: string, pending: PendingCard | null, slots: SlotLink[]): ModelAnswer {
  return { reply, pending, slots: pending ? [] : slots };
}

const ENDPOINT = "https://api.x.ai/v1/responses";
const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";
const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const MAX_STEPS = 4;
/**
 * One model call. A healthy call with minimal thinking takes 1–3 s, so a stuck provider is cut
 * off early and the next one gets the turn instead of the user waiting 15 s or more.
 */
const CALL_TIMEOUT_MS = 8_000;
/** Stop starting another provider once the turn has already used this much time. */
const FAILOVER_BUDGET_MS = 18_000;
const COOL_MS = 2 * 60_000;
export const ASSISTANT_BUSY = "The assistant is busy. Please try again in a moment.";

const cooledUntil = new Map<string, number>();

export function resetProviderChainForTests(): void {
  cooledUntil.clear();
  geminiConfigRejected = false;
}

function geminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash-lite";
}

/** Lowest thinking each Gemini model accepts: "minimal" where supported, else "low". */
export function geminiThinkingLevel(model: string): "minimal" | "low" {
  return /flash-lite|3\.6-flash|3-flash/.test(model) && !/^gemini-4/.test(model) ? "minimal" : "low";
}

function groqModel(): string {
  return process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-120b";
}

function xaiModel(): string {
  return process.env.XAI_MODEL?.trim() || "grok-4.3";
}

export function assistantModel(): string {
  if (process.env.GEMINI_API_KEY?.trim() || process.env.GEMINI_API_KEY_2?.trim()) return geminiModel();
  if (process.env.GROQ_API_KEY?.trim()) return groqModel();
  return xaiModel();
}

export function assistantConfigured(): boolean {
  return Boolean(
    process.env.GEMINI_API_KEY?.trim() ||
      process.env.GEMINI_API_KEY_2?.trim() ||
      process.env.GROQ_API_KEY?.trim() ||
      process.env.XAI_API_KEY?.trim(),
  );
}

class ProviderError extends Error {
  readonly status: number;
  readonly failover: boolean;

  constructor(status: number, failover: boolean) {
    super(ASSISTANT_BUSY);
    this.name = "ProviderError";
    this.status = status;
    this.failover = failover;
  }
}

/** Quota, auth, and outage failures are worth trying the next account. A 400 is our request. */
function canFailover(status: number): boolean {
  return status === 401 || status === 403 || status === 408 || status === 429 || status >= 500;
}

function cooling(id: string, nowMs: number): boolean {
  const until = cooledUntil.get(id) ?? 0;
  if (until <= nowMs) {
    cooledUntil.delete(id);
    return false;
  }
  return true;
}

function cool(id: string, nowMs: number): void {
  cooledUntil.set(id, nowMs + COOL_MS);
}

async function postProvider(url: string, headers: Record<string, string>, payload: unknown): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
    });
  } catch {
    throw new ProviderError(0, true);
  }
  const raw = await response.text();
  let body: unknown;
  try {
    body = raw ? (JSON.parse(raw) as unknown) : {};
  } catch {
    throw new ProviderError(response.status || 502, canFailover(response.status));
  }
  if (!response.ok) throw new ProviderError(response.status, canFailover(response.status));
  return body;
}

function systemPrompt(user: PublicUser, language: DetectedLanguage, locked = false): string {
  const today = todayIso(now());
  return [
    `You are the clinic assistant for ${practice.name}. Today is ${weekdayLong(today)} ${today}, clinic time Asia/Kolkata.`,
    `The signed-in user is ${user.name}, a ${user.role}.`,
    "Use the tools for every fact about appointments, doctors, times, fees and refunds. If a tool returns no rows, say so. Never invent a time, a name, a fee, a medicine or a refund.",
    "You cannot book, cancel, reschedule, take payment, or add or change a consulting session yourself. Those tools only prepare a confirmation. Tell the user what will happen and ask them to confirm with the buttons or a clear yes. Do not say an action is done.",
    user.role === "doctor"
      ? "When a doctor asks about their schedule, their day, or today, call list_appointments for that date. It returns the consulting sessions and the visits. Tell them each session (time, stream or wave, places booked of total) and each visit (time, patient, reason). If a session runs but no one is booked, say the session is on and no one is booked yet. Never say the schedule is empty or that there is nothing on while a session runs or a visit is booked. " +
        "A doctor can ask you to add a consulting session (stream or wave) or change one: use propose_add_session or propose_update_session. Add a one-off session unless they ask for a weekly one. If no room is given, the usual room is used. Removing a session is done on the Schedule page."
      : "Patients cannot add or change consulting sessions.",
    "Prescriptions are not stored. Leave is not stored: a day with no consulting session is a day out of clinic.",
    "Do not reveal dates of birth, phone numbers, CHI numbers, or another person's visits. A doctor may use the patient names the tools return for their own book.",
    "Do not read out slot ids or confirmation tokens.",
    user.role === "patient"
      ? "When the user asks what is free or open without naming a doctor, call list_open_slots once without doctorId (it covers every doctor) and do not search doctors first. When a tool returns open times, the app lists them under your reply, grouped by day, and each time opens the booking form for it. Do not list the times yourself. Say in one short sentence which doctors and days have times and that the user can tap a time to book it, or ask you to prepare the booking."
      : "When a tool returns open times, the app lists them under your reply, grouped by day. Do not list the times yourself. Summarise in one short sentence, for example how many are open and on which days.",
    ...(locked
      ? [
          `The user chose ${language.name} in the assistant's language menu. Always reply in ${language.name}, in that script, even when they write in another language. Do not switch languages and do not ask which language they want.`,
        ]
      : [
          "Automatically detect the language of the user's latest message and reply in that same language and script. Do not ask which language they want. Do not translate into English unless they wrote in English. Hinglish stays Hinglish in Latin script, Hindi stays in Devanagari, Telugu stays in Telugu script, and so on for every language. If the latest message is a short acknowledgement with no language of its own (ok, haan, जी), stay in the language already used in the conversation.",
          `The user's latest message appears to be in ${language.name}. If the message itself clearly says otherwise, follow the message.`,
        ]),
    "You may use simple markdown (**bold**, bullet lists). Keep replies short.",
  ].join(" ");
}

interface GrokBody {
  output_text?: string;
  output?: Array<Record<string, unknown>>;
  error?: { message?: string };
}

function textOf(body: GrokBody): string {
  if (typeof body.output_text === "string" && body.output_text.trim()) return body.output_text.trim();
  const parts: string[] = [];
  for (const item of body.output ?? []) {
    if (item.type !== "message" || !Array.isArray(item.content)) continue;
    for (const part of item.content) {
      if (part && typeof part === "object" && "text" in part && typeof (part as { text?: unknown }).text === "string") {
        parts.push((part as { text: string }).text);
      }
    }
  }
  return parts.join("\n").trim();
}

function callsOf(output: Array<Record<string, unknown>>) {
  const calls: { name: string; callId: string; arguments: unknown }[] = [];
  for (const item of output) {
    if (item.type !== "function_call") continue;
    const name = typeof item.name === "string" ? item.name : "";
    const callId = typeof item.call_id === "string" ? item.call_id : "";
    if (!name || !callId) continue;
    calls.push({ name, callId, arguments: item.arguments });
  }
  return calls;
}

async function complete(input: unknown[], tools: ReturnType<typeof toolSpecs>): Promise<GrokBody> {
  return (await postProvider(
    ENDPOINT,
    { authorization: `Bearer ${process.env.XAI_API_KEY ?? ""}` },
    {
      model: xaiModel(),
      input,
      tools,
      store: false,
      max_output_tokens: 1200,
      parallel_tool_calls: true,
    },
  )) as GrokBody;
}

interface GeminiBody {
  output_text?: string;
  steps?: Array<Record<string, unknown>>;
  error?: { message?: string };
}

function geminiText(body: GeminiBody): string {
  if (typeof body.output_text === "string" && body.output_text.trim()) return body.output_text.trim();
  const parts: string[] = [];
  for (const step of body.steps ?? []) {
    if (step.type !== "model_output") continue;
    const content = step.content;
    if (typeof content === "string") parts.push(content);
    else if (Array.isArray(content)) {
      for (const part of content) {
        if (part && typeof part === "object" && "text" in part && typeof (part as { text?: unknown }).text === "string") {
          parts.push((part as { text: string }).text);
        }
      }
    }
  }
  return parts.join("\n").trim();
}

function geminiCalls(steps: Array<Record<string, unknown>>) {
  const calls: { name: string; callId: string; arguments: unknown }[] = [];
  for (const step of steps) {
    if (step.type !== "function_call") continue;
    const name = typeof step.name === "string" ? step.name : "";
    const callId = typeof step.id === "string" ? step.id : "";
    if (!name || !callId) continue;
    calls.push({ name, callId, arguments: step.arguments });
  }
  return calls;
}

/** Set when Gemini rejects generation_config (a 400), so later turns send the plain request. */
let geminiConfigRejected = false;

async function completeGemini(input: unknown[], tools: ReturnType<typeof toolSpecs>, system: string, apiKey: string): Promise<GeminiBody> {
  const base = { model: geminiModel(), store: false, system_instruction: system, input, tools };
  const post = (payload: unknown) => postProvider(GEMINI_ENDPOINT, { "x-goog-api-key": apiKey }, payload) as Promise<GeminiBody>;
  if (geminiConfigRejected) return post(base);
  try {
    return await post({
      ...base,
      generation_config: { thinking_level: geminiThinkingLevel(geminiModel()), max_output_tokens: 1200 },
    });
  } catch (error) {
    // A model that doesn't take these settings still answers without them.
    if (!(error instanceof ProviderError) || error.status !== 400) throw error;
    geminiConfigRejected = true;
    console.error("[assistant] Gemini rejected generation_config; sending without it");
    return post(base);
  }
}

interface GroqToolCall {
  id?: string;
  function?: { name?: string; arguments?: string };
}

interface GroqMessage {
  role?: string;
  content?: string | null;
  tool_calls?: GroqToolCall[];
}

interface GroqBody {
  choices?: Array<{ message?: GroqMessage }>;
}

function groqTools(tools: ReturnType<typeof toolSpecs>) {
  return tools.map((tool) => ({
    type: "function",
    function: { name: tool.name, description: tool.description, parameters: tool.parameters },
  }));
}

async function completeGroq(messages: unknown[], tools: ReturnType<typeof toolSpecs>): Promise<GroqBody> {
  return (await postProvider(
    GROQ_ENDPOINT,
    { authorization: `Bearer ${process.env.GROQ_API_KEY ?? ""}` },
    {
      model: groqModel(),
      messages,
      tools: groqTools(tools),
      tool_choice: "auto",
      parallel_tool_calls: true,
      max_tokens: 1200,
      // gpt-oss reasons before answering; a short reply about the clinic book needs little.
      ...(/gpt-oss/.test(groqModel()) ? { reasoning_effort: "low" } : {}),
    },
  )) as GroqBody;
}

interface ToolState {
  pending: PendingCard | null;
  slots: SlotLink[];
}

function parseArgs(rawArgs: unknown): unknown {
  if (typeof rawArgs === "string") {
    try {
      return JSON.parse(rawArgs) as unknown;
    } catch {
      return {};
    }
  }
  return rawArgs && typeof rawArgs === "object" ? rawArgs : {};
}

/** Run one tool call. A tool failure becomes a message for the model, not a failed turn. */
async function runCall(user: PublicUser, name: string, rawArgs: unknown): Promise<ToolResult> {
  try {
    return await runTool(user, name, parseArgs(rawArgs));
  } catch (error) {
    console.error(`[assistant] Tool ${name} failed: ${error instanceof Error ? error.message : "unknown error"}`);
    return { forModel: { error: "That couldn't be read from the clinic book. Please try again." } };
  }
}

/**
 * Run one step's tool calls together (reads of the clinic book don't depend on each other),
 * then fold the results into the turn in the order the model asked for them, so only the
 * first proposed change waits for confirmation.
 */
async function applyCalls(
  user: PublicUser,
  calls: { name: string; arguments: unknown }[],
  state: ToolState,
  timing: TurnTiming,
): Promise<unknown[]> {
  const started = Date.now();
  const results = await Promise.all(calls.map((call) => runCall(user, call.name, call.arguments)));
  timing.toolMs.push(Date.now() - started);
  timing.tools.push(...calls.map((call) => call.name));
  return results.map((result) => {
    let forModel = result.forModel;
    if (result.slots?.length) state.slots = mergeSlotLinks(state.slots, result.slots);
    if (result.pending) {
      if (!state.pending) state.pending = result.pending;
      else forModel = { error: "Only one change can wait for confirmation at a time. Ask the user about the first one." };
    }
    return forModel;
  });
}

async function timed<T>(timing: TurnTiming, work: () => Promise<T>): Promise<T> {
  const started = Date.now();
  try {
    return await work();
  } finally {
    timing.modelMs.push(Date.now() - started);
  }
}

/** Gemini Interactions API. store:false so clinic details are not kept on Google. */
async function askGemini(
  user: PublicUser,
  history: { role: "user" | "assistant"; content: string }[],
  language: DetectedLanguage,
  locked: boolean,
  apiKey: string,
  timing: TurnTiming,
): Promise<ModelAnswer> {
  const tools = toolSpecs(user);
  const system = systemPrompt(user, language, locked);
  let input: unknown[] = history.map((message) =>
    message.role === "user"
      ? { type: "user_input", content: [{ type: "text", text: message.content }] }
      : { type: "model_output", content: [{ type: "text", text: message.content }] },
  );
  const state: ToolState = { pending: null, slots: [] };

  for (let step = 0; step < MAX_STEPS; step += 1) {
    const body = await timed(timing, () => completeGemini(input, tools, system, apiKey));
    const steps = body.steps ?? [];
    const calls = geminiCalls(steps);
    if (calls.length === 0) {
      return answer(geminiText(body) || "I couldn't put that into words. Please ask again.", state.pending, state.slots);
    }
    input = [...input, ...steps];
    const outputs = await applyCalls(user, calls, state, timing);
    calls.forEach((call, index) => {
      input.push({
        type: "function_result",
        name: call.name,
        call_id: call.callId,
        result: [{ type: "text", text: JSON.stringify(outputs[index]).slice(0, 12_000) }],
      });
    });
  }
  return answer("I couldn't finish that in a few steps. Please ask for one thing at a time.", state.pending, state.slots);
}

/** Groq's OpenAI-compatible chat completions. Tool results are not stored on our side. */
async function askGroq(
  user: PublicUser,
  history: { role: "user" | "assistant"; content: string }[],
  language: DetectedLanguage,
  locked: boolean,
  timing: TurnTiming,
): Promise<ModelAnswer> {
  const tools = toolSpecs(user);
  let messages: unknown[] = [{ role: "system", content: systemPrompt(user, language, locked) }, ...history];
  const state: ToolState = { pending: null, slots: [] };

  for (let step = 0; step < MAX_STEPS; step += 1) {
    const body = await timed(timing, () => completeGroq(messages, tools));
    const message = body.choices?.[0]?.message;
    const calls = (message?.tool_calls ?? []).filter((call) => call.id && call.function?.name);
    const text = typeof message?.content === "string" ? message.content.trim() : "";
    if (calls.length === 0) {
      return answer(text || "I couldn't put that into words. Please ask again.", state.pending, state.slots);
    }
    messages = [...messages, message];
    const outputs = await applyCalls(
      user,
      calls.map((call) => ({ name: call.function?.name ?? "", arguments: call.function?.arguments })),
      state,
      timing,
    );
    calls.forEach((call, index) => {
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(outputs[index]).slice(0, 12_000) });
    });
  }
  return answer("I couldn't finish that in a few steps. Please ask for one thing at a time.", state.pending, state.slots);
}

async function askXai(
  user: PublicUser,
  history: { role: "user" | "assistant"; content: string }[],
  language: DetectedLanguage,
  locked: boolean,
  timing: TurnTiming,
): Promise<ModelAnswer> {
  const tools = toolSpecs(user);
  let input: unknown[] = [{ role: "system", content: systemPrompt(user, language, locked) }, ...history];
  const state: ToolState = { pending: null, slots: [] };

  for (let step = 0; step < MAX_STEPS; step += 1) {
    const body = await timed(timing, () => complete(input, tools));
    const calls = callsOf(body.output ?? []);
    if (calls.length === 0) {
      return answer(textOf(body) || "I couldn't put that into words. Please ask again.", state.pending, state.slots);
    }
    input = [...input, ...(body.output ?? [])];
    const outputs = await applyCalls(user, calls, state, timing);
    calls.forEach((call, index) => {
      input.push({ type: "function_call_output", call_id: call.callId, output: JSON.stringify(outputs[index]).slice(0, 12_000) });
    });
  }
  return answer("I couldn't finish that in a few steps. Please ask for one thing at a time.", state.pending, state.slots);
}

/**
 * The locale to speak a reply in: the reply's own script or words when they are clear, so the
 * voice matches what is actually said, else the language of the user's message.
 */
export function replyLocale(reply: string, language: DetectedLanguage): string {
  return ownLanguage(reply, language.tag)?.locale ?? language.locale;
}

/**
 * Answer the latest message. With a language locked in the dock's menu the reply is always in
 * that language (and spoken in its locale); otherwise the conversation's language is detected.
 */
export async function askClinic(
  user: PublicUser,
  history: { role: "user" | "assistant"; content: string }[],
  locked: DetectedLanguage | null = null,
): Promise<ClinicAnswer> {
  const language = locked ?? detectConversation(history);
  const timing = newTiming();
  const started = Date.now();
  try {
    const result = await askModel(user, history, language, Boolean(locked), timing);
    return { ...result, locale: locked ? locked.locale : replyLocale(result.reply, language), timing };
  } finally {
    timing.totalMs = Date.now() - started;
    console.info(`[assistant] timing ${timingLine(timing)}`);
  }
}

/** One short log line: provider, failed providers, model and tool times in ms. */
export function timingLine(timing: TurnTiming): string {
  const failed = timing.failed.map((item) => `${item.id}:${item.status}:${item.ms}`).join(",") || "-";
  return `provider=${timing.provider || "none"} failed=${failed} model=${timing.modelMs.join("+") || 0} tools=${timing.toolMs.join("+") || 0} calls=${timing.tools.join(",") || "-"} total=${timing.totalMs}`;
}

async function askModel(
  user: PublicUser,
  history: { role: "user" | "assistant"; content: string }[],
  language: DetectedLanguage,
  locked = false,
  timing: TurnTiming = newTiming(),
): Promise<ModelAnswer> {
  const chain: { id: string; run: () => Promise<ModelAnswer> }[] = [];
  const first = process.env.GEMINI_API_KEY?.trim();
  const second = process.env.GEMINI_API_KEY_2?.trim();
  if (first) chain.push({ id: "gemini-1", run: () => askGemini(user, history, language, locked, first, timing) });
  if (second) chain.push({ id: "gemini-2", run: () => askGemini(user, history, language, locked, second, timing) });
  if (process.env.GROQ_API_KEY?.trim()) chain.push({ id: "groq", run: () => askGroq(user, history, language, locked, timing) });
  if (process.env.XAI_API_KEY?.trim()) chain.push({ id: "xai", run: () => askXai(user, history, language, locked, timing) });
  if (chain.length === 0) {
    throw new Error("The assistant is not configured. Set GEMINI_API_KEY, GROQ_API_KEY, or XAI_API_KEY on the server.");
  }

  const started = Date.now();
  for (const provider of chain) {
    const nowMs = Date.now();
    if (cooling(provider.id, nowMs)) continue;
    if (nowMs - started > FAILOVER_BUDGET_MS) break;
    try {
      const result = await provider.run();
      timing.provider = provider.id;
      return result;
    } catch (error) {
      const status = error instanceof ProviderError ? error.status : 0;
      const failover = error instanceof ProviderError && error.failover;
      timing.failed.push({ id: provider.id, status, ms: Date.now() - nowMs });
      console.error(`[assistant] ${provider.id} failed status=${status} after ${Date.now() - nowMs}ms`);
      if (!failover) throw new Error(ASSISTANT_BUSY);
      cool(provider.id, nowMs);
    }
  }
  throw new Error(ASSISTANT_BUSY);
}
