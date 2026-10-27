import { practice } from "./data";

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
    body: JSON.stringify({
      from,
      to: [email],
      subject: `${code} is your ${practice.shortName} sign-in code`,
      text: `Your sign-in code is ${code}.\n\nIt works for 10 minutes. If you didn’t ask for it, you can ignore this email.\n\n${practice.name}`,
      html: `<p>Your sign-in code is</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>It works for 10 minutes. If you didn’t ask for it, you can ignore this email.</p><p>${practice.name}</p>`,
    }),
  });
  if (!response.ok) {
    // Resend explains refusals in the body, e.g. an unverified MAIL_FROM domain. It never echoes the key.
    const detail = await response.text().catch(() => "");
    const hint = process.env.MAIL_FROM ? "" : " MAIL_FROM is not set, so the test sender onboarding@resend.dev was used; it only delivers to the Resend account owner.";
    throw new Error(`Email provider responded ${response.status}: ${detail.slice(0, 300)}${hint}`);
  }
  return { via: "email" };
}
