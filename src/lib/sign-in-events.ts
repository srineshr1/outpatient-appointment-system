/** Activity-log entries for signing in and out. Never records codes, tokens or passwords. */
import { findUserByEmail } from "./accounts";
import { actorOf, anonymousActor, recordEvent, recordEventSoon } from "./audit";
import type { PublicUser, UserAccount } from "./clinic-types";
import { practice } from "./data";
import { normaliseEmail } from "./passwords";

export const DISABLED_MESSAGE = `This account is turned off. Please call the practice on ${practice.phoneDisplay}.`;

export type SignInMethod = "Email code" | "Google" | "Password" | "Supabase email link";

export async function signedIn(user: Pick<PublicUser, "id" | "name" | "role" | "email">, method: SignInMethod): Promise<void> {
  // The session is already set: the log entry follows after the response rather than delaying it.
  await recordEventSoon({
    actor: actorOf(user),
    action: "signin.succeeded",
    subjectType: "user",
    subjectId: user.id,
    summary: `${user.email} · ${method}`,
  });
}

export async function signedOut(user: Pick<PublicUser, "id" | "name" | "role" | "email">): Promise<void> {
  await recordEvent({ actor: actorOf(user), action: "signout", subjectType: "user", subjectId: user.id, summary: user.email });
}

/**
 * A wrong code, or a code tried after the five-try lock. Logged against the account when
 * there is one, so the admin can see who is being targeted.
 */
export async function signInFailed(rawEmail: string, outcome: "wrong" | "locked", attemptsLeft?: number): Promise<void> {
  const email = normaliseEmail(rawEmail);
  const account = await findUserByEmail(email).catch(() => null);
  const detail =
    outcome === "locked" ? "five wrong tries; a new code is needed" : `${attemptsLeft === 1 ? "1 try" : `${attemptsLeft ?? 0} tries`} left`;
  await recordEvent({
    actor: account ? actorOf(account) : anonymousActor(email),
    action: outcome === "locked" ? "signin.locked" : "signin.code_failed",
    subjectType: "email",
    subjectId: email,
    summary: `${email} · ${detail}`,
  });
}

/** True, and logged, when a turned-off account tries to sign in. */
export async function blockedSignIn(account: UserAccount | null, method: SignInMethod): Promise<boolean> {
  if (!account?.disabledAt) return false;
  await recordEvent({
    actor: actorOf(account),
    action: "signin.blocked",
    subjectType: "user",
    subjectId: account.id,
    summary: `${account.email} · ${method}`,
  });
  return true;
}

export async function patientSignedUp(user: Pick<PublicUser, "id" | "name" | "role" | "email">, method: SignInMethod): Promise<void> {
  await recordEventSoon({
    actor: actorOf(user),
    action: "account.created",
    subjectType: "user",
    subjectId: user.id,
    summary: `${user.name} · ${user.email} · ${method}${user.role === "doctor" ? " · signed up as a doctor" : ""}`,
  });
}
