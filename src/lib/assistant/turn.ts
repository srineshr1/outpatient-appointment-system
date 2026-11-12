import type { PublicUser } from "../clinic-types";
import { confirmPending, rejectPending, restoreCard } from "./act";
import type { PendingCard } from "./confirm-token";
import { askClinic } from "./grok";
import { interpretReply } from "./intent";
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

export function resetTurnsForTests(): void {
  hits.clear();
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

export async function handleTurn(user: PublicUser, messages: ChatMessage[], pendingToken: string | null): Promise<TurnResult> {
  const last = [...messages].reverse().find((message) => message.role === "user");
  if (!last) return { reply: "Ask me about a visit, a doctor, or a time.", pending: null };

  if (pendingToken) {
    const intent = interpretReply(last.content);
    if (intent === "confirm") {
      const outcome = await confirmPending(user, pendingToken);
      return { reply: outcome.summary, pending: null, ...(outcome.payUrl ? { payUrl: outcome.payUrl } : {}) };
    }
    if (intent === "reject") {
      const outcome = await rejectPending(user, pendingToken);
      return { reply: outcome.summary, pending: null };
    }
  }

  const asked = await askClinic(user, messages);
  const pending = asked.pending ?? (pendingToken ? await restoreCard(user, pendingToken) : null);
  return { reply: asked.reply, pending, ...(asked.slots.length ? { slots: asked.slots } : {}) };
}
