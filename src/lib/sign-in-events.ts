/** Activity-log entries for signing in and out. Never records codes, tokens or passwords. */
import { findUserByEmail } from "./accounts";
import { actorOf, anonymousActor, recordEvent, recordEventSoon } from "./audit";
import type { PublicUser, UserAccount } from "./clinic-types";
import { practice } from "./data";
import { normaliseEmail } from "./passwords";

export const DISABLED_MESSAGE = `This account is turned off. Please call the practice on ${practice.phoneDisplay}.`;

export type SignInMethod = "Google" | "Password";

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
 * A wrong password, or a try while the email is locked after five wrong ones. Logged against the
 * account when there is one, so the admin can see who is being targeted.
 */
export async function signInFailed(rawEmail: string, outcome: "wrong" | "locked"): Promise<void> {
  const email = normaliseEmail(rawEmail);
  const account = await findUserByEmail(email).catch(() => null);
  const detail = outcome === "locked" ? "locked for 15 minutes after five wrong passwords" : "wrong password";
  await recordEvent({
    actor: account ? actorOf(account) : anonymousActor(email),
    action: outcome === "locked" ? "signin.locked" : "signin.password_failed",
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

export async function passwordChanged(user: Pick<PublicUser, "id" | "name" | "role" | "email">): Promise<void> {
  await recordEvent({
    actor: actorOf(user),
    action: "account.password_reset",
    subjectType: "user",
    subjectId: user.id,
    summary: `${user.email} · set a new password from an emailed link; other sessions ended`,
  });
}
