/**
 * Google sign-in (OpenID Connect, authorization code + PKCE). No SDK: two fetches.
 * Enabled when GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set.
 * Redirect URI to register in Google Cloud: <origin>/auth/google/callback
 */
import { createHash, randomBytes } from "node:crypto";

export const GOOGLE_STATE_COOKIE = "hsp_google";

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function redirectUri(origin: string): string {
  return `${process.env.NEXT_PUBLIC_SITE_URL ?? origin}/auth/google/callback`;
}

export interface GoogleStart {
  url: string;
  /** Stored in a short-lived httpOnly cookie and checked on the way back. */
  cookie: { state: string; verifier: string; next: string };
}

export function startGoogle(origin: string, next: string): GoogleStart {
  const state = randomBytes(16).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params}`, cookie: { state, verifier, next } };
}

export interface GoogleProfile {
  email: string;
  name: string;
}

/** Swap the code for tokens, then read the verified email from Google's userinfo endpoint. */
export async function finishGoogle(origin: string, code: string, verifier: string): Promise<GoogleProfile | null> {
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: redirectUri(origin),
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
  });
  if (!tokenResponse.ok) return null;
  const tokens = (await tokenResponse.json()) as { access_token?: string };
  if (!tokens.access_token) return null;

  const infoResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!infoResponse.ok) return null;
  const info = (await infoResponse.json()) as { email?: string; email_verified?: boolean; name?: string };
  // Only trust an address Google has verified, or anyone could claim a patient's email.
  if (!info.email || info.email_verified !== true) return null;
  return { email: info.email, name: info.name?.trim() || info.email.split("@")[0]! };
}
