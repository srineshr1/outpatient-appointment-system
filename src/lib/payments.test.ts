import { describe, expect, it } from "vitest";
import type { AppointmentRecord, ChargeRecord, PaymentEntry } from "./clinic-types";
import { formatMoney, parsePounds } from "./fees";
import { csvCell, dailyTakings, paymentLine, refundableByMethod, summarise, toCsv } from "./payments";

let counter = 0;

function entry(kind: PaymentEntry["kind"], method: PaymentEntry["method"], amountPence: number, at = "2026-10-27T10:00:00.000Z", byName = "Desk"): PaymentEntry {
  counter += 1;
  return { id: `e${counter}`, kind, method, amountPence, at, byUserId: byName === "Online" ? null : `user-${byName}`, byName, note: "" };
}

function charge(amountPence: number, entries: PaymentEntry[] = [], waived = false, appointmentId = "v1"): ChargeRecord {
  return {
    appointmentId,
    reference: "HSP-100001",
    reasonId: "follow",
    amountPence,
    createdAt: "2026-10-27T09:00:00.000Z",
    entries,
    waiver: waived ? { at: "2026-10-27T09:30:00.000Z", byUserId: "user-admin", byName: "Fiona Grant", reason: "Goodwill" } : null,
  };
}

function visit(id: string, doctorId: string, status: AppointmentRecord["status"] = "booked", date = "2026-10-27"): AppointmentRecord {
  return {
    id,
    reference: `HSP-${id}`,
    slotId: `${doctorId}-${date}-0900`,
    doctorId,
    date,
    time: "09:00",
    reasonId: "follow",
    patientName: "Ann Lee",
    patientDob: "",
    patientMobile: "",
    patientChi: "",
    note: "",
    status,
    patientUserId: null,
    createdAt: "2026-10-26T09:00:00.000Z",
  };
}

describe("summarise", () => {
  it("follows a fee from unpaid to paid", () => {
    expect(summarise(null, "booked").state).toBe("none");
    expect(summarise(charge(4000), "booked")).toMatchObject({ state: "unpaid", duePence: 4000 });
    expect(summarise(charge(4000, [entry("payment", "cash", 1500)]), "booked")).toMatchObject({ state: "part_paid", duePence: 2500 });
    expect(summarise(charge(4000, [entry("payment", "cash", 4000)]), "completed")).toMatchObject({ state: "paid", duePence: 0 });
  });

  it("asks for money back on a cancelled visit, and settles once it has gone back", () => {
    const paid = [entry("payment", "desk_card", 4000)];
    expect(summarise(charge(4000, paid), "cancelled")).toMatchObject({ state: "refund_due", refundDuePence: 4000, duePence: 0 });
    expect(summarise(charge(4000, [...paid, entry("refund", "desk_card", 4000)]), "cancelled")).toMatchObject({
      state: "refunded",
      refundDuePence: 0,
    });
    // Cancelled before paying: nothing owed either way.
    expect(summarise(charge(4000), "cancelled")).toMatchObject({ state: "void", duePence: 0, refundDuePence: 0 });
  });

  it("treats a part refund on a live visit as settled, and a waiver as nothing owed", () => {
    const partRefund = charge(4000, [entry("payment", "cash", 4000), entry("refund", "cash", 1000)]);
    expect(summarise(partRefund, "booked")).toMatchObject({ state: "part_refunded", duePence: 0, netPence: 3000 });
    expect(summarise(charge(4000, [], true), "booked")).toMatchObject({ state: "waived", duePence: 0 });
  });

  it("knows how much can go back to each method", () => {
    const entries = [entry("payment", "online_card", 2000), entry("payment", "cash", 2000), entry("refund", "cash", 500)];
    expect(Object.fromEntries(refundableByMethod(entries))).toEqual({ online_card: 2000, cash: 1500 });
    expect(refundableByMethod([entry("payment", "cash", 500), entry("refund", "cash", 500)]).size).toBe(0);
  });

  it("describes the payment in a few words for patients and the clinic book", () => {
    expect(paymentLine(summarise(charge(4000), "booked"))).toBe("£40.00 to pay at the desk");
    expect(paymentLine(summarise(charge(4000, [entry("payment", "online_card", 4000)]), "booked"))).toBe("Paid £40.00");
    expect(paymentLine(summarise(null, "booked"))).toBeNull();
  });
});

describe("daily takings", () => {
  it("adds up a day by method, doctor and member of staff, in UK time", () => {
    const visits = [visit("a", "cho"), visit("b", "reid"), visit("c", "cho", "cancelled")];
    const charges = [
      charge(4000, [entry("payment", "online_card", 4000, "2026-10-27T08:10:00.000Z", "Online")], false, "a"),
      charge(6500, [entry("payment", "cash", 6500, "2026-10-27T11:00:00.000Z", "Desk")], false, "b"),
      charge(
        2500,
        [entry("payment", "cash", 2500, "2026-10-26T15:00:00.000Z", "Desk"), entry("refund", "cash", 2500, "2026-10-27T12:00:00.000Z", "Desk")],
        false,
        "c",
      ),
      // 23:30 UTC on 27 October is 23:30 in London: the clocks went back on the 25th.
      charge(4000, [entry("payment", "desk_card", 4000, "2026-10-27T23:30:00.000Z", "Desk")], false, "a2"),
    ];
    const report = dailyTakings("2026-10-27", charges, visits);
    expect(report.total).toMatchObject({ payments: 3, receivedPence: 14500, refunds: 1, refundedPence: 2500, netPence: 12000 });
    expect(report.byMethod.find((line) => line.key === "cash")).toMatchObject({ receivedPence: 6500, refundedPence: 2500, netPence: 4000 });
    expect(report.cashExpectedPence).toBe(4000);
    expect(report.byStaff.find((line) => line.label === "Online")?.netPence).toBe(4000);
    expect(report.byDoctor.find((line) => line.key === "cho")?.netByMethod).toEqual({ online_card: 4000, desk_card: 0, cash: -2500 });
    // Yesterday's payment isn't today's takings.
    expect(dailyTakings("2026-10-26", charges, visits).total.receivedPence).toBe(2500);
  });

  it("counts a payment just after midnight in summer time on the right day", () => {
    // 23:30 UTC on 1 July is 00:30 on 2 July in London (BST).
    const charges = [charge(4000, [entry("payment", "cash", 4000, "2026-07-01T23:30:00.000Z")], false, "x")];
    expect(dailyTakings("2026-07-02", charges, []).total.receivedPence).toBe(4000);
    expect(dailyTakings("2026-07-01", charges, []).total.receivedPence).toBe(0);
  });
});

describe("CSV", () => {
  it("neutralises spreadsheet formulas and quotes awkward text", () => {
    expect(csvCell("=HYPERLINK(\"http://evil\")")).toBe("\"'=HYPERLINK(\"\"http://evil\"\")\"");
    expect(csvCell("+44 7700")).toBe("'+44 7700");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell("Lee, Ann")).toBe("\"Lee, Ann\"");
    expect(csvCell({ pence: -4050 })).toBe("-40.50");
    expect(toCsv([["a", 1], ["b", { pence: 100 }]])).toBe("a,1\r\nb,1.00\r\n");
  });
});

describe("money", () => {
  it("formats and parses pounds", () => {
    expect(formatMoney(4000)).toBe("£40.00");
    expect(formatMoney(-250)).toBe("−£2.50");
    expect(parsePounds("40")).toBe(4000);
    expect(parsePounds("£40.5")).toBe(4050);
    expect(parsePounds("1,040.00")).toBe(104000);
    expect(parsePounds("40.123")).toBeNull();
    expect(parsePounds("-5")).toBeNull();
    expect(parsePounds("abc")).toBeNull();
  });
});
