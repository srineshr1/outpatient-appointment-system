import type { PublicUser } from "../clinic-types";
import { todayIso } from "../clock";
import { confirmPending, rejectPending, restoreCard } from "./act";
import type { PendingCard } from "./confirm-token";
import { askClinic, replyLocale, resetProviderChainForTests } from "./grok";
import { interpretReply } from "./intent";
import { DEFAULT_LANGUAGE, detectConversation, type DetectedLanguage } from "./language";
import type { SlotLink } from "./slot-links";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface TurnResult {
  reply: string;
  pending: PendingCard | null;
  payUrl?: string;
  /** Open times to show under the reply, grouped by day in the dock. */
  slots?: SlotLink[];
  /** BCP 47 locale of the reply (e.g. "hi-IN"), so the dock listens and speaks in it. */
  locale: string;
}

const hits = new Map<string, number[]>();

export function allowTurn(userId: string, limit = 20, windowMs = 60_000, nowMs = Date.now()): boolean {
  const recent = (hits.get(userId) ?? []).filter((at) => nowMs - at < windowMs);
  if (recent.length >= limit) {
    hits.set(userId, recent);
    return false;
  }
  recent.push(nowMs);
  hits.set(userId, recent);
  return true;
}

const MODEL_MINUTE = 8;
const MODEL_DAY = 60;
const GLOBAL_MINUTE = 40;
const MINUTE_MS = 60_000;
const MINUTE_MESSAGE = "Too many requests. Wait a minute and try again.";
const DAY_MESSAGE = "You've reached today's assistant limit. Try again tomorrow.";
const IN_FLIGHT_MESSAGE = "A reply is already in progress.";

interface ModelBucket {
  day: string;
  dayCount: number;
  minute: number[];
}

const modelHits = new Map<string, ModelBucket>();
const inFlight = new Set<string>();
let globalMinute: number[] = [];

export function resetTurnsForTests(): void {
  hits.clear();
  modelHits.clear();
  inFlight.clear();
  globalMinute = [];
  resetProviderChainForTests();
}

function freshMinute(times: number[], nowMs: number): number[] {
  return times.filter((at) => nowMs - at < MINUTE_MS);
}

export type ModelTurn =
  | { ok: true }
  | { ok: false; message: string };

/**
 * One model turn for a signed-in user. Confirm clicks use allowTurn and do not spend this.
 * Counters live in this server process.
 */
export function beginModelTurn(userId: string, nowMs = Date.now()): ModelTurn {
  if (inFlight.has(userId)) return { ok: false, message: IN_FLIGHT_MESSAGE };
  const day = todayIso(new Date(nowMs));
  const bucket = modelHits.get(userId) ?? { day, dayCount: 0, minute: [] };
  if (bucket.day !== day) {
    bucket.day = day;
    bucket.dayCount = 0;
  }
  const minute = freshMinute(bucket.minute, nowMs);
  bucket.minute = minute;
  modelHits.set(userId, bucket);
  if (bucket.dayCount >= MODEL_DAY) return { ok: false, message: DAY_MESSAGE };
  if (minute.length >= MODEL_MINUTE) return { ok: false, message: MINUTE_MESSAGE };
  const global = freshMinute(globalMinute, nowMs);
  if (global.length >= GLOBAL_MINUTE) {
    globalMinute = global;
    return { ok: false, message: MINUTE_MESSAGE };
  }
  minute.push(nowMs);
  bucket.dayCount += 1;
  globalMinute = [...global, nowMs];
  inFlight.add(userId);
  return { ok: true };
}

export function endModelTurn(userId: string): void {
  inFlight.delete(userId);
}

export const ASSISTANT_MAX_BYTES = 24 * 1024;

export type AssistantBody =
  | { ok: true; value: unknown }
  | { ok: false; status: number; message: string };

function originAllowed(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  let sent: URL;
  try {
    sent = new URL(origin);
  } catch {
    return false;
  }
  if (sent.origin === new URL(request.url).origin) return true;
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!configured) return false;
  try {
    return sent.origin === new URL(configured).origin;
  } catch {
    return false;
  }
}

/** Size and same-site checks before the body is parsed. Missing Origin is allowed. */
export async function readAssistantJson(request: Request): Promise<AssistantBody> {
  const declared = request.headers.get("content-length");
  if (declared && Number(declared) > ASSISTANT_MAX_BYTES) {
    return { ok: false, status: 413, message: "That message is too large." };
  }
  if (!originAllowed(request)) {
    return { ok: false, status: 403, message: "The assistant is only available on this site." };
  }
  let text: string;
  try {
    text = await request.text();
  } catch {
    return { ok: false, status: 400, message: "Send a JSON message." };
  }
  if (text.length > ASSISTANT_MAX_BYTES) {
    return { ok: false, status: 413, message: "That message is too large." };
  }
  try {
    return { ok: true, value: text ? (JSON.parse(text) as unknown) : {} };
  } catch {
    return { ok: false, status: 400, message: "Send a JSON message." };
  }
}

export function parseMessages(input: unknown): ChatMessage[] | null {
  if (!Array.isArray(input)) return null;
  const messages: ChatMessage[] = [];
  for (const item of input.slice(-10)) {
    if (!item || typeof item !== "object") return null;
    const role = (item as { role?: unknown }).role;
    const content = (item as { content?: unknown }).content;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") return null;
    const text = content.trim().slice(0, 2000);
    if (!text) continue;
    messages.push({ role, content: text });
  }
  return messages;
}

export async function handleTurn(
  user: PublicUser,
  messages: ChatMessage[],
  pendingToken: string | null,
  /** A language the user locked in the dock's menu; null keeps automatic detection. */
  locked: DetectedLanguage | null = null,
): Promise<TurnResult> {
  const last = [...messages].reverse().find((message) => message.role === "user");
  if (!last) return { reply: "Ask me about a visit, a doctor, or a time.", pending: null, locale: DEFAULT_LANGUAGE.locale };

  if (pendingToken) {
    const intent = interpretReply(last.content);
    if (intent !== "chat") {
      const outcome = intent === "confirm" ? await confirmPending(user, pendingToken) : await rejectPending(user, pendingToken);
      // Summaries are in English for now; speak them in the language they are written in.
      const locale = locked ? locked.locale : replyLocale(outcome.summary, detectConversation(messages));
      return { reply: outcome.summary, pending: null, locale, ...(intent === "confirm" && outcome.payUrl ? { payUrl: outcome.payUrl } : {}) };
    }
  }

  const asked = await askClinic(user, messages, locked);
  const pending = asked.pending ?? (pendingToken ? await restoreCard(user, pendingToken) : null);
  return { reply: asked.reply, pending, locale: asked.locale, ...(asked.slots.length ? { slots: asked.slots } : {}) };
}
