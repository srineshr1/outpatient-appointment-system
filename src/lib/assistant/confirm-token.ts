/**
 * A booking, cancellation, reschedule or payment is sealed into a short-lived token.
 * The browser can show it and send it back, but it cannot change what was sealed:
 * the signature covers the action, and the token only works for the account that asked.
 */
import type { PublicUser } from "../clinic-types";

const TEN_MINUTES_MS = 10 * 60 * 1000;

export type PendingAction =
  | { type: "book"; slotId: string; reasonId: string; payOnline: boolean; note: string }
  | { type: "cancel"; visitId: string }
  | { type: "reschedule"; visitId: string; slotId: string; reason: string }
  | { type: "pay"; visitId: string };

export interface PendingCard {
  token: string;
  title: string;
  summary: string;
  confirmLabel: string;
  expiresAt: string;
}

interface Sealed {
  v: 1;
  jti: string;
  uid: string;
  exp: number;
  title: string;
  summary: string;
  confirmLabel: string;
  action: PendingAction;
}

export type VerifiedPending =
  | { ok: true; sealed: Sealed }
  | { ok: false; reason: "bad" | "expired" | "forbidden" };

const claimed = new Map<string, number>();
let devSecret: string | null = null;

function signingSecret(): string {
  const dedicated = process.env.ASSISTANT_TOKEN_SECRET?.trim();
  if (dedicated) return dedicated;
  const auth = process.env.AUTH_SECRET?.trim();
  if (auth) return auth;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET is not set, so the assistant cannot confirm a change.");
  }
  return (devSecret ??= crypto.randomUUID());
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlToBytes(value: string): Uint8Array | null {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - (value.length % 4)) % 4);
  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

async function hmac(value: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(signingSecret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(mac));
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function sweep(nowMs: number): void {
  if (claimed.size < 200) return;
  for (const [jti, exp] of claimed) {
    if (exp <= nowMs) claimed.delete(jti);
  }
}

/** Forget used confirmations. Tests call this so one file does not affect the next. */
export function resetConfirmationsForTests(): void {
  claimed.clear();
  devSecret = null;
}

export async function issueConfirmation(
  user: Pick<PublicUser, "id">,
  action: PendingAction,
  card: { title: string; summary: string; confirmLabel: string },
  exp = Date.now() + TEN_MINUTES_MS,
): Promise<PendingCard> {
  const sealed: Sealed = {
    v: 1,
    jti: crypto.randomUUID(),
    uid: user.id,
    exp,
    title: card.title,
    summary: card.summary,
    confirmLabel: card.confirmLabel,
    action,
  };
  const body = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(sealed)));
  const token = `${body}.${await hmac(body)}`;
  return { token, title: card.title, summary: card.summary, confirmLabel: card.confirmLabel, expiresAt: new Date(exp).toISOString() };
}

export async function verifyConfirmation(token: string, userId: string, nowMs = Date.now()): Promise<VerifiedPending> {
  const dot = token.indexOf(".");
  if (dot <= 0) return { ok: false, reason: "bad" };
  const body = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  let expected: string;
  try {
    expected = await hmac(body);
  } catch {
    return { ok: false, reason: "bad" };
  }
  if (!safeEqual(mac, expected)) return { ok: false, reason: "bad" };
  const raw = base64UrlToBytes(body);
  if (!raw) return { ok: false, reason: "bad" };
  let sealed: Sealed;
  try {
    sealed = JSON.parse(new TextDecoder().decode(raw)) as Sealed;
  } catch {
    return { ok: false, reason: "bad" };
  }
  if (sealed?.v !== 1 || typeof sealed.jti !== "string" || typeof sealed.uid !== "string" || typeof sealed.exp !== "number" || !sealed.action) {
    return { ok: false, reason: "bad" };
  }
  if (sealed.uid !== userId) return { ok: false, reason: "forbidden" };
  if (sealed.exp <= nowMs) return { ok: false, reason: "expired" };
  return { ok: true, sealed };
}

/**
 * A confirmation can be used once. Called synchronously before any booking work,
 * so two clicks cannot both pass.
 */
export function claimConfirmation(jti: string, exp: number, nowMs = Date.now()): boolean {
  sweep(nowMs);
  if (claimed.has(jti)) return false;
  claimed.set(jti, exp);
  return true;
}

export function cardFromSealed(token: string, sealed: Sealed): PendingCard {
  return {
    token,
    title: sealed.title,
    summary: sealed.summary,
    confirmLabel: sealed.confirmLabel,
    expiresAt: new Date(sealed.exp).toISOString(),
  };
}
