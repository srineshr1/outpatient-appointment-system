import { NextResponse, type NextRequest } from "next/server";
import { GOOGLE_STATE_COOKIE, googleConfigured, startGoogle } from "@/lib/google";
import { safeNext } from "@/lib/session";

export async function GET(request: NextRequest) {
  const next = safeNext(request.nextUrl.searchParams.get("next") ?? "/");
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
