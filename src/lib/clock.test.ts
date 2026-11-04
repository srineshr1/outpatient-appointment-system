import { describe, expect, it } from "vitest";
import {
  addDays,
  addMinutes,
  isIsoDate,
  practiceToInstant,
  practiceWallClock,
  mondayOf,
  now,
  setNow,
  todayIso,
} from "./clock";

describe("clock", () => {
  it("runs in a non-IST host time zone, so these tests prove TZ independence", () => {
    expect(process.env.TZ).toBe("America/New_York");
  });

  it("can be pinned and released", () => {
    setNow(Date.UTC(2026, 9, 26, 13, 40));
    expect(now().toISOString()).toBe("2026-10-26T13:40:00.000Z");
    setNow(null);
    expect(Math.abs(now().getTime() - Date.now())).toBeLessThan(1000);
  });

  it("reads IST wall time (UTC+5:30, no daylight saving)", () => {
    expect(practiceWallClock(new Date("2026-01-15T09:00:00Z")).time).toBe("14:30");
    expect(practiceWallClock(new Date("2026-07-15T09:00:00Z")).time).toBe("14:30");
  });

  it("uses the IST date, not the UTC or host date, near midnight", () => {
    // 18:45 UTC on 1 March is already 00:15 on 2 March in India.
    expect(todayIso(new Date("2026-03-01T18:45:00Z"))).toBe("2026-03-02");
    expect(todayIso(new Date("2026-03-01T18:15:00Z"))).toBe("2026-03-01");
  });

  it("converts IST wall time to the instant it names, in any season", () => {
    expect(practiceToInstant("2026-10-24", "09:00").toISOString()).toBe("2026-10-24T03:30:00.000Z");
    expect(practiceToInstant("2026-07-15", "09:00").toISOString()).toBe("2026-07-15T03:30:00.000Z");
    expect(practiceToInstant("2026-11-05", "00:10").toISOString()).toBe("2026-11-04T18:40:00.000Z");
  });

  it("does date arithmetic without drifting across months and years", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(mondayOf("2026-11-01")).toBe("2026-10-26");
    expect(mondayOf("2026-10-26")).toBe("2026-10-26");
    expect(addMinutes("09:50", 15)).toBe("10:05");
  });

  it("validates ISO dates strictly", () => {
    expect(isIsoDate("2026-02-29")).toBe(false);
    expect(isIsoDate("2028-02-29")).toBe(true);
    expect(isIsoDate("26-10-2026")).toBe(false);
    expect(isIsoDate(undefined)).toBe(false);
  });
});
