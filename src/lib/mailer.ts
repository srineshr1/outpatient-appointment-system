import { practice } from "./data";
import { RESET_TTL_MS } from "./login-codes";
import { resetEmail } from "./login-email";

export class MailNotConfiguredError extends Error {
  constructor() {
    super("Email sending is not set up. Set RESEND_API_KEY and MAIL_FROM.");
    this.name = "MailNotConfiguredError";
  }
}

/** Whether the app can send its own email (Resend, from the practice's domain). */
export function ownMailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.MAIL_FROM?.trim());
}

/**
 * Send a password-reset link. Uses Resend's HTTP API when RESEND_API_KEY is set. In development
 * without a key the link is printed to the server terminal instead. In production without a key
 * it refuses, so a link is never silently lost.
 */
export async function sendPasswordReset(email: string, link: string): Promise<"email" | "console"> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV === "production") throw new MailNotConfiguredError();
    console.info(`[password-reset] Link for ${email}: ${link}`);
    return "console";
  }
  const from = process.env.MAIL_FROM ?? `${practice.name} <onboarding@resend.dev>`;
  const message = resetEmail({
    link,
    minutes: Math.round(RESET_TTL_MS / 60_000),
    practiceName: practice.name,
    practiceShortName: practice.shortName,
    address: practice.address,
  });
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [email], ...message }),
  });
  if (!response.ok) {
    // Resend explains refusals in the body. It never echoes the key.
    const detail = await response.text().catch(() => "");
    throw new Error(`Email provider responded ${response.status}: ${detail.slice(0, 300)}`);
  }
  return "email";
}

/** Domains that never reach a person: the sample accounts, reserved test domains and throwaway inboxes. */
const UNDELIVERABLE_DOMAINS = [
  "halden.example",
  "example.com",
  "example.org",
  "example.net",
  "mailinator.com",
  "guerrillamail.com",
  "10minutemail.com",
  "yopmail.com",
  "tempmail.com",
  "temp-mail.org",
  "trashmail.com",
  "sharklasers.com",
  "getnada.com",
  "dispostable.com",
  "maildrop.cc",
  "throwawaymail.com",
];

/** Whether it is worth sending a notice to this address. Anything else is skipped quietly. */
export function isDeliverableEmail(email: string): boolean {
  const address = email.trim().toLowerCase();
  const at = address.lastIndexOf("@");
  if (at < 1 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) return false;
  const domain = address.slice(at + 1);
  if (domain.endsWith(".example") || domain.endsWith(".test") || domain.endsWith(".invalid") || domain.endsWith(".localhost")) return false;
  return !UNDELIVERABLE_DOMAINS.some((blocked) => domain === blocked || domain.endsWith(`.${blocked}`));
}

export type NoticeResult = "sent" | "skipped" | "failed";

/**
 * Send a plain notice by Resend. Never throws: a notice is a courtesy, and the change it describes
 * has already happened. Addresses that cannot receive mail are skipped.
 */
export async function sendNotice(to: string, message: { subject: string; text: string; html: string }): Promise<NoticeResult> {
  if (!isDeliverableEmail(to)) return "skipped";
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.info(`[notice] Would email ${to}: ${message.subject}`);
    return "skipped";
  }
  try {
    const from = process.env.MAIL_FROM ?? `${practice.name} <onboarding@resend.dev>`;
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], ...message }),
    });
    if (!response.ok) {
      console.error(`[notice] Email provider responded ${response.status} for "${message.subject}"`);
      return "failed";
    }
    return "sent";
  } catch (error) {
    console.error(`[notice] Could not send "${message.subject}": ${error instanceof Error ? error.message : "unknown error"}`);
    return "failed";
  }
}
