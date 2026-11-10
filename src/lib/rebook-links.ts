/**
 * Links in a displaced patient's offer. The token is an HMAC of the offer id with a server secret
 * (REBOOK_TOKEN_SECRET, or AUTH_SECRET), so only its SHA-256 is stored and the outbox rebuilds the
 * link when it sends: the raw token is never written to the database. No other imports from the app,
 * so the notification service can use it without a cycle.
 */
import { createHmac } from "node:crypto";
import { hashToken } from "./passwords";

function tokenSecret(): string {
  const secret = process.env.REBOOK_TOKEN_SECRET?.trim() || process.env.AUTH_SECRET?.trim();
  if (secret && secret.length >= 16) return secret;
  if (process.env.NODE_ENV === "production" && !process.env.VITEST) {
    throw new Error("Rebooking links need REBOOK_TOKEN_SECRET (or AUTH_SECRET) of at least 16 characters.");
  }
  return "development-only-rebooking-key";
}

/** The patient's link token for an offer. Never stored; rebuilt from the offer id when needed. */
export function rebookToken(offerId: string): string {
  return createHmac("sha256", tokenSecret()).update(`rebook:${offerId}`).digest("base64url");
}

/** What the store keeps: the SHA-256 of the token. */
export function rebookTokenHash(offerId: string): string {
  return hashToken(rebookToken(offerId));
}

/** The path a patient opens: /rebook/<token>, optionally with one offered slot preselected. */
export function rebookPath(offerId: string, slotId?: string): string {
  return `/rebook/${rebookToken(offerId)}${slotId ? `?slot=${encodeURIComponent(slotId)}` : ""}`;
}

export interface RebookLinks {
  /** The offer page: the held times, with nothing chosen yet. */
  page: string;
  /** One link per held time: opens the page with that time chosen, to confirm. */
  slots: Array<{ when: string; url: string }>;
  /** Every open time with the doctor. */
  more: string;
  /** Cancel and get a full refund (asks to confirm first). */
  cancel: string;
}

/**
 * The absolute links for an offer email or text. Opening one never changes anything: mail scanners
 * follow links, so every link lands on a page that asks the patient to confirm.
 */
export function rebookLinks(site: string, offerId: string, slots: ReadonlyArray<{ slotId: string; when: string }>): RebookLinks {
  const page = `${site}${rebookPath(offerId)}`;
  return {
    page,
    slots: slots.map((slot) => ({ when: slot.when, url: `${site}${rebookPath(offerId, slot.slotId)}` })),
    more: `${page}?more=1`,
    cancel: `${page}?cancel=1`,
  };
}
