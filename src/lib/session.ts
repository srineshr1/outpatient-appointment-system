import { cookies } from "next/headers";
import type { SessionUser } from "./clinic-types";
import { createPatient, findUserByEmail } from "./accounts";
import { hashToken, newToken } from "./passwords";
import { getStore } from "./store";
import { createSupabase, supabaseConfigured } from "./supabase";

export const SESSION_COOKIE = "hsp_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

export function sessionExpiry(from = new Date()): string {
  return new Date(from.getTime() + SESSION_MAX_AGE_SECONDS * 1000).toISOString();
}

export function safeNext(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\") || value.includes("://")) return "/";
  return value;
}

async function readToken(): Promise<string | null> {
  try {
    const jar = await cookies();
    return jar.get(SESSION_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  if (supabaseConfigured()) {
    try {
      const supabase = await createSupabase();
      const { data } = await supabase.auth.getUser();
      const account = data.user;
      const email = account?.email;
      if (account && email) {
        const store = await getStore();
        let stored = await store.getUserByEmail(email);
        if (!stored) {
          const metaName = typeof account.user_metadata?.full_name === "string" ? account.user_metadata.full_name : "";
          const name = metaName || email.split("@")[0] || "Patient";
          await createPatient(email, name);
          stored = await store.getUserByEmail(email);
        }
        if (!stored || stored.disabledAt) return null;
        const { passwordHash: _secret, ...profile } = stored;
        const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000).toISOString();
        return { ...profile, expiresAt, sessionId: null };
      }
    } catch {
      // Fall through to the local session when Supabase is unreachable.
    }
  }

  const token = await readToken();
  if (!token) return null;
  const store = await getStore();
  const tokenHash = hashToken(token);
  const session = await store.getSession(tokenHash);
  if (!session) return null;
  if (session.expiresAt <= new Date().toISOString()) {
    await store.deleteSession(tokenHash);
    return null;
  }
  const user = await store.getUserById(session.userId);
  if (!user) return null;
  return { ...user, expiresAt: session.expiresAt, sessionId: session.id };
}

export async function startSession(userId: string): Promise<void> {
  const token = newToken();
  const store = await getStore();
  const expiresAt = sessionExpiry();
  await store.createSession(hashToken(token), userId, expiresAt);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const token = await readToken();
  if (token) {
    const store = await getStore();
    await store.deleteSession(hashToken(token));
  }
  try {
    const jar = await cookies();
    jar.delete(SESSION_COOKIE);
  } catch {
    // Tests call this outside a request. The session row is already gone.
  }
}
