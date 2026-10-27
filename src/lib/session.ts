import { cookies, headers } from "next/headers";
import type { SessionUser } from "./clinic-types";
import { createPatient } from "./accounts";
import { describeDevice } from "./device";
import { loadDoctors } from "./doctors";
import { hashToken, newToken } from "./passwords";
import { getStore } from "./store";
import { createSupabase, supabaseConfigured } from "./supabase";
import { revokedSession, sessionStartedAt } from "./supabase-session";

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
  // Pages and actions look doctors up by id; make sure ones added in the admin console are known.
  await loadDoctors();
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
        if (stored.sessionsRevokedAt) {
          const { data: current } = await supabase.auth.getSession();
          if (revokedSession(stored, sessionStartedAt(current.session?.access_token))) return null;
        }
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
  if (!user || user.disabledAt) return null;
  return { ...user, expiresAt: session.expiresAt, sessionId: session.id };
}

/** A turned-off account can't start a session. Callers check first and show a message. */
export class AccountDisabledError extends Error {
  constructor() {
    super("This account is turned off.");
    this.name = "AccountDisabledError";
  }
}

async function deviceLabel(): Promise<string> {
  try {
    return describeDevice((await headers()).get("user-agent"));
  } catch {
    return "";
  }
}

export async function startSession(userId: string): Promise<void> {
  const token = newToken();
  const store = await getStore();
  const account = await store.getUserById(userId);
  if (account?.disabledAt) throw new AccountDisabledError();
  const expiresAt = sessionExpiry();
  await store.createSession(hashToken(token), userId, expiresAt, await deviceLabel());
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
  try {
    if (token) {
      const store = await getStore();
      await store.deleteSession(hashToken(token));
    }
  } finally {
    // The cookie goes even when the store can't be reached, so signing out always works in this browser.
    try {
      const jar = await cookies();
      jar.delete(SESSION_COOKIE);
    } catch {
      // Tests call this outside a request. The session row is already gone.
    }
  }
}
