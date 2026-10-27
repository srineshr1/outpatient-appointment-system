import { describe, expect, it } from "vitest";
import {
  ageLabel,
  formatFull,
  formatPhone,
  formatWeekRange,
  formatWhen,
  monogram,
  relativeDay,
} from "./format";
import { buildIcs } from "./ics";
import { EMPTY_FORM, validatePatient } from "./validate";

describe("format", () => {
  it("formats dates", () => {
    expect(formatFull("2026-10-29")).toBe("Thursday 29 October 2026");
    expect(formatWeekRange("2026-10-26")).toBe("26–30 October 2026");
    expect(formatWeekRange("2026-11-30")).toBe("30 November – 4 December 2026");
    expect(formatWeekRange("2026-12-28")).toBe("28 December 2026 – 1 January 2027");
  });

  it("uses relative day names", () => {
    expect(relativeDay("2026-10-26", "2026-10-26")).toBe("Today");
    expect(relativeDay("2026-10-27", "2026-10-26")).toBe("Tomorrow");
    expect(formatWhen({ date: "2026-10-29", time: "14:20" }, "2026-10-26")).toBe("Thu 29 Oct, 14:20");
  });

  it("formats people", () => {
    expect(monogram("Dr Amara Adeyemi")).toBe("AA");
    expect(ageLabel("1980-10-27", "2026-10-26")).toBe("45 years old");
    expect(ageLabel("1980-10-26", "2026-10-26")).toBe("46 years old");
    expect(ageLabel("2026-01-01", "2026-10-26")).toBe("Under 1 year old");
    expect(formatPhone("+44 7700 900123")).toBe("07700 900123");
    expect(formatPhone(" 0131 496 0280 ")).toBe("0131 496 0280");
  });

});

describe("validatePatient", () => {
  const today = "2026-10-26";
  const valid = {
    ...EMPTY_FORM,
    name: "Ann Lee",
    dob: "1980-03-14",
    mobile: "07700 900123",
    reasonId: "new",
  };

  it("accepts a complete form", () => {
    expect(validatePatient(valid, today)).toEqual({});
    expect(validatePatient({ ...valid, mobile: "+447700900123", chi: "1403801234" }, today)).toEqual({});
  });

  it("reports every missing field", () => {
    expect(Object.keys(validatePatient(EMPTY_FORM, today))).toEqual(["name", "dob", "mobile", "reasonId"]);
  });

  it("rejects future and implausible dates of birth", () => {
    expect(validatePatient({ ...valid, dob: "2026-10-27" }, today).dob).toMatch(/future/);
    expect(validatePatient({ ...valid, dob: "1899-12-31" }, today).dob).toMatch(/1900/);
  });

  it("checks mobiles and CHI numbers", () => {
    expect(validatePatient({ ...valid, mobile: "0131 496 0280" }, today).mobile).toMatch(/UK mobile/);
    expect(validatePatient({ ...valid, chi: "12345" }, today).chi).toMatch(/10 digits/);
    expect(validatePatient({ ...valid, chi: "0101801234" }, today).chi).toMatch(/match/);
  });

  it("limits the note", () => {
    expect(validatePatient({ ...valid, note: "x".repeat(201) }, today).note).toBeDefined();
  });
});

describe("buildIcs", () => {
  const event = {
    reference: "HSP-4821",
    doctorName: "Dr Amara Adeyemi",
    room: "Room 2",
    time: "14:20",
    minutes: 15,
    reasonLabel: "A new concern",
  };
  const stamp = new Date("2026-10-26T13:40:00Z");

  it("writes GMT times as UTC", () => {
    const ics = buildIcs({ ...event, date: "2026-10-29" }, stamp);
    expect(ics).toContain("DTSTART:20261029T142000Z");
    expect(ics).toContain("DTEND:20261029T143500Z");
    expect(ics).toContain("DTSTAMP:20261026T134000Z");
  });

  it("converts British Summer Time to UTC", () => {
    const ics = buildIcs({ ...event, date: "2026-07-15" }, stamp);
    expect(ics).toContain("DTSTART:20260715T132000Z");
  });

  it("uses CRLF, escapes text and folds long lines", () => {
    const ics = buildIcs({ ...event, date: "2026-10-29" }, stamp);
    expect(ics.endsWith("\r\n")).toBe(true);
    expect(ics).toContain("LOCATION:Halden Street Practice\\, 14 Halden Street\\, Edinburgh EH8 9RL");
    for (const line of ics.split("\r\n")) expect(line.length).toBeLessThanOrEqual(75);
  });
});
