/**
 * Email sign-in codes. CODE_LENGTH digits, valid for ten minutes, five tries, one new code a minute.
 * Only an HMAC of the code is stored, keyed by the email, so a leaked row can't be replayed elsewhere.
 */
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import type { LoginCodeRecord } from "./clinic-types";
import { hashToken, newToken, normaliseEmail } from "./passwords";
import { getStore } from "./store";

export { CODE_LENGTH } from "./sign-in-config";
import { CODE_LENGTH } from "./sign-in-config";
export const CODE_TTL_MS = 10 * 60 * 1000;
export const RESEND_AFTER_MS = 60 * 1000;
export const MAX_ATTEMPTS = 5;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmail(value: string): boolean {
  const email = normaliseEmail(value);
  return email.length <= 200 && EMAIL_PATTERN.test(email);
}

function secret(): string {
  return process.env.AUTH_SECRET ?? "halden-dev-only-secret";
}

function hashCode(email: string, code: string): string {
  return createHmac("sha256", secret()).update(`${email}:${code}`).digest("base64url");
}

function sameHash(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export type IssueResult = { ok: true; code: string } | { ok: false; reason: "throttled"; retryInMs: number };

/** Make a new code for `email`, replacing any earlier one. */
export async function issueCode(rawEmail: string, at = new Date(), throttle = true): Promise<IssueResult> {
  const email = normaliseEmail(rawEmail);
  const store = await getStore();
  const existing = await store.getLoginCode(email);
  if (existing && throttle) {
    const since = at.getTime() - new Date(existing.sentAt).getTime();
    if (since < RESEND_AFTER_MS) return { ok: false, reason: "throttled", retryInMs: RESEND_AFTER_MS - since };
  }
  const code = String(randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, "0");
  const record: LoginCodeRecord = {
    email,
    codeHash: hashCode(email, code),
    expiresAt: new Date(at.getTime() + CODE_TTL_MS).toISOString(),
    sentAt: at.toISOString(),
    attempts: 0,
    signupTokenHash: null,
  };
  await store.putLoginCode(record);
  return { ok: true, code };
}

export type CheckResult =
  | { ok: true }
  | { ok: false; reason: "wrong"; attemptsLeft: number }
  | { ok: false; reason: "expired" | "locked" | "missing" };

/** Check a code. A right code is used up; a wrong one costs an attempt. */
export async function checkCode(rawEmail: string, rawCode: string, at = new Date()): Promise<CheckResult> {
  const email = normaliseEmail(rawEmail);
  const code = rawCode.replace(/\D/g, "");
  const store = await getStore();
  const record = await store.getLoginCode(email);
  if (!record || record.signupTokenHash) return { ok: false, reason: "missing" };
  if (new Date(record.expiresAt).getTime() <= at.getTime()) {
    await store.deleteLoginCode(email);
    return { ok: false, reason: "expired" };
  }
  if (record.attempts >= MAX_ATTEMPTS) return { ok: false, reason: "locked" };

  if (code.length === CODE_LENGTH && sameHash(record.codeHash, hashCode(email, code))) {
    await store.deleteLoginCode(email);
    return { ok: true };
  }
  const attempts = record.attempts + 1;
  await store.putLoginCode({ ...record, attempts });
  if (attempts >= MAX_ATTEMPTS) return { ok: false, reason: "locked" };
  return { ok: false, reason: "wrong", attemptsLeft: MAX_ATTEMPTS - attempts };
}

/**
 * After a right code for an email with no account yet: a one-time token that lets the
 * person finish sign-up by giving their name, without entering the code again.
 */
export async function issueSignupToken(rawEmail: string, at = new Date()): Promise<string> {
  const email = normaliseEmail(rawEmail);
  const token = newToken();
  const store = await getStore();
  await store.putLoginCode({
    email,
    codeHash: "",
    expiresAt: new Date(at.getTime() + CODE_TTL_MS).toISOString(),
    sentAt: new Date(0).toISOString(),
    attempts: 0,
    signupTokenHash: hashToken(token),
  });
  return token;
}

export async function consumeSignupToken(rawEmail: string, token: string, at = new Date()): Promise<boolean> {
  const email = normaliseEmail(rawEmail);
  const store = await getStore();
  const record = await store.getLoginCode(email);
  if (!record?.signupTokenHash || !token) return false;
  if (new Date(record.expiresAt).getTime() <= at.getTime()) return false;
  if (!sameHash(record.signupTokenHash, hashToken(token))) return false;
  await store.deleteLoginCode(email);
  return true;
}
