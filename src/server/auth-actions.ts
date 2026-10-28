"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { authenticate, createPatient, findUserByEmail, nameError } from "@/lib/accounts";
import { destinationFor } from "@/lib/auth-routing";
import { checkCode, consumeSignupToken, isEmail, issueCode, issueSignupToken, RESEND_AFTER_MS } from "@/lib/login-codes";
import { ownMailConfigured, sendLoginCode, showsCodeOnScreen } from "@/lib/mailer";
import { normaliseEmail } from "@/lib/passwords";
import { CODE_LENGTH, SUPABASE_CODE_LENGTH } from "@/lib/sign-in-config";
import { SEND_FAILED, sendCodeErrorMessage } from "@/lib/sign-in-errors";
import { destroySession, getCurrentUser, safeNext, SESSION_COOKIE, startSession } from "@/lib/session";
import { blockedSignIn, DISABLED_MESSAGE, patientSignedUp, signedIn, signedOut, signInFailed } from "@/lib/sign-in-events";
import { createSupabase, isAuthCookie, supabaseConfigured } from "@/lib/supabase";
import { isDemoSignInEmail } from "@/lib/demo-accounts";
import { STORE_UNAVAILABLE_MESSAGE, StoreUnavailableError } from "@/lib/store";

/**
 * Who sends the email code. With RESEND_API_KEY and MAIL_FROM set, the app sends its own codes
 * for every email sign-in. Without them, Supabase's email OTP is used when Supabase is set up,
 * except for the sample accounts on the fake clinic domain, which Supabase refuses: on a demo
 * deployment those use the app's own flow with the code on screen. Google sign-in is separate.
 */
function sendsThroughSupabase(email: string): boolean {
  if (!supabaseConfigured() || ownMailConfigured()) return false;
  return !(isDemoSignInEmail(email) && showsCodeOnScreen(email));
}

export type SignInMode = "patient" | "staff";

/** Where links in Supabase emails point. NEXT_PUBLIC_SITE_URL wins; on Vercel, fall back to the production domain. */
function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

export type RequestCodeResult =
  | {
      ok: true;
      email: string;
      /** Milliseconds until another code can be sent. */
      resendInMs: number;
      /** Digits in the code that was sent: 4 for the app's own codes, 6 when Supabase sent it. */
      codeLength: number;
      /** Development only, when no mail key is set: the code, so local sign-in works offline. */
      devCode?: string;
    }
  | { ok: false; error: string };

export async function requestCode(input: { email: string; mode: SignInMode }): Promise<RequestCodeResult> {
  try {
    return await requestCodeInner(input);
  } catch (error) {
    if (error instanceof StoreUnavailableError) return { ok: false, error: STORE_UNAVAILABLE_MESSAGE };
    throw error;
  }
}

async function requestCodeInner(input: { email: string; mode: SignInMode }): Promise<RequestCodeResult> {
  const email = normaliseEmail(String(input.email ?? ""));
  if (!email) return { ok: false, error: "Enter your email address." };
  if (!isEmail(email)) return { ok: false, error: "Enter a valid email address, like name@example.com." };

  if (sendsThroughSupabase(email)) {
    const supabase = await createSupabase();
    const site = siteUrl();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${site}/auth/confirm`,
      },
    });
    if (error) return { ok: false, error: sendCodeErrorMessage(error) };
    return { ok: true, email, resendInMs: RESEND_AFTER_MS, codeLength: SUPABASE_CODE_LENGTH };
  }

  if (input.mode === "staff") {
    const user = await findUserByEmail(email);
    if (!user || user.role === "patient") {
      return { ok: false, error: "That email isn’t a staff account. Patients sign in on the main sign-in page." };
    }
  }

  const onScreen = showsCodeOnScreen(email);
  const issued = await issueCode(email, new Date(), !onScreen);
  // A code went out moments ago: carry on to the code step rather than sending another.
  if (!issued.ok) return { ok: true, email, resendInMs: issued.retryInMs, codeLength: CODE_LENGTH };

  if (onScreen) {
    console.info(`[sign-in] On-screen code issued for ${email}`);
    return { ok: true, email, resendInMs: RESEND_AFTER_MS, codeLength: CODE_LENGTH, devCode: issued.code };
  }

  try {
    await sendLoginCode(email, issued.code);
    return { ok: true, email, resendInMs: RESEND_AFTER_MS, codeLength: CODE_LENGTH };
  } catch (error) {
    console.error(`[sign-in] Could not send a code: ${error instanceof Error ? error.message : "unknown error"}`);
    return { ok: false, error: SEND_FAILED };
  }
}

export type VerifyCodeResult =
  | { ok: false; error: string; /** The code can't be retried; ask for a new one. */ spent?: boolean }
  | { ok: true; needsName: true; signupToken: string };

/** Check the code. Signs in and redirects, or asks a new patient for their name. */
export async function verifyCode(input: {
  email: string;
  code: string;
  next: string;
  mode: SignInMode;
}): Promise<VerifyCodeResult> {
  try {
    return await verifyCodeInner(input);
  } catch (error) {
    // Redirects are thrown by Next and must pass through untouched.
    if (error instanceof StoreUnavailableError) return { ok: false, error: STORE_UNAVAILABLE_MESSAGE };
    throw error;
  }
}

async function verifyCodeInner(input: {
  email: string;
  code: string;
  next: string;
  mode: SignInMode;
}): Promise<VerifyCodeResult> {
  const email = normaliseEmail(String(input.email ?? ""));
  const code = String(input.code ?? "").replace(/\D/g, "");
  const viaSupabase = sendsThroughSupabase(email);
  const length = viaSupabase ? SUPABASE_CODE_LENGTH : CODE_LENGTH;
  if (code.length !== length) return { ok: false, error: `Enter the ${length}-digit code from the email.` };

  if (viaSupabase) {
    const supabase = await createSupabase();
    const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
    if (error || !data.user) {
      await signInFailed(email, "wrong");
      return { ok: false, error: "That code isn’t right, or it has expired. Send a new one.", spent: true };
    }
    const existing = await findUserByEmail(email);
    if (await blockedSignIn(existing, "Email code")) {
      await supabase.auth.signOut();
      return { ok: false, error: DISABLED_MESSAGE, spent: true };
    }
    if (!existing) {
      if (input.mode === "staff") {
        await supabase.auth.signOut();
        return { ok: false, error: "That email isn’t a staff account.", spent: true };
      }
      const metaName = typeof data.user.user_metadata?.full_name === "string" ? data.user.user_metadata.full_name : "";
      if (!metaName) return { ok: true, needsName: true, signupToken: "supabase" };
      await patientSignedUp(await createPatient(email, metaName), "Email code");
    }
    const signedInUser = await findUserByEmail(email);
    if (signedInUser) await signedIn(signedInUser, "Email code");
    redirect(destinationFor(signedInUser?.role ?? "patient", safeNext(String(input.next ?? "/"))));
  }

  const result = await checkCode(email, code);
  if (!result.ok) {
    if (result.reason === "wrong") {
      await signInFailed(email, "wrong", result.attemptsLeft);
      return {
        ok: false,
        error: `That code isn’t right. ${result.attemptsLeft === 1 ? "1 try" : `${result.attemptsLeft} tries`} left.`,
      };
    }
    if (result.reason === "expired") return { ok: false, error: "That code has expired. Send a new one.", spent: true };
    if (result.reason === "locked") {
      await signInFailed(email, "locked");
      return { ok: false, error: "Too many tries. Send a new code.", spent: true };
    }
    return { ok: false, error: "That code has already been used. Send a new one.", spent: true };
  }

  const user = await findUserByEmail(email);
  if (!user) {
    if (input.mode === "staff") return { ok: false, error: "That email isn’t a staff account.", spent: true };
    return { ok: true, needsName: true, signupToken: await issueSignupToken(email) };
  }
  if (await blockedSignIn(user, "Email code")) return { ok: false, error: DISABLED_MESSAGE, spent: true };
  await startSession(user.id);
  await signedIn(user, "Email code");
  redirect(destinationFor(user.role, safeNext(String(input.next ?? "/"))));
}

export async function completeSignup(input: {
  email: string;
  name: string;
  signupToken: string;
  next: string;
}): Promise<{ ok: false; error: string; spent?: boolean }> {
  const problem = nameError(String(input.name ?? ""));
  if (problem) return { ok: false, error: problem };
  const email = normaliseEmail(String(input.email ?? ""));
  if (input.signupToken !== "supabase" && !(await consumeSignupToken(email, String(input.signupToken ?? "")))) {
    return { ok: false, error: "This sign-in has timed out. Start again with your email.", spent: true };
  }
  const existing = await findUserByEmail(email);
  if (await blockedSignIn(existing, "Email code")) return { ok: false, error: DISABLED_MESSAGE, spent: true };
  const user = existing ?? (await createPatient(email, String(input.name)));
  if (!existing) await patientSignedUp(user, "Email code");
  await startSession(user.id);
  await signedIn(user, "Email code");
  redirect(destinationFor(user.role, safeNext(String(input.next ?? "/"))));
}

/** Plain form action for the one-tap sample staff accounts. */
export async function signInFromDemo(formData: FormData): Promise<void> {
  const nextPath = safeNext(String(formData.get("next") ?? "/"));
  const result = await authenticate(String(formData.get("email") ?? ""), String(formData.get("password") ?? ""));
  if (!result.ok) redirect("/sign-in?as=staff");
  if (await blockedSignIn(result.user, "Password")) redirect("/sign-in?as=staff");
  await startSession(result.user.id);
  await signedIn(result.user, "Password");
  redirect(destinationFor(result.user.role, nextPath));
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
