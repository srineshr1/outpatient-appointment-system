import { practice } from "./data";
import { isDemoSignInEmail } from "./demo-accounts";
import { CODE_TTL_MS } from "./login-codes";
import { loginEmail } from "./login-email";

export interface SentCode {
  /** "email" when it really went out; "console" in development without a mail key. */
  via: "email" | "console";
}

export class MailNotConfiguredError extends Error {
  constructor() {
    super("Email sending is not set up. Set RESEND_API_KEY and MAIL_FROM.");
    this.name = "MailNotConfiguredError";
  }
}

/**
 * Whether codes may be shown on screen and in the terminal instead of being emailed:
 * in development, or when a demo deployment opts in with SHOW_LOGIN_CODES=1.
 * Never when a real mail key is set.
 */
export function devCodesAllowed(): boolean {
  if (process.env.RESEND_API_KEY) return false;
  return process.env.NODE_ENV !== "production" || process.env.SHOW_LOGIN_CODES === "1";
}

/**
 * The app sends its own sign-in codes through Resend from the practice's domain. When both are
 * set, every email sign-in uses the app's code flow instead of Supabase's email OTP.
 */
export function ownMailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.MAIL_FROM?.trim());
}

/** Showing sample codes on screen: in development, or on a demo deployment with SHOW_LOGIN_CODES=1. */
function demoCodesOn(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.SHOW_LOGIN_CODES === "1";
}

/**
 * Whether this email's code is shown on screen instead of sent. The seeded sample accounts on
 * the fake clinic domain (not the admin) can't receive mail, so they stay on on-screen codes
 * while demo codes are on, even when a mail key is set. Real addresses only get on-screen codes
 * when no mail key is set at all.
 */
export function showsCodeOnScreen(email: string): boolean {
  if (isDemoSignInEmail(email)) return demoCodesOn();
  return devCodesAllowed();
}

/**
 * Send a sign-in code. Uses Resend's HTTP API when RESEND_API_KEY is set. In development
 * without a key the code is printed to the server terminal instead. In production without
 * a key, it refuses, so a code is never silently lost.
 */
export async function sendLoginCode(email: string, code: string): Promise<SentCode> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (!devCodesAllowed()) throw new MailNotConfiguredError();
    console.info(`[sign-in] Code for ${email}: ${code}`);
    return { via: "console" };
  }

  const from = process.env.MAIL_FROM ?? `${practice.name} <onboarding@resend.dev>`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [email], ...loginEmailFor(code) }),
  });
  if (!response.ok) {
    // Resend explains refusals in the body, e.g. an unverified MAIL_FROM domain. It never echoes the key.
    const detail = await response.text().catch(() => "");
    const hint = process.env.MAIL_FROM ? "" : " MAIL_FROM is not set, so the test sender onboarding@resend.dev was used; it only delivers to the Resend account owner.";
    throw new Error(`Email provider responded ${response.status}: ${detail.slice(0, 300)}${hint}`);
  }
  return { via: "email" };
}

function loginEmailFor(code: string) {
  return loginEmail({
    code,
    minutes: Math.round(CODE_TTL_MS / 60_000),
    practiceName: practice.name,
    practiceShortName: practice.shortName,
    address: practice.address,
  });
}
