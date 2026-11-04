/**
 * Password sign-in limits and password-reset links.
 *
 * Both are kept in the store's short-lived sign-in records (clinic_login_codes), keyed by a prefix
 * and the email, so every backend (Supabase, Blob, SQLite) supports them without a new table:
 *   - `lock:<email>` counts wrong passwords. After MAX_ATTEMPTS wrong tries within LOCK_WINDOW_MS
 *     the account is locked for LOCK_MS. A right password clears it.
 *   - `reset:<email>` holds the SHA-256 of a one-time reset token, valid for RESET_TTL_MS. At most
 *     one link a minute is sent. Using the link deletes it.
 * Nothing secret is stored: only hashes and counters.
 */
import { timingSafeEqual } from "node:crypto";
import { hashToken, newToken, normaliseEmail } from "./passwords";
import { getStore } from "./store";

export const MAX_ATTEMPTS = 5;
export const LOCK_WINDOW_MS = 15 * 60 * 1000;
export const LOCK_MS = 15 * 60 * 1000;
export const RESET_TTL_MS = 30 * 60 * 1000;
export const RESEND_AFTER_MS = 60 * 1000;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmail(value: string): boolean {
  const email = normaliseEmail(value);
  return email.length <= 200 && EMAIL_PATTERN.test(email);
}

export const lockKey = (email: string) => `lock:${normaliseEmail(email)}`;
export const resetKey = (email: string) => `reset:${normaliseEmail(email)}`;

/** What a stored sign-in record is for, and the email it belongs to. */
export function recordKind(key: string): { kind: "lock" | "reset" | "other"; email: string } {
  if (key.startsWith("lock:")) return { kind: "lock", email: key.slice(5) };
  if (key.startsWith("reset:")) return { kind: "reset", email: key.slice(6) };
  return { kind: "other", email: key };
}

function sameHash(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Milliseconds until this email may try a password again, or 0 when it is not locked. */
export async function lockedFor(rawEmail: string, at = new Date()): Promise<number> {
  const record = await (await getStore()).getLoginCode(lockKey(rawEmail));
  if (!record || record.attempts < MAX_ATTEMPTS) return 0;
  return Math.max(0, new Date(record.expiresAt).getTime() - at.getTime());
}

/** Count a wrong password. Returns true when this try locked the account. */
export async function recordFailure(rawEmail: string, at = new Date()): Promise<boolean> {
  const store = await getStore();
  const key = lockKey(rawEmail);
  const existing = await store.getLoginCode(key);
  const fresh = !existing || new Date(existing.expiresAt).getTime() <= at.getTime();
  const attempts = fresh ? 1 : existing.attempts + 1;
  const locks = attempts >= MAX_ATTEMPTS;
  await store.putLoginCode({
    email: key,
    codeHash: "",
    sentAt: fresh ? at.toISOString() : existing.sentAt,
    expiresAt: new Date(at.getTime() + (locks ? LOCK_MS : LOCK_WINDOW_MS)).toISOString(),
    attempts,
    signupTokenHash: null,
  });
  return locks && (fresh || existing.attempts < MAX_ATTEMPTS);
}

export async function clearFailures(rawEmail: string): Promise<void> {
  await (await getStore()).deleteLoginCode(lockKey(rawEmail));
}

export type ResetIssue = { ok: true; token: string } | { ok: false; reason: "throttled" };

/** A new one-time reset token for `email`, replacing any earlier one. One a minute. */
export async function issueResetToken(rawEmail: string, at = new Date()): Promise<ResetIssue> {
  const store = await getStore();
  const key = resetKey(rawEmail);
  const existing = await store.getLoginCode(key);
  if (existing && at.getTime() - new Date(existing.sentAt).getTime() < RESEND_AFTER_MS) return { ok: false, reason: "throttled" };
  const token = newToken();
  await store.putLoginCode({
    email: key,
    codeHash: hashToken(token),
    sentAt: at.toISOString(),
    expiresAt: new Date(at.getTime() + RESET_TTL_MS).toISOString(),
    attempts: 0,
    signupTokenHash: null,
  });
  return { ok: true, token };
}

/** True when the token is the live one for this email (without using it up). */
export async function resetTokenValid(rawEmail: string, token: string, at = new Date()): Promise<boolean> {
  if (!token) return false;
  const record = await (await getStore()).getLoginCode(resetKey(rawEmail));
  if (!record?.codeHash) return false;
  if (new Date(record.expiresAt).getTime() <= at.getTime()) return false;
  return sameHash(record.codeHash, hashToken(token));
}

/** Use up a reset token. True when it was valid. */
export async function consumeResetToken(rawEmail: string, token: string, at = new Date()): Promise<boolean> {
  if (!(await resetTokenValid(rawEmail, token, at))) return false;
  await (await getStore()).deleteLoginCode(resetKey(rawEmail));
  return true;
}
