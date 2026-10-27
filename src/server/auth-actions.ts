"use server";

import { redirect } from "next/navigation";
import { authenticate, createPatient, findUserByEmail, nameError } from "@/lib/accounts";
import { destinationFor } from "@/lib/auth-routing";
import { checkCode, consumeSignupToken, isEmail, issueCode, issueSignupToken, RESEND_AFTER_MS } from "@/lib/login-codes";
import { devCodesAllowed, sendLoginCode } from "@/lib/mailer";
import { normaliseEmail } from "@/lib/passwords";
import { CODE_LENGTH } from "@/lib/sign-in-config";
import { destroySession, safeNext, startSession } from "@/lib/session";
import { createSupabase, supabaseConfigured } from "@/lib/supabase";

export type SignInMode = "patient" | "staff";

export type RequestCodeResult =
  | {
      ok: true;
      email: string;
      /** Milliseconds until another code can be sent. */
      resendInMs: number;
      /** Development only, when no mail key is set: the code, so local sign-in works offline. */
      devCode?: string;
    }
  | { ok: false; error: string };

export async function requestCode(input: { email: string; mode: SignInMode }): Promise<RequestCodeResult> {
  const email = normaliseEmail(String(input.email ?? ""));
  if (!email) return { ok: false, error: "Enter your email address." };
  if (!isEmail(email)) return { ok: false, error: "Enter a valid email address, like name@example.com." };

  if (supabaseConfigured()) {
    const supabase = await createSupabase();
    const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://halden-street-practice.vercel.app";
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${site}/auth/confirm`,
      },
    });
    if (error) return { ok: false, error: "We couldn’t send the confirmation email. Try again in a minute." };
    return { ok: true, email, resendInMs: RESEND_AFTER_MS };
  }

  if (input.mode === "staff") {
    const user = await findUserByEmail(email);
    if (!user || user.role === "patient") {
      return { ok: false, error: "That email isn’t a staff account. Patients sign in on the main sign-in page." };
    }
  }

  const issued = await issueCode(email, new Date(), !devCodesAllowed());
  // A code went out moments ago: carry on to the code step rather than sending another.
  if (!issued.ok) return { ok: true, email, resendInMs: issued.retryInMs };

  try {
    const sent = await sendLoginCode(email, issued.code);
    return {
      ok: true,
      email,
      resendInMs: RESEND_AFTER_MS,
      devCode: sent.via === "console" && devCodesAllowed() ? issued.code : undefined,
    };
  } catch {
    return { ok: false, error: "We couldn’t send the email just now. Please try again in a minute." };
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
  if (code.length !== CODE_LENGTH) return { ok: false, error: `Enter the ${CODE_LENGTH}-digit code from the email.` };

  if (supabaseConfigured()) {
    const supabase = await createSupabase();
    const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
    if (error || !data.user) return { ok: false, error: "That code isn’t right, or it has expired. Send a new one.", spent: true };
    const existing = await findUserByEmail(email);
    if (!existing) {
      if (input.mode === "staff") {
        await supabase.auth.signOut();
        return { ok: false, error: "That email isn’t a staff account.", spent: true };
      }
      const metaName = typeof data.user.user_metadata?.full_name === "string" ? data.user.user_metadata.full_name : "";
      if (!metaName) return { ok: true, needsName: true, signupToken: "supabase" };
      await createPatient(email, metaName);
    }
    redirect(destinationFor((await findUserByEmail(email))?.role ?? "patient", safeNext(String(input.next ?? "/"))));
  }

  const result = await checkCode(email, code);
  if (!result.ok) {
    if (result.reason === "wrong") {
      return {
        ok: false,
        error: `That code isn’t right. ${result.attemptsLeft === 1 ? "1 try" : `${result.attemptsLeft} tries`} left.`,
      };
    }
    if (result.reason === "expired") return { ok: false, error: "That code has expired. Send a new one.", spent: true };
    if (result.reason === "locked") return { ok: false, error: "Too many tries. Send a new code.", spent: true };
    return { ok: false, error: "That code has already been used. Send a new one.", spent: true };
  }

  const user = await findUserByEmail(email);
  if (!user) {
    if (input.mode === "staff") return { ok: false, error: "That email isn’t a staff account.", spent: true };
    return { ok: true, needsName: true, signupToken: await issueSignupToken(email) };
  }
  await startSession(user.id);
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
  const user = existing ?? (await createPatient(email, String(input.name)));
  await startSession(user.id);
  redirect(destinationFor(user.role, safeNext(String(input.next ?? "/"))));
}

/** Plain form action for the one-tap sample staff accounts. */
export async function signInFromDemo(formData: FormData): Promise<void> {
  const nextPath = safeNext(String(formData.get("next") ?? "/"));
  const result = await authenticate(String(formData.get("email") ?? ""), String(formData.get("password") ?? ""));
  if (!result.ok) redirect("/sign-in?as=staff");
  await startSession(result.user.id);
  redirect(destinationFor(result.user.role, nextPath));
}

export async function signOutAction(formData?: FormData): Promise<void> {
  if (supabaseConfigured()) {
    const supabase = await createSupabase();
    await supabase.auth.signOut();
  }
  await destroySession();
  const next = formData ? safeNext(String(formData.get("next") ?? "/")) : "/";
  redirect(next);
}
