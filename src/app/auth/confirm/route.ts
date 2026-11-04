import { NextResponse, type NextRequest } from "next/server";
import { createPatient, findUserByEmail } from "@/lib/accounts";
import { destinationFor } from "@/lib/auth-routing";
import { safeNext } from "@/lib/session";
import { blockedSignIn, patientSignedUp, signedIn } from "@/lib/sign-in-events";
import { createSupabase } from "@/lib/supabase";

/** Google sign-in (through Supabase) returns here. Email sign-in links are no longer used. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNext(url.searchParams.get("next") ?? "/");
  const supabase = await createSupabase();
  const code = url.searchParams.get("code");

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(new URL("/sign-in?error=google-failed", url.origin));
  } else {
    return NextResponse.redirect(new URL("/sign-in?error=google-failed", url.origin));
  }

  const { data } = await supabase.auth.getUser();
  const email = data.user?.email;
  if (email) {
    const existing = await findUserByEmail(email);
    const method = "Google";
    if (await blockedSignIn(existing, method)) {
      await supabase.auth.signOut();
      return NextResponse.redirect(new URL("/sign-in?error=google-failed", url.origin));
    }
    let created = false;
    if (!existing) {
      created = true;
      const metaName = typeof data.user?.user_metadata?.full_name === "string" ? data.user.user_metadata.full_name : "";
      const name = metaName || email.split("@")[0] || "Patient";
      await patientSignedUp(await createPatient(email, name), method);
    }
    const user = await findUserByEmail(email);
    if (user) {
      await signedIn(user, method);
      const target = created
        ? `/profile?welcome=1${next === "/" ? "" : `&next=${encodeURIComponent(next)}`}`
        : destinationFor(user.role, next);
      return NextResponse.redirect(new URL(target, url.origin));
    }
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
