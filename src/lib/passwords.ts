import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LEN = 32;
/** OWASP's scrypt settings: N=2^15, r=8, p=3 (about 32 MiB per hash). */
const CURRENT = { N: 32768, r: 8, p: 3 } as const;
/** The first hashes used these. They still verify. */
const LEGACY = { N: 16384, r: 8, p: 1 } as const;
const MAXMEM = 128 * 1024 * 1024;

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 200;

/** A salted scrypt hash: `scrypt2$N$r$p$salt$hash`. The plain password is never stored. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("base64url");
  const { N, r, p } = CURRENT;
  const hash = scryptSync(password, salt, KEY_LEN, { N, r, p, maxmem: MAXMEM }).toString("base64url");
  return `scrypt2$${N}$${r}$${p}$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  let params: { N: number; r: number; p: number };
  let salt: string | undefined;
  let hash: string | undefined;
  if (parts[0] === "scrypt2" && parts.length === 6) {
    params = { N: Number(parts[1]), r: Number(parts[2]), p: Number(parts[3]) };
    [salt, hash] = [parts[4], parts[5]];
    if (![params.N, params.r, params.p].every((value) => Number.isInteger(value) && value > 0) || params.N > 1 << 20) return false;
  } else if (parts[0] === "scrypt" && parts.length === 3) {
    params = LEGACY;
    [salt, hash] = [parts[1], parts[2]];
  } else {
    return false;
  }
  if (!salt || !hash) return false;
  const actual = scryptSync(password, salt, KEY_LEN, { ...params, maxmem: MAXMEM });
  const expected = Buffer.from(hash, "base64url");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

/** Why a new password can't be used, or undefined when it is fine. */
export function passwordError(password: string, confirm?: string): string | undefined {
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`;
  if (password.length > MAX_PASSWORD_LENGTH) return `Keep your password to ${MAX_PASSWORD_LENGTH} characters.`;
  if (confirm !== undefined && confirm !== password) return "The two passwords don’t match.";
  return undefined;
}

export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}
