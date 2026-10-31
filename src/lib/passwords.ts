import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LEN = 32;
const SCRYPT = { N: 16384, r: 8, p: 1 } as const;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(password, salt, KEY_LEN, SCRYPT).toString("base64url");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [kind, salt, hash] = stored.split("$");
  if (kind !== "scrypt" || !salt || !hash) return false;
  const actual = scryptSync(password, salt, KEY_LEN, SCRYPT);
  const expected = Buffer.from(hash, "base64url");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
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
