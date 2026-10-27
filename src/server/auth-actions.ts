"use server";

import { redirect } from "next/navigation";
import { authenticate, createPatient, findUserByEmail, nameError } from "@/lib/accounts";
import { destinationFor } from "@/lib/auth-routing";
import { checkCode, consumeSignupToken, isEmail, issueCode, issueSignupToken, RESEND_AFTER_MS } from "@/lib/login-codes";
import { devCodesAllowed, sendLoginCode } from "@/lib/mailer";
import { normaliseEmail } from "@/lib/passwords";
import { CODE_LENGTH, SUPABASE_CODE_LENGTH } from "@/lib/sign-in-config";
import { SEND_FAILED, sendCodeErrorMessage } from "@/lib/sign-in-errors";
import { destroySession, getCurrentUser, safeNext, startSession } from "@/lib/session";
import { blockedSignIn, DISABLED_MESSAGE, patientSignedUp, signedIn, signedOut, signInFailed } from "@/lib/sign-in-events";
import { createSupabase, supabaseConfigured } from "@/lib/supabase";
import { isDemoSignInEmail } from "@/lib/demo-accounts";

/**
 * Sample accounts on the fake clinic domain can't receive email, and Supabase refuses the address.
 * On a demo deployment (SHOW_LOGIN_CODES=1, no mail key) they use the app's own code flow, with the
 * code shown on screen. Everyone else, and every non-demo deployment, keeps Supabase.
 */
function sendsThroughSupabase(email: string): boolean {
  if (!supabaseConfigured()) return false;
  return !(isDemoSignInEmail(email) && devCodesAllowed());
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

  const issued = await issueCode(email, new Date(), !devCodesAllowed());
  // A code went out moments ago: carry on to the code step rather than sending another.
  if (!issued.ok) return { ok: true, email, resendInMs: issued.retryInMs, codeLength: CODE_LENGTH };

  try {
    const sent = await sendLoginCode(email, issued.code);
    return {
      ok: true,
      email,
      resendInMs: RESEND_AFTER_MS,
      codeLength: CODE_LENGTH,
      devCode: sent.via === "console" && devCodesAllowed() ? issued.code : undefined,
    };
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

export async function signOutAction(formData?: FormData): Promise<void> {
  const leaving = await getCurrentUser().catch(() => null);
  if (leaving) await signedOut(leaving);
  if (supabaseConfigured()) {
    const supabase = await createSupabase();
    await supabase.auth.signOut();
  }
  await destroySession();
  const next = formData ? safeNext(String(formData.get("next") ?? "/")) : "/";
  redirect(next);
}
