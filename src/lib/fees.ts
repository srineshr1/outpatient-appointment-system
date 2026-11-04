import { reasons, type Reason } from "./data";

/** The practice bills in Indian rupees. Amounts are whole minor units (paise), as the payment provider expects. */
export const CURRENCY = "INR";

/**
 * The practice's fallback fee per visit reason, in paise, for a doctor with no consultation fee of
 * their own. A doctor's fee (clinic_doctor_fees, set from their profile) is the source of truth
 * when there is one. A visit keeps the fee it was booked at, so changing a fee only affects new bookings.
 */
export const FEES_PENCE: Readonly<Record<string, number>> = {
  new: 60000,
  follow: 40000,
  meds: 50000,
  bp: 25000,
};

/** The practice's fee for the visit reason, or the doctor's own consultation fee when they set one. */
export function feeFor(reasonId: string, doctorFeePence?: number | null): number {
  // A stored fee of 0 is a real choice (the doctor sees patients free of charge), not "unset".
  if (typeof doctorFeePence === "number" && doctorFeePence >= 0) return doctorFeePence;
  return FEES_PENCE[reasonId] ?? 0;
}

export function feeTable(): { reason: Reason; pence: number }[] {
  return reasons.map((reason) => ({ reason, pence: feeFor(reason.id) }));
}

const rupees = new Intl.NumberFormat("en-IN", { style: "currency", currency: CURRENCY });

/** The currency symbol, for form labels. */
export const CURRENCY_SYMBOL = "₹";

/** "₹400.00", or "−₹400.00" with a true minus sign. */
export function formatMoney(pence: number): string {
  const text = rupees.format(Math.abs(pence) / 100);
  return pence < 0 ? `−${text}` : text;
}

/** "40.00" for a form field. */
export function penceToInput(pence: number): string {
  return (pence / 100).toFixed(2);
}

/** Parse "400", "400.5", "₹400.50" or "1,040.00" to pence. Null when it isn't an amount. */
export function parsePounds(input: string): number | null {
  const clean = input.trim().replace(/^[£₹]\s*/, "").replace(/,(?=\d{3}(\D|$))/g, "");
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(clean)) return null;
  const [whole = "0", fraction = ""] = clean.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}
