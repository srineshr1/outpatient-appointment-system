import { describe, expect, it } from "vitest";
import {
  addDays,
  addMinutes,
  isIsoDate,
  londonToInstant,
  londonWallClock,
  mondayOf,
  now,
  setNow,
  todayIso,
} from "./clock";

describe("clock", () => {
  it("runs in a non-London host time zone, so these tests prove TZ independence", () => {
    expect(process.env.TZ).toBe("Asia/Kolkata");
  });

  it("can be pinned and released", () => {
    setNow(Date.UTC(2026, 9, 26, 13, 40));
    expect(now().toISOString()).toBe("2026-10-26T13:40:00.000Z");
    setNow(null);
    expect(Math.abs(now().getTime() - Date.now())).toBeLessThan(1000);
  });

  it("reads London wall time in GMT and in BST", () => {
    expect(londonWallClock(new Date("2026-01-15T09:00:00Z")).time).toBe("09:00");
    expect(londonWallClock(new Date("2026-07-15T09:00:00Z")).time).toBe("10:00");
  });

  it("uses the London date, not the host date, near midnight", () => {
    // 23:30 UTC on 1 March is already 2 March in Kolkata, but still 1 March in London.
    expect(todayIso(new Date("2026-03-01T23:30:00Z"))).toBe("2026-03-01");
  });

  it("converts London wall time to the correct instant either side of the clock change", () => {
    expect(londonToInstant("2026-10-24", "09:00").toISOString()).toBe("2026-10-24T08:00:00.000Z");
    expect(londonToInstant("2026-10-26", "09:00").toISOString()).toBe("2026-10-26T09:00:00.000Z");
    expect(londonToInstant("2026-03-30", "14:20").toISOString()).toBe("2026-03-30T13:20:00.000Z");
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
