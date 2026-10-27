"use server";

import { redirect } from "next/navigation";
import { authenticate, registerErrors, registerPatient } from "@/lib/accounts";
import { destinationFor, type AuthFormState } from "@/lib/auth-routing";
import { todayIso, now } from "@/lib/clock";
import { destroySession, safeNext, startSession } from "@/lib/session";

async function completeSignIn(formData: FormData, previous: number): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const nextPath = safeNext(String(formData.get("next") ?? "/"));

  const fields: AuthFormState["fields"] = {};
  if (!email.trim()) fields.email = "Enter your email.";
  if (!password) fields.password = "Enter your password.";
  if (fields.email || fields.password) {
    return { error: "", fields, values: { email }, attempt: previous + 1 };
  }

  const result = await authenticate(email, password);
  if (!result.ok) {
    return {
      error: "That email and password don’t match. Check them and try again.",
      fields: {},
      values: { email },
      attempt: previous + 1,
    };
  }
  await startSession(result.user.id);
  redirect(destinationFor(result.user.role, nextPath));
}

export async function signInAction(prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  return completeSignIn(formData, prev.attempt);
}

/** Plain form action for the sample-account buttons. */
export async function signInFromDemo(formData: FormData): Promise<void> {
  await completeSignIn(formData, 0);
}

export async function registerAction(prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const nextPath = safeNext(String(formData.get("next") ?? "/appointments"));
  const input = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    mobile: String(formData.get("mobile") ?? ""),
    dob: String(formData.get("dob") ?? ""),
    today: todayIso(now()),
  };
  const values = { name: input.name, email: input.email, mobile: input.mobile, dob: input.dob };
  const fields = registerErrors(input);
  if (Object.keys(fields).length > 0) {
    const count = Object.keys(fields).length;
    return {
      error: count === 1 ? "There’s 1 thing to fix." : `There are ${count} things to fix.`,
      fields,
      values,
      attempt: prev.attempt + 1,
    };
  }
  const result = await registerPatient(input);
  if (!result.ok) {
    const exists = /already exists/.test(result.error);
    return {
      error: result.error,
      fields: exists ? { email: "This email already has an account." } : {},
      values,
      attempt: prev.attempt + 1,
    };
  }
  await startSession(result.user.id);
  redirect(destinationFor("patient", nextPath));
}

export async function signOutAction(formData?: FormData): Promise<void> {
  await destroySession();
  const next = formData ? safeNext(String(formData.get("next") ?? "/")) : "/";
  redirect(next);
}
