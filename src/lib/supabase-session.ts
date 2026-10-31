import type { UserAccount } from "./clinic-types";

/**
 * When a Supabase session began, from its access token. Supabase puts the sign-in time in the
 * `amr` claim, and it survives token refreshes, unlike `iat`. Falls back to `iat`.
 * Only call this on a token Supabase has already verified (after `auth.getUser()`).
 */
export function sessionStartedAt(accessToken: string | null | undefined): number | null {
  const payload = accessToken?.split(".")[1];
  if (!payload) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { amr?: unknown; iat?: unknown };
    const stamps = Array.isArray(claims.amr)
      ? claims.amr
          .map((entry) => (entry && typeof entry === "object" ? (entry as { timestamp?: unknown }).timestamp : undefined))
          .filter((stamp): stamp is number => typeof stamp === "number" && Number.isFinite(stamp))
      : [];
    if (stamps.length > 0) return Math.min(...stamps) * 1000;
    return typeof claims.iat === "number" && Number.isFinite(claims.iat) ? claims.iat * 1000 : null;
  } catch {
    return null;
  }
}

/**
 * True when an admin signed this person out everywhere after the session began.
 * Unknown start times count as revoked: when in doubt, ask them to sign in again.
 */
export function revokedSession(account: Pick<UserAccount, "sessionsRevokedAt">, startedAtMs: number | null): boolean {
  if (!account.sessionsRevokedAt) return false;
  if (startedAtMs === null) return true;
  return startedAtMs < new Date(account.sessionsRevokedAt).getTime();
}
