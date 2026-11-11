/**
 * Text messages through Fast2SMS (Quick SMS route, no DLT template needed).
 *
 * SMS_MODE decides what happens:
 * - unset or "mock": nothing is sent and no credit is used; the message is logged and the outbox
 *   row is marked skipped. This is the default everywhere, so merging this never spends credit.
 * - "live": sent through Fast2SMS with FAST2SMS_API_KEY. Without the key it falls back to mock.
 * - "off": text messages are not queued at all.
 *
 * Only Indian mobiles (+91, 10 digits starting 6–9) can be texted; anything else is skipped.
 * The API key is read from the environment on each send and never logged.
 */
import { practice } from "../data";
import { formatMoney } from "../fees";
import type { NoticeData, NotificationKind, SendResult } from "./types";

export const FAST2SMS_URL = "https://www.fast2sms.com/dev/bulkV2";

/** The patient notices that also go by text: booking, move, cancellation, the last reminder, and a displaced visit's offer and outcome. */
export const SMS_KINDS: readonly NotificationKind[] = [
  "booking_confirmed",
  "appointment_rescheduled",
  "appointment_cancelled",
  "reminder",
  "rebooking_offer",
  "rebooking_confirmed",
  "rebooking_closed",
];

export type SmsMode = "live" | "mock" | "off";

export function smsMode(env: Record<string, string | undefined> = process.env): SmsMode {
  const raw = (env.SMS_MODE ?? "").trim().toLowerCase();
  if (raw === "off") return "off";
  if (raw === "live" && env.FAST2SMS_API_KEY?.trim()) return "live";
  return "mock";
}

/** "9876543210" for an Indian mobile in any accepted form, otherwise null. */
export function indianMobile(stored: string | null | undefined): string | null {
  const digits = String(stored ?? "").replace(/\D/g, "");
  const local = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits.length === 11 && digits.startsWith("0") ? digits.slice(1) : digits;
  return /^[6-9]\d{9}$/.test(local) ? local : null;
}

const CLINIC = practice.name;

/** Short plain text, kept to one 160-character SMS where possible. */
export function renderSms(kind: NotificationKind, data: NoticeData): string {
  const when = data.token ? `${data.when}, token ${data.token}` : data.when;
  switch (kind) {
    case "booking_confirmed":
      return `${CLINIC}: booked with ${data.doctorName} on ${when}. Ref ${data.reference}.${data.amountMinor ? ` Paid ${formatMoney(data.amountMinor)}.` : ""}`;
    case "appointment_rescheduled":
      return `${CLINIC}: your visit ${data.reference} with ${data.doctorName} moved to ${when}.`;
    case "appointment_cancelled":
      return `${CLINIC}: your visit ${data.reference} with ${data.doctorName} on ${data.when} is cancelled.${data.refundMinor ? ` Refund ${formatMoney(data.refundMinor)}.` : ""}`;
    case "rebooking_offer":
      return `${CLINIC}: ${data.doctorName} can no longer see you on ${data.when}. Pick a new time (held ${data.expiresWhen ? `until ${data.expiresWhen}` : "24h"}) or get a full refund: ${data.rebookLinks?.page ?? "see your email"}`;
    case "rebooking_confirmed":
      return `${CLINIC}: your visit ${data.reference} with ${data.doctorName} is now ${when}. Same reference; no new payment needed.`;
    case "rebooking_closed":
      return `${CLINIC}: your visit ${data.reference} with ${data.doctorName} on ${data.previousWhen ?? data.when} is cancelled.${data.refundMinor ? ` Full refund ${formatMoney(data.refundMinor)}.` : ""}`;
    case "reminder":
      return `${CLINIC} reminder: ${data.doctorName} on ${when}. Ref ${data.reference}. Please arrive 10 min early.`;
    default:
      return `${CLINIC}: update on ${data.reference}.`;
  }
}

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

/** Send one text. Never throws; the outbox retries "failed". */
export async function sendSms(
  recipient: string,
  text: string,
  env: Record<string, string | undefined> = process.env,
  fetcher: Fetch = fetch,
): Promise<SendResult> {
  const mode = smsMode(env);
  const number = indianMobile(recipient);
  if (!number) {
    console.info("[sms] skipped: not an Indian mobile number");
    return "skipped";
  }
  if (mode !== "live") {
    console.info(`[sms] mock, not sent (${text.length} chars) to …${number.slice(-3)}: ${text}`);
    return "skipped";
  }
  try {
    const response = await fetcher(FAST2SMS_URL, {
      method: "POST",
      headers: { authorization: env.FAST2SMS_API_KEY!.trim(), "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ route: "q", message: text, language: "english", flash: 0, numbers: number }),
    });
    const body = (await response.json().catch(() => null)) as { return?: boolean; message?: unknown } | null;
    if (response.ok && body?.return === true) return "sent";
    console.error(`[sms] Fast2SMS refused (${response.status}): ${JSON.stringify(body?.message ?? "").slice(0, 200)}`);
    return "failed";
  } catch (error) {
    console.error(`[sms] Fast2SMS unreachable: ${error instanceof Error ? error.message : "unknown error"}`);
    return "failed";
  }
}
