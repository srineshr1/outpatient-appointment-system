/**
 * Phone numbers. One parser shared by the booking form (client) and the booking action (server),
 * so both accept and reject the same input.
 *
 * Accepted: Indian mobiles (9876543210, 09876543210, +91 98765 43210), UK numbers (07700 900123,
 * +44 7700 900123, 0131 496 0280) and any international number: an optional "+", then 7 to 15
 * digits (E.164), with spaces, dashes, dots and brackets allowed. Letters are rejected.
 *
 * Stored form: "+" and digits with no punctuation, such as "+919876543210" or "+447700900123".
 * A number typed without a country code that matches no known pattern is kept as plain digits.
 * 07xxx xxxxxx with a leading 0 is read as UK; an Indian number starting 7 should be typed without the 0 or with +91.
 */

export const PHONE_EXAMPLE = "+91 98765 43210";
export const PHONE_REQUIRED_MESSAGE = "Enter a mobile number.";
export const PHONE_INVALID_MESSAGE = "Use a mobile number with 7 to 15 digits, such as +91 98765 43210 or 07700 900123.";
export const PHONE_PLACEHOLDER = "Mobile number, e.g. +91 98765 43210";
export const PHONE_HINT = "Include the country code for numbers outside India or the UK. We’ll text if the clinic is running late.";

const ALLOWED = /^\+?[\d\s().-]+$/;

/** The clean stored form of a phone number, or null when it isn't a valid number. */
export function normalisePhone(input: string): string | null {
  const text = input.trim();
  if (!text || !ALLOWED.test(text)) return null;

  let plus = text.startsWith("+");
  let body = plus ? text.slice(1) : text;
  // "+44 (0) 7700 900123": the bracketed 0 is the trunk prefix, not part of the number.
  if (plus) body = body.replace(/^\s*(44|91)(\s*[-.]?\s*)\(0\)/, "$1$2");
  let digits = body.replace(/\D/g, "");
  if (!plus && digits.startsWith("00")) {
    // International dialling prefix: 0044…, 0091….
    plus = true;
    digits = digits.slice(2);
  }
  if (!digits) return null;

  if (plus) {
    // Trunk zero after the country code: +44 07700 900123, +91 09876 543210.
    const trunk = /^(44|91)0(\d+)$/.exec(digits);
    if (trunk) digits = `${trunk[1]}${trunk[2]}`;
    if (digits.startsWith("0")) return null;
    return digits.length >= 7 && digits.length <= 15 ? `+${digits}` : null;
  }

  // No "+": work out the country from the shape of the number.
  if (/^[6-9]\d{9}$/.test(digits)) return `+91${digits}`; // 9876543210
  if (/^07\d{9}$/.test(digits)) return `+44${digits.slice(1)}`; // 07700 900123 (UK wins over a 0-prefixed Indian 7xxxx)
  if (/^0[6-9]\d{9}$/.test(digits)) return `+91${digits.slice(1)}`; // 09876543210
  if (/^91[6-9]\d{9}$/.test(digits)) return `+${digits}`; // 919876543210
  if (/^0[123]\d{9}$/.test(digits)) return `+44${digits.slice(1)}`; // 0131 496 0280
  if (/^447\d{9}$/.test(digits)) return `+${digits}`; // 447700900123
  if (digits.length < 7 || digits.length > 15 || digits.startsWith("0")) return null;
  return digits;
}

/** Why a number is rejected, or undefined when it's fine. */
export function validatePhone(input: string): string | undefined {
  if (!input.trim()) return PHONE_REQUIRED_MESSAGE;
  return normalisePhone(input) ? undefined : PHONE_INVALID_MESSAGE;
}

/** Group digits for reading: "98765 43210". */
function groupIndian(national: string): string {
  return `${national.slice(0, 5)} ${national.slice(5)}`;
}

/**
 * A number as people read it. UK mobiles stay "07700 900123", Indian ones become "+91 98765 43210",
 * other numbers show as "+" and digits. Text that isn't a valid number comes back trimmed.
 */
export function formatPhone(input: string): string {
  const stored = normalisePhone(input);
  if (!stored) return input.trim();
  if (/^\+447\d{9}$/.test(stored)) return `0${stored.slice(3, 7)} ${stored.slice(7)}`;
  if (/^\+44[123]\d{9}$/.test(stored)) {
    // Landlines: 0131 496 0280 style for 3-digit area codes.
    const national = stored.slice(3);
    return `0${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`;
  }
  if (/^\+91\d{10}$/.test(stored)) return `+91 ${groupIndian(stored.slice(3))}`;
  return stored;
}

/** Digits worth searching: a number as stored and as it's read, so "07700" and "447700" both match. */
export function phoneSearchText(input: string): string {
  const stored = normalisePhone(input);
  const raw = input.replace(/\D/g, "");
  if (!stored) return raw;
  return `${raw} ${stored.replace(/\D/g, "")} ${formatPhone(input).replace(/\D/g, "")}`;
}
