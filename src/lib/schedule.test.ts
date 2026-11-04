import { describe, expect, it } from "vitest";
import { bookWindow, doctors, firstWeekFor, generateSlots } from "./data";
import { canShiftWeek, clampWeek, nextOpening, slotStatus } from "./schedule";

const monday1340 = new Date("2026-10-26T08:10:00Z"); // 13:40 IST

describe("book window", () => {
  it("opens on this week on a weekday and next week at the weekend", () => {
    expect(firstWeekFor("2026-10-28")).toBe("2026-10-26");
    expect(firstWeekFor("2026-10-31")).toBe("2026-11-02");
    expect(firstWeekFor("2026-11-01")).toBe("2026-11-02");
  });

  it("covers four weeks", () => {
    expect(bookWindow(monday1340)).toEqual({ today: "2026-10-26", firstWeek: "2026-10-26", lastWeek: "2026-11-16" });
  });
});

describe("generateSlots", () => {
  const window = bookWindow(monday1340);
  const slots = generateSlots(window);

  it("is deterministic", () => {
    expect(generateSlots(window)).toEqual(slots);
  });

  it("only produces weekday slots inside the window with unique ids", () => {
    expect(new Set(slots.map((slot) => slot.id)).size).toBe(slots.length);
    for (const slot of slots) {
      expect(slot.date >= window.firstWeek && slot.date <= "2026-11-20").toBe(true);
      expect([0, 6]).not.toContain(new Date(`${slot.date}T12:00:00Z`).getUTCDay());
    }
  });

  it("gives every doctor something to book", () => {
    for (const doctor of doctors) {
      expect(nextOpening(slots, doctor.id, [], monday1340), doctor.id).not.toBeNull();
    }
  });

  it("only marks the registrar's sessions as teaching", () => {
    const teaching = slots.filter((slot) => slot.teaching);
    expect(teaching.length).toBeGreaterThan(0);
    expect(teaching.every((slot) => slot.doctorId === "macleod")).toBe(true);
  });
});

describe("slotStatus", () => {
  const base = { id: "x", doctorId: "cho", date: "2026-10-26", time: "15:10" };

  it("closes times that have started", () => {
    expect(slotStatus({ ...base, time: "13:40" }, [], monday1340)).toBe("past");
    expect(slotStatus({ ...base, time: "13:50" }, [], monday1340)).toBe("open");
  });

  it("closes same-day booking at 16:00", () => {
    const at1600 = new Date("2026-10-26T10:30:00Z"); // 16:00 IST
    expect(slotStatus({ ...base, time: "16:10" }, [], at1600)).toBe("past");
    expect(slotStatus({ ...base, date: "2026-10-27" }, [], at1600)).toBe("open");
  });

  it("respects taken flags, session bookings and teaching", () => {
    expect(slotStatus({ ...base, taken: true }, [], monday1340)).toBe("taken");
    expect(slotStatus(base, ["x"], monday1340)).toBe("taken");
    expect(slotStatus({ ...base, teaching: true }, [], monday1340)).toBe("teaching");
  });

  it("uses India time: at 11:17 IST this morning's 09:00 is past, not open", () => {
    const lateMorning = new Date("2026-11-04T05:47:00Z"); // 11:17 IST, still 05:47 in London
    expect(slotStatus({ ...base, date: "2026-11-04", time: "09:00" }, [], lateMorning)).toBe("past");
    expect(slotStatus({ ...base, date: "2026-11-04", time: "11:10" }, [], lateMorning)).toBe("past");
    expect(slotStatus({ ...base, date: "2026-11-04", time: "11:20" }, [], lateMorning)).toBe("open");
  });

  it("rolls over to the next day at IST midnight", () => {
    const justAfterMidnight = new Date("2026-11-04T18:35:00Z"); // 00:05 IST on 5 November
    expect(slotStatus({ ...base, date: "2026-11-04", time: "17:00" }, [], justAfterMidnight)).toBe("past");
    expect(slotStatus({ ...base, date: "2026-11-05", time: "09:00" }, [], justAfterMidnight)).toBe("open");
  });
});

describe("weeks", () => {
  const window = bookWindow(monday1340);

  it("clamps requests to a Monday inside the window", () => {
    expect(clampWeek(null, window)).toBe("2026-10-26");
    expect(clampWeek("2026-11-11", window)).toBe("2026-11-09");
    expect(clampWeek("2025-01-01", window)).toBe("2026-10-26");
    expect(clampWeek("2027-01-01", window)).toBe("2026-11-16");
  });

  it("knows when the week can move", () => {
    expect(canShiftWeek("2026-10-26", -1, window)).toBe(false);
    expect(canShiftWeek("2026-10-26", 1, window)).toBe(true);
    expect(canShiftWeek("2026-11-16", 1, window)).toBe(false);
  });
});
