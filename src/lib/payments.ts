/**
 * Simulated payments: how much each visit owes, what was paid and refunded, and the day's takings.
 * Pure functions over the stored records, so the admin pages and the tests share one set of rules.
 */
import type { AppointmentRecord, AppointmentStatus, ChargeRecord, PaymentEntry, PaymentMethod } from "./clinic-types";
import { PAYMENT_METHODS } from "./clinic-types";
import { londonWallClock } from "./clock";
import { findDoctor } from "./data";
import { formatMoney } from "./fees";

export type PaymentState =
  | "none"
  | "unpaid"
  | "part_paid"
  | "paid"
  | "part_refunded"
  | "refunded"
  | "refund_due"
  | "waived"
  | "void";

export const STATE_LABELS: Record<PaymentState, string> = {
  none: "No fee recorded",
  unpaid: "Unpaid",
  part_paid: "Part-paid",
  paid: "Paid",
  part_refunded: "Part refunded",
  refunded: "Refunded",
  refund_due: "Refund due",
  waived: "Waived",
  void: "No charge",
};

export const METHOD_LABELS: Record<PaymentMethod, string> = {
  online_card: "Online card (demo)",
  desk_card: "Card at the desk",
  cash: "Cash",
};

export interface ChargeSummary {
  state: PaymentState;
  feePence: number;
  paidPence: number;
  refundedPence: number;
  netPence: number;
  /** Still to collect. */
  duePence: number;
  /** Paid but should go back: the visit was cancelled, or more than the fee was taken. */
  refundDuePence: number;
}

export function totals(entries: readonly PaymentEntry[]): { paidPence: number; refundedPence: number; netPence: number } {
  let paidPence = 0;
  let refundedPence = 0;
  for (const entry of entries) {
    if (entry.kind === "payment") paidPence += entry.amountPence;
    else refundedPence += entry.amountPence;
  }
  return { paidPence, refundedPence, netPence: paidPence - refundedPence };
}

const NONE: ChargeSummary = {
  state: "none",
  feePence: 0,
  paidPence: 0,
  refundedPence: 0,
  netPence: 0,
  duePence: 0,
  refundDuePence: 0,
};

export function summarise(charge: ChargeRecord | null | undefined, status: AppointmentStatus): ChargeSummary {
  if (!charge) return NONE;
  const { paidPence, refundedPence, netPence } = totals(charge.entries);
  const base = { feePence: charge.amountPence, paidPence, refundedPence, netPence, duePence: 0, refundDuePence: 0 };

  if (status === "cancelled") {
    if (netPence > 0) return { ...base, state: "refund_due", refundDuePence: netPence };
    if (paidPence > 0) return { ...base, state: "refunded" };
    return { ...base, state: charge.waiver ? "waived" : "void" };
  }
  const overpaid = Math.max(0, netPence - charge.amountPence);
  if (charge.waiver) return { ...base, state: "waived", refundDuePence: Math.max(0, netPence) };
  if (charge.amountPence <= 0) return { ...base, state: "void", refundDuePence: overpaid };
  if (netPence >= charge.amountPence) return { ...base, state: "paid", refundDuePence: overpaid };
  // Money went back on a visit that's still on: the practice settled it, so nothing more is chased.
  if (refundedPence > 0) return { ...base, state: netPence > 0 ? "part_refunded" : "refunded" };
  if (paidPence === 0) return { ...base, state: "unpaid", duePence: charge.amountPence };
  return { ...base, state: "part_paid", duePence: charge.amountPence - netPence };
}

/** A few words for the patient's list and the clinic book: "Paid £40.00", "£40.00 to pay at the desk". */
export function paymentLine(money: ChargeSummary): string | null {
  const pounds = (pence: number) => formatMoney(pence);
  switch (money.state) {
    case "unpaid":
      return `${pounds(money.duePence)} to pay at the desk`;
    case "part_paid":
      return `${pounds(money.duePence)} still to pay`;
    case "paid":
      return `Paid ${pounds(money.netPence)}`;
    case "part_refunded":
      return `${pounds(money.refundedPence)} refunded`;
    case "refunded":
      return `Refunded ${pounds(money.refundedPence)}`;
    case "refund_due":
      return `${pounds(money.refundDuePence)} to be refunded`;
    case "waived":
      return "Fee waived";
    default:
      return null;
  }
}

/** What can still be refunded to each method: payments less refunds already made that way. */
export function refundableByMethod(entries: readonly PaymentEntry[]): Map<PaymentMethod, number> {
  const balance = new Map<PaymentMethod, number>();
  for (const entry of entries) {
    const sign = entry.kind === "payment" ? 1 : -1;
    balance.set(entry.method, (balance.get(entry.method) ?? 0) + sign * entry.amountPence);
  }
  for (const [method, pence] of balance) if (pence <= 0) balance.delete(method);
  return balance;
}

export interface LedgerRow {
  entry: PaymentEntry;
  charge: ChargeRecord;
  visit: AppointmentRecord | null;
}

/** Every payment and refund, newest first. */
export function ledger(charges: readonly ChargeRecord[], visitsById: ReadonlyMap<string, AppointmentRecord>): LedgerRow[] {
  const rows: LedgerRow[] = [];
  for (const charge of charges) {
    for (const entry of charge.entries) rows.push({ entry, charge, visit: visitsById.get(charge.appointmentId) ?? null });
  }
  return rows.sort((a, b) => (a.entry.at === b.entry.at ? b.entry.id.localeCompare(a.entry.id) : b.entry.at.localeCompare(a.entry.at)));
}

/** The London calendar day an instant falls on. */
export function londonDay(iso: string): string {
  return londonWallClock(new Date(iso)).date;
}

export interface TakingsLine {
  key: string;
  label: string;
  payments: number;
  receivedPence: number;
  refunds: number;
  refundedPence: number;
  netPence: number;
}

export interface DoctorTakings extends TakingsLine {
  netByMethod: Record<PaymentMethod, number>;
}

export interface DailyTakings {
  date: string;
  rows: LedgerRow[];
  total: TakingsLine;
  byMethod: TakingsLine[];
  byDoctor: DoctorTakings[];
  byStaff: TakingsLine[];
  /** Cash taken less cash given back: what should be in the drawer. */
  cashExpectedPence: number;
  /** Visits on that day marked complete. */
  visitsSeen: number;
}

function emptyLine(key: string, label: string): TakingsLine {
  return { key, label, payments: 0, receivedPence: 0, refunds: 0, refundedPence: 0, netPence: 0 };
}

function add(line: TakingsLine, entry: PaymentEntry): void {
  if (entry.kind === "payment") {
    line.payments += 1;
    line.receivedPence += entry.amountPence;
    line.netPence += entry.amountPence;
  } else {
    line.refunds += 1;
    line.refundedPence += entry.amountPence;
    line.netPence -= entry.amountPence;
  }
}

function zeroByMethod(): Record<PaymentMethod, number> {
  return { online_card: 0, desk_card: 0, cash: 0 };
}

export function dailyTakings(
  date: string,
  charges: readonly ChargeRecord[],
  visits: readonly AppointmentRecord[],
): DailyTakings {
  const visitsById = new Map(visits.map((visit) => [visit.id, visit]));
  const rows = ledger(charges, visitsById).filter((row) => londonDay(row.entry.at) === date);
  const total = emptyLine("total", "Total");
  const methods = new Map(PAYMENT_METHODS.map((method) => [method, emptyLine(method, METHOD_LABELS[method])]));
  const byDoctor = new Map<string, DoctorTakings>();
  const byStaff = new Map<string, TakingsLine>();

  for (const row of rows) {
    add(total, row.entry);
    add(methods.get(row.entry.method)!, row.entry);

    const doctorId = row.visit?.doctorId ?? "unknown";
    const doctorName = findDoctor(doctorId)?.name ?? "Visit not found";
    const doctorLine = byDoctor.get(doctorId) ?? { ...emptyLine(doctorId, doctorName), netByMethod: zeroByMethod() };
    add(doctorLine, row.entry);
    doctorLine.netByMethod[row.entry.method] += row.entry.kind === "payment" ? row.entry.amountPence : -row.entry.amountPence;
    byDoctor.set(doctorId, doctorLine);

    const staffKey = row.entry.byUserId ?? `name:${row.entry.byName}`;
    const staffLine = byStaff.get(staffKey) ?? emptyLine(staffKey, row.entry.byName || "Unknown");
    add(staffLine, row.entry);
    byStaff.set(staffKey, staffLine);
  }

  const cash = methods.get("cash")!;
  const byNet = (a: TakingsLine, b: TakingsLine) => b.netPence - a.netPence || a.label.localeCompare(b.label);
  return {
    date,
    rows,
    total,
    byMethod: [...methods.values()],
    byDoctor: [...byDoctor.values()].sort(byNet),
    byStaff: [...byStaff.values()].sort(byNet),
    cashExpectedPence: cash.netPence,
    visitsSeen: visits.filter((visit) => visit.date === date && visit.status === "completed").length,
  };
}

/* ---------- CSV ---------- */

/** An amount column: written as a plain number of pounds, like "-40.00". */
export interface CsvAmount {
  pence: number;
}

export type CsvValue = string | number | CsvAmount;

/**
 * One CSV cell. Text that a spreadsheet would run as a formula (it starts with = + - @ or a
 * control character) gets a leading apostrophe, because patient names are typed by patients.
 */
export function csvCell(value: CsvValue): string {
  if (typeof value === "number") return String(value);
  if (typeof value === "object") return (value.pence / 100).toFixed(2);
  let text = value;
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: readonly (readonly CsvValue[])[]): string {
  return `${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}
