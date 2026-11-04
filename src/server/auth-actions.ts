"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { authenticate, createDoctorSelfSignup, createPatient, findUserByEmail, nameError } from "@/lib/accounts";
import { destinationFor } from "@/lib/auth-routing";
import { clearFailures, consumeResetToken, isEmail, issueResetToken, lockedFor, recordFailure } from "@/lib/login-codes";
import { isDeliverableEmail, sendPasswordReset } from "@/lib/mailer";
import { normalisePhone, PHONE_INVALID_MESSAGE } from "@/lib/phone";
import { hashPassword, normaliseEmail, passwordError } from "@/lib/passwords";
import { destroySession, getCurrentUser, safeNext, SESSION_COOKIE, startSession } from "@/lib/session";
import { blockedSignIn, DISABLED_MESSAGE, passwordChanged, patientSignedUp, signedIn, signedOut, signInFailed } from "@/lib/sign-in-events";
import { getStore, STORE_UNAVAILABLE_MESSAGE, StoreUnavailableError } from "@/lib/store";
import { createSupabase, isAuthCookie, supabaseConfigured } from "@/lib/supabase";

export type SignInMode = "patient" | "staff";
export type AuthResult = { ok: false; error: string } | { ok: true; message: string };

/** One message for a wrong email or a wrong password, so the form never says which accounts exist. */
const WRONG_CREDENTIALS = "That email and password don’t match. Check them, or reset your password.";
const LOCKED_MESSAGE = "Too many wrong tries. Wait 15 minutes, or reset your password.";
const RESET_SENT = "If there’s an account for that email, we’ve sent a link to reset the password. It works for 30 minutes.";

/** Where links in emails point. NEXT_PUBLIC_SITE_URL wins; on Vercel, fall back to the production domain. */
function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

async function guarded(work: () => Promise<AuthResult>): Promise<AuthResult> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof StoreUnavailableError) return { ok: false, error: STORE_UNAVAILABLE_MESSAGE };
    throw error;
  }
}

/** Email and password. Signs in and redirects, or says what went wrong without naming accounts. */
export async function signInWithPassword(input: { email: string; password: string; next: string }): Promise<AuthResult> {
  const email = normaliseEmail(String(input.email ?? ""));
  const password = String(input.password ?? "");
  const nextPath = safeNext(String(input.next ?? "/"));
  const result = await guarded(async () => {
    if (!email || !password) return { ok: false, error: "Enter your email and password." };
    if (!isEmail(email)) return { ok: false, error: "Enter a valid email address, like name@example.com." };
    if ((await lockedFor(email)) > 0) {
      await signInFailed(email, "locked");
      return { ok: false, error: LOCKED_MESSAGE };
    }
    const checked = await authenticate(email, password);
    if (!checked.ok) {
      const lockedNow = await recordFailure(email);
      await signInFailed(email, lockedNow ? "locked" : "wrong");
      return { ok: false, error: lockedNow ? LOCKED_MESSAGE : WRONG_CREDENTIALS };
    }
    if (await blockedSignIn(checked.user, "Password")) return { ok: false, error: DISABLED_MESSAGE };
    await clearFailures(email);
    await startSession(checked.user.id, checked.user);
    await signedIn(checked.user, "Password");
    return { ok: true, message: destinationFor(checked.user.role, nextPath) };
  });
  // redirect() throws, so it runs outside the store guard.
  if (result.ok) redirect(result.message);
  return result;
}

/** A new account: name, email, password (twice) and whether they are a patient or a doctor. */
export async function signUpWithPassword(input: {
  name: string;
  email: string;
  password: string;
  confirm: string;
  role: "patient" | "doctor";
  next: string;
  /** Optional mobile for text updates; checked like the booking form. */
  mobile?: string;
}): Promise<AuthResult> {
  const mobileInput = String(input.mobile ?? "").trim();
  const mobile = mobileInput ? normalisePhone(mobileInput) : "";
  const email = normaliseEmail(String(input.email ?? ""));
  const name = String(input.name ?? "");
  const password = String(input.password ?? "");
  const role = input.role === "doctor" ? "doctor" : "patient";
  const nextPath = safeNext(String(input.next ?? "/"));
  const result = await guarded(async () => {
    const problem =
      nameError(name) ??
      (!isEmail(email) ? "Enter a valid email address, like name@example.com." : undefined) ??
      passwordError(password, String(input.confirm ?? "")) ??
      (mobile === null ? PHONE_INVALID_MESSAGE : undefined);
    if (problem) return { ok: false, error: problem };
    if (await findUserByEmail(email)) {
      return { ok: false, error: "There’s already an account for that email. Sign in, or use “Forgot password” to set a new one." };
    }
    const hash = hashPassword(password);
    let user = role === "doctor" ? await createDoctorSelfSignup(email, name, hash) : await createPatient(email, name, hash);
    if (mobile) user = (await (await getStore()).updateUser(user.id, { mobile })) ?? user;
    await startSession(user.id, user);
    await patientSignedUp(user, "Password");
    await signedIn(user, "Password");
    // New accounts start with their own set-up: a doctor's profile and sessions, a patient's phone and details.
    if (user.role === "doctor") return { ok: true, message: "/dashboard/profile?welcome=1" };
    return { ok: true, message: nextPath === "/" ? "/profile?welcome=1" : `/profile?welcome=1&next=${encodeURIComponent(nextPath)}` };
  });
  if (result.ok) redirect(result.message);
  return result;
}

/**
 * Email a one-time link to choose a new password. The answer is the same whether or not the
 * email has an account, so this can't be used to find out who is registered.
 */
export async function requestPasswordReset(input: { email: string }): Promise<AuthResult> {
  const email = normaliseEmail(String(input.email ?? ""));
  return guarded(async () => {
    if (!isEmail(email)) return { ok: false, error: "Enter a valid email address, like name@example.com." };
    const user = await findUserByEmail(email);
    if (!user || user.disabledAt || !isDeliverableEmail(email)) return { ok: true, message: RESET_SENT };
    const issued = await issueResetToken(email);
    if (!issued.ok) return { ok: true, message: RESET_SENT };
    const link = `${siteUrl()}/reset-password?email=${encodeURIComponent(email)}&token=${encodeURIComponent(issued.token)}`;
    try {
      await sendPasswordReset(email, link);
    } catch (error) {
      console.error(`[password-reset] Could not send: ${error instanceof Error ? error.message : "unknown error"}`);
      await (await getStore()).deleteLoginCode(`reset:${email}`).catch(() => undefined);
      return { ok: false, error: "We couldn’t send the email just now. Try again in a minute." };
    }
    return { ok: true, message: RESET_SENT };
  });
}

/** Set a new password from an emailed link. Ends every other session, clears any lockout, and signs in. */
export async function resetPassword(input: { email: string; token: string; password: string; confirm: string }): Promise<AuthResult> {
  const email = normaliseEmail(String(input.email ?? ""));
  const password = String(input.password ?? "");
  const result = await guarded(async () => {
    const problem = passwordError(password, String(input.confirm ?? ""));
    if (problem) return { ok: false, error: problem };
    const user = await findUserByEmail(email);
    if (!user || !(await consumeResetToken(email, String(input.token ?? "")))) {
      return { ok: false, error: "This reset link has expired or was already used. Ask for a new one." };
    }
    if (await blockedSignIn(user, "Password")) return { ok: false, error: DISABLED_MESSAGE };
    const store = await getStore();
    await store.updateUser(user.id, { passwordHash: hashPassword(password) });
    await store.deleteSessionsForUser(user.id);
    await clearFailures(email);
    await passwordChanged(user);
    await startSession(user.id, user);
    await signedIn(user, "Password");
    return { ok: true, message: destinationFor(user.role, "/") };
  });
  if (result.ok) redirect(result.message);
  return result;
}

/** Expire our session cookie and every Supabase auth cookie (chunked or not) this browser sent. */
async function clearAuthCookies(): Promise<void> {
  const jar = await cookies();
  for (const { name } of jar.getAll()) {
    if (name === SESSION_COOKIE || isAuthCookie(name)) jar.delete(name);
  }
}

export async function signOutAction(formData?: FormData): Promise<void> {
  const next = formData ? safeNext(String(formData.get("next") ?? "/")) : "/";
  const leaving = await getCurrentUser().catch(() => null);
  // Each step is best effort: a slow or failing Supabase or store call must never leave
  // someone stuck signed in. The cookies are cleared below whatever happens here.
  if (supabaseConfigured()) {
    try {
      const supabase = await createSupabase();
      // "local" ends this browser's session without a call that can fail for other devices.
      await supabase.auth.signOut({ scope: "local" });
    } catch (error) {
      console.error(`[sign-out] Supabase sign-out failed: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }
  try {
    await destroySession();
  } catch (error) {
    console.error(`[sign-out] Could not end the stored session: ${error instanceof Error ? error.message : "unknown error"}`);
  }
  await clearAuthCookies();
  // Writing the activity log can wait until the browser has its answer.
  if (leaving) after(() => signedOut(leaving));
  redirect(next);
}
