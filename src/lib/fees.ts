import { reasons, type Reason } from "./data";

/**
 * Demo fees per visit reason, in pence. Payments here are simulated: no card is charged and no
 * money moves. A visit keeps the fee it was booked at, so changing a fee here only affects new bookings.
 */
export const FEES_PENCE: Readonly<Record<string, number>> = {
  new: 6500,
  follow: 4000,
  meds: 5500,
  bp: 2500,
};

/** The practice's fee for the visit reason, or the doctor's own consultation fee when they set one. */
export function feeFor(reasonId: string, doctorFeePence?: number | null): number {
  if (doctorFeePence && doctorFeePence > 0) return doctorFeePence;
  return FEES_PENCE[reasonId] ?? 0;
}

export function feeTable(): { reason: Reason; pence: number }[] {
  return reasons.map((reason) => ({ reason, pence: feeFor(reason.id) }));
}

const pounds = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

/** "£40.00", or "−£40.00" with a true minus sign. */
export function formatMoney(pence: number): string {
  const text = pounds.format(Math.abs(pence) / 100);
  return pence < 0 ? `−${text}` : text;
}

/** "40.00" for a form field. */
export function penceToInput(pence: number): string {
  return (pence / 100).toFixed(2);
}

/** Parse "40", "40.5", "£40.50" or "1,040.00" to pence. Null when it isn't an amount. */
export function parsePounds(input: string): number | null {
  const clean = input.trim().replace(/^£\s*/, "").replace(/,(?=\d{3}(\D|$))/g, "");
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(clean)) return null;
  const [whole = "0", fraction = ""] = clean.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}
