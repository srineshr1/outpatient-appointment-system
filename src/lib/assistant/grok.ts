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
}

type ModelAnswer = Omit<ClinicAnswer, "locale">;

function answer(reply: string, pending: PendingCard | null, slots: SlotLink[]): ModelAnswer {
  return { reply, pending, slots: pending ? [] : slots };
}

const ENDPOINT = "https://api.x.ai/v1/responses";
const MAX_STEPS = 4;

export function assistantModel(): string {
  if (process.env.GEMINI_API_KEY?.trim()) return process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash-lite";
  return process.env.XAI_MODEL?.trim() || "grok-4.3";
}

export function assistantConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim() || process.env.XAI_API_KEY?.trim());
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
      ? "When a tool returns open times, the app lists them under your reply, grouped by day, and each time opens the booking form for it. Do not list the times yourself. Say in one short sentence which doctor and days have times and that the user can tap a time to book it, or ask you to prepare the booking."
      : "When a tool returns open times, the app lists them under your reply, grouped by day. Do not list the times yourself. Summarise in one short sentence, for example how many are open and on which days.",
    ...(locked
      ? [
          `The user chose ${language.name} in the assistant's language menu. Always reply in ${language.name}, in that script, even when they write in another language. Do not switch languages and do not ask which language they want.`,
        ]
      : [
          "Automatically detect the language of the user's latest message and reply in that same language and script. Do not ask which language they want. Do not translate into English unless they wrote in English. Hinglish stays Hinglish in Latin script, Hindi stays in Devanagari, Telugu stays in Telugu script, and so on for every language. If the latest message is a short acknowledgement with no language of its own (ok, haan, जी), stay in the language already used in the conversation.",
          `The user's latest message appears to be in ${language.name}. If the message itself clearly says otherwise, follow the message.`,
        ]),
    "Be brief.",
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
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.XAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: assistantModel(),
      input,
      tools,
      store: false,
      max_output_tokens: 1200,
      parallel_tool_calls: true,
    }),
    signal: AbortSignal.timeout(25_000),
  });
  const raw = await response.text();
  let body: GrokBody;
  try {
    body = JSON.parse(raw) as GrokBody;
  } catch {
    throw new Error(`The assistant service returned an unreadable response (${response.status}).`);
  }
  if (!response.ok) {
    const message = body.error?.message?.slice(0, 240) || `The assistant service returned ${response.status}.`;
    throw new Error(message);
  }
  return body;
}

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";

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

async function completeGemini(input: unknown[], tools: ReturnType<typeof toolSpecs>, system: string): Promise<GeminiBody> {
  const response = await fetch(GEMINI_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": process.env.GEMINI_API_KEY ?? "",
    },
    body: JSON.stringify({
      model: assistantModel(),
      store: false,
      system_instruction: system,
      input,
      tools,
    }),
    signal: AbortSignal.timeout(25_000),
  });
  const raw = await response.text();
  let body: GeminiBody;
  try {
    body = JSON.parse(raw) as GeminiBody;
  } catch {
    throw new Error(`The assistant service returned an unreadable response (${response.status}).`);
  }
  if (!response.ok) {
    const message = body.error?.message?.slice(0, 240) || `The assistant service returned ${response.status}.`;
    throw new Error(message);
  }
  return body;
}

/** Gemini Interactions API. store:false so clinic details are not kept on Google. */
async function askGemini(
  user: PublicUser,
  history: { role: "user" | "assistant"; content: string }[],
  language: DetectedLanguage,
  locked = false,
): Promise<ModelAnswer> {
  const tools = toolSpecs(user);
  const system = systemPrompt(user, language, locked);
  let input: unknown[] = history.map((message) =>
    message.role === "user"
      ? { type: "user_input", content: [{ type: "text", text: message.content }] }
      : { type: "model_output", content: [{ type: "text", text: message.content }] },
  );
  let pending: PendingCard | null = null;
  let slots: SlotLink[] = [];

  for (let step = 0; step < MAX_STEPS; step += 1) {
    const body = await completeGemini(input, tools, system);
    const steps = body.steps ?? [];
    const calls = geminiCalls(steps);
    if (calls.length === 0) {
      return answer(geminiText(body) || "I couldn't put that into words. Please ask again.", pending, slots);
    }
    input = [...input, ...steps];
    for (const call of calls) {
      let args: unknown = {};
      if (typeof call.arguments === "string") {
        try {
          args = JSON.parse(call.arguments) as unknown;
        } catch {
          args = {};
        }
      } else if (call.arguments && typeof call.arguments === "object") {
        args = call.arguments;
      }
      let result: ToolResult;
      try {
        result = await runTool(user, call.name, args);
      } catch (error) {
        console.error(`[assistant] Tool ${call.name} failed: ${error instanceof Error ? error.message : "unknown error"}`);
        result = { forModel: { error: "That couldn't be read from the clinic book. Please try again." } };
      }
      let forModel = result.forModel;
      if (result.slots?.length) slots = mergeSlotLinks(slots, result.slots);
      if (result.pending) {
        if (!pending) pending = result.pending;
        else forModel = { error: "Only one change can wait for confirmation at a time. Ask the user about the first one." };
      }
      input.push({
        type: "function_result",
        name: call.name,
        call_id: call.callId,
        result: [{ type: "text", text: JSON.stringify(forModel).slice(0, 12_000) }],
      });
    }
  }
  return answer("I couldn't finish that in a few steps. Please ask for one thing at a time.", pending, slots);
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
  const result = await askModel(user, history, language, Boolean(locked));
  return { ...result, locale: locked ? locked.locale : replyLocale(result.reply, language) };
}

async function askModel(
  user: PublicUser,
  history: { role: "user" | "assistant"; content: string }[],
  language: DetectedLanguage,
  locked = false,
): Promise<ModelAnswer> {
  if (!assistantConfigured()) {
    throw new Error("The assistant is not configured. Set GEMINI_API_KEY or XAI_API_KEY on the server.");
  }
  if (process.env.GEMINI_API_KEY?.trim()) return askGemini(user, history, language, locked);
  const tools = toolSpecs(user);
  let input: unknown[] = [{ role: "system", content: systemPrompt(user, language, locked) }, ...history];
  let pending: PendingCard | null = null;
  let slots: SlotLink[] = [];

  for (let step = 0; step < MAX_STEPS; step += 1) {
    const body = await complete(input, tools);
    const calls = callsOf(body.output ?? []);
    if (calls.length === 0) {
      return answer(textOf(body) || "I couldn't put that into words. Please ask again.", pending, slots);
    }
    input = [...input, ...(body.output ?? [])];
    for (const call of calls) {
      let args: unknown = {};
      if (typeof call.arguments === "string") {
        try {
          args = JSON.parse(call.arguments) as unknown;
        } catch {
          args = {};
        }
      } else if (call.arguments && typeof call.arguments === "object") {
        args = call.arguments;
      }
      let result: ToolResult;
      try {
        result = await runTool(user, call.name, args);
      } catch (error) {
        console.error(`[assistant] Tool ${call.name} failed: ${error instanceof Error ? error.message : "unknown error"}`);
        result = { forModel: { error: "That couldn't be read from the clinic book. Please try again." } };
      }
      let forModel = result.forModel;
      if (result.slots?.length) slots = mergeSlotLinks(slots, result.slots);
      if (result.pending) {
        if (!pending) pending = result.pending;
        else forModel = { error: "Only one change can wait for confirmation at a time. Ask the user about the first one." };
      }
      input.push({ type: "function_call_output", call_id: call.callId, output: JSON.stringify(forModel).slice(0, 12_000) });
    }
  }
  return answer("I couldn't finish that in a few steps. Please ask for one thing at a time.", pending, slots);
}
