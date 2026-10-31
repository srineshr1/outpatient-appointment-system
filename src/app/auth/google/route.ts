import { NextResponse, type NextRequest } from "next/server";
import { GOOGLE_STATE_COOKIE, googleConfigured, startGoogle } from "@/lib/google";
import { safeNext } from "@/lib/session";
import { createSupabase, supabaseConfigured } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const next = safeNext(request.nextUrl.searchParams.get("next") ?? "/");
  if (supabaseConfigured()) {
    const supabase = await createSupabase();
    const site = process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin;
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${site}/auth/confirm?next=${encodeURIComponent(next)}`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error || !data.url) {
      const back = new URL("/sign-in", request.nextUrl.origin);
      back.searchParams.set("error", "google-off");
      if (next !== "/") back.searchParams.set("next", next);
      return NextResponse.redirect(back);
    }
    return NextResponse.redirect(data.url);
  }

  if (!googleConfigured()) {
    const back = new URL("/sign-in", request.nextUrl.origin);
    back.searchParams.set("error", "google-off");
    if (next !== "/") back.searchParams.set("next", next);
    return NextResponse.redirect(back);
  }
  const { url, cookie } = startGoogle(request.nextUrl.origin, next);
  const response = NextResponse.redirect(url);
  response.cookies.set(GOOGLE_STATE_COOKIE, JSON.stringify(cookie), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/auth/google",
    maxAge: 600,
  });
  return response;
}
