import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignInPanel } from "@/components/auth/SignInPanel";
import { destinationFor } from "@/lib/auth-routing";
import { getDoctors } from "@/lib/repository";
import { getCurrentUser, safeNext } from "@/lib/session";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false },
};

const NOTICES: Record<string, string> = {
  "google-off": "Google sign-in isn’t set up on this site yet. Use your email instead.",
  "google-cancelled": "Google sign-in was cancelled. Try again, or use your email.",
  "google-failed": "We couldn’t sign you in with Google. Try again, or use your email.",
};

interface Props {
  searchParams: Promise<{ next?: string | string[]; as?: string | string[]; error?: string | string[] }>;
}

export default async function SignInPage({ searchParams }: Props) {
  const query = await searchParams;
  const nextPath = safeNext(typeof query.next === "string" ? query.next : "/");

  // Already signed in: carry straight on.
  const user = await getCurrentUser();
  if (user) redirect(destinationFor(user.role, nextPath));

  const mode = query.as === "staff" || nextPath.startsWith("/dashboard") ? "staff" : "patient";
  const notice = typeof query.error === "string" ? (NOTICES[query.error] ?? null) : null;
  const doctors = await getDoctors();

  return (
    // A new key per mode resets the form when switching between patient and staff.
    <SignInPanel key={mode} nextPath={nextPath} mode={mode} doctors={doctors} notice={notice} />
  );
}
