"use server";

import { redirect } from "next/navigation";
import { authenticate, registerErrors, registerPatient } from "@/lib/accounts";
import { todayIso, now } from "@/lib/clock";
import { destroySession, safeNext, startSession } from "@/lib/session";

export interface AuthFormState {
  error: string;
  fields: Partial<Record<"name" | "email" | "password" | "mobile" | "dob", string>>;
}

function destinationFor(role: "patient" | "doctor" | "reception", nextPath: string): string {
  if (nextPath !== "/") return nextPath;
  return role === "patient" ? "/appointments" : "/dashboard";
}

async function completeSignIn(formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const nextPath = safeNext(String(formData.get("next") ?? "/"));
  const result = await authenticate(email, password);
  if (!result.ok) return { error: "Those details don’t match. Try again.", fields: {} };
  await startSession(result.user.id);
  redirect(destinationFor(result.user.role, nextPath));
}

export async function signInAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  return completeSignIn(formData);
}

/** Plain form action for the sample-account buttons. */
export async function signInFromDemo(formData: FormData): Promise<void> {
  await completeSignIn(formData);
}

export async function registerAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const nextPath = safeNext(String(formData.get("next") ?? "/appointments"));
  const input = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    mobile: String(formData.get("mobile") ?? ""),
    dob: String(formData.get("dob") ?? ""),
    today: todayIso(now()),
  };
  const fields = registerErrors(input);
  const first = fields.name ?? fields.email ?? fields.password ?? fields.mobile ?? fields.dob;
  if (first) return { error: first, fields };
  const result = await registerPatient(input);
  if (!result.ok) return { error: result.error, fields: {} };
  await startSession(result.user.id);
  redirect(nextPath === "/" ? "/appointments" : nextPath);
}

export async function signOutAction(): Promise<void> {
  await destroySession();
  redirect("/");
}
