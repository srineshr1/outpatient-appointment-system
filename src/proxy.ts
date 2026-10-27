import { NextResponse, type NextRequest } from "next/server";

/** The app's own session cookie (see src/lib/session.ts). Kept in sync by hand: the proxy can't import Node-only modules. */
const SESSION_COOKIE = "hsp_session";
/** Areas that need a signed-in staff account. Pages and actions still check the role themselves. */
const STAFF_AREAS = ["/admin", "/dashboard"];

function inStaffArea(pathname: string): boolean {
  return STAFF_AREAS.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** Any sign-in cookie at all: ours, or a Supabase auth cookie (sb-<ref>-auth-token, possibly chunked). */
function hasSessionCookie(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some(({ name, value }) => Boolean(value) && (name === SESSION_COOKIE || /^sb-.+-auth-token(\.\d+)?$/.test(name)));
}

/**
 * Per-request Content-Security-Policy with a script nonce. Next.js reads the nonce
 * from the CSP request header and applies it to its own inline scripts.
 * Styles allow 'unsafe-inline' because Motion animates via style attributes,
 * which cannot carry a nonce.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  // First line of defence: no session cookie at all means no staff pages, no CSV export.
  // This only checks that a cookie exists; the role is checked on the server for every page and action.
  if (inStaffArea(pathname) && !hasSessionCookie(request)) {
    const signIn = new URL("/sign-in", request.url);
    signIn.searchParams.set("as", "staff");
    signIn.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(signIn);
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src 'self'${isDev ? " ws:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  // Lets server layouts send a signed-out visitor back to the page they asked for.
  requestHeaders.set("x-pathname", `${pathname}${search}`);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|icon.svg).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
