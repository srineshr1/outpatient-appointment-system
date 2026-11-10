import { describe, expect, it } from "vitest";
import type { ConsultSession } from "./clinic-types";
import { findOrphanedVisits } from "./elastic";
import { slotId, waveSlotId, heldId } from "./sessions";

const at = "2026-10-01T00:00:00.000Z";

/** A stream session: 10:00–12:00 on Mon, Wed, Fri with 20-minute slots. */
function session(patch: Partial<ConsultSession> = {}): ConsultSession {
  return {
    id: "s1",
    doctorId: "doc",
    label: "Morning",
    weekdays: [1, 3, 5],
    startTime: "10:00",
    endTime: "12:00",
    room: "Room 1",
    mode: "stream",
    slotMinutes: 20,
    waveMinutes: null,
    waveCapacity: null,
    archivedAt: null,
    createdAt: at,
    updatedAt: at,
    ...patch,
  };
}

/** A wave session: 10:00–12:00 on Mon, Wed with 60-minute waves holding 3 patients. */
function waveSession(patch: Partial<ConsultSession> = {}): ConsultSession {
  return session({
    id: "w1",
    mode: "wave",
    slotMinutes: null,
    waveMinutes: 60,
    waveCapacity: 3,
    weekdays: [1, 3],
    ...patch,
  });
}

describe("elastic scheduling — schedule expansion", () => {
  it("allows expanding the end time when all bookings are in the original range", () => {
    // Old: 10:00–12:00, booking at 10:40 on Mon 2026-11-09
    const visits = [{ slotId: slotId("doc", "2026-11-09", "10:40"), date: "2026-11-09", time: "10:40" }];
    // New: 10:00–13:00 (expanded end)
    const newSess = session({ startTime: "10:00", endTime: "13:00" });
    const result = findOrphanedVisits(visits, newSess, "doc");
    expect(result.orphaned).toBe(0);
    expect(result.total).toBe(1);
  });

  it("allows expanding the start time earlier", () => {
    // Old: 10:00–12:00, booking at 10:20 on Mon 2026-11-09
    const visits = [{ slotId: slotId("doc", "2026-11-09", "10:20"), date: "2026-11-09", time: "10:20" }];
    // New: 9:00–12:00 (expanded start)
    const newSess = session({ startTime: "09:00", endTime: "12:00" });
    const result = findOrphanedVisits(visits, newSess, "doc");
    expect(result.orphaned).toBe(0);
  });

  it("allows expanding both start and end", () => {
    const visits = [
      { slotId: slotId("doc", "2026-11-09", "10:00"), date: "2026-11-09", time: "10:00" },
      { slotId: slotId("doc", "2026-11-09", "11:40"), date: "2026-11-09", time: "11:40" },
    ];
    // New: 9:00–13:00
    const newSess = session({ startTime: "09:00", endTime: "13:00" });
    const result = findOrphanedVisits(visits, newSess, "doc");
    expect(result.orphaned).toBe(0);
    expect(result.total).toBe(2);
  });

  it("allows adding a weekday", () => {
    // Booking on Wednesday (day 3)
    const visits = [{ slotId: slotId("doc", "2026-11-11", "10:20"), date: "2026-11-11", time: "10:20" }];
    // New session adds Tuesday (day 2) to weekdays
    const newSess = session({ weekdays: [1, 2, 3, 5] });
    const result = findOrphanedVisits(visits, newSess, "doc");
    expect(result.orphaned).toBe(0);
  });
});

describe("elastic scheduling — schedule shrinking (safe)", () => {
  it("allows shrinking the end when no bookings are in the removed range", () => {
    // Old: 10:00–12:00, booking at 10:20 (well before 11:00)
    const visits = [{ slotId: slotId("doc", "2026-11-09", "10:20"), date: "2026-11-09", time: "10:20" }];
    // New: 10:00–11:00 (shrunk end)
    const newSess = session({ startTime: "10:00", endTime: "11:00" });
    const result = findOrphanedVisits(visits, newSess, "doc");
    expect(result.orphaned).toBe(0);
  });

  it("allows shrinking the start when no bookings are in the removed range", () => {
    // Old: 09:00–12:00, booking at 11:00
    const visits = [{ slotId: slotId("doc", "2026-11-09", "11:00"), date: "2026-11-09", time: "11:00" }];
    // New: 10:00–12:00 (shrunk start — removed 09:00–10:00 range)
    const newSess = session({ startTime: "10:00", endTime: "12:00" });
    const result = findOrphanedVisits(visits, newSess, "doc");
    expect(result.orphaned).toBe(0);
  });
});

describe("elastic scheduling — schedule shrinking (blocks orphans)", () => {
  it("blocks shrinking the end when a booking falls outside the new hours", () => {
    // Old: 10:00–12:00, booking at 11:20 (after the new end of 11:00)
    const visits = [{ slotId: slotId("doc", "2026-11-09", "11:20"), date: "2026-11-09", time: "11:20" }];
    // New: 10:00–11:00
    const newSess = session({ startTime: "10:00", endTime: "11:00" });
    const result = findOrphanedVisits(visits, newSess, "doc");
    expect(result.orphaned).toBe(1);
    expect(result.orphanedTimes).toEqual(["2026-11-09 11:20"]);
  });

  it("blocks shrinking the start when a booking falls outside the new hours", () => {
    // Old: 09:00–12:00, booking at 09:20
    const visits = [{ slotId: slotId("doc", "2026-11-09", "09:20"), date: "2026-11-09", time: "09:20" }];
    // New: 10:00–12:00 (shrunk start — removed 09:00–10:00)
    const newSess = session({ startTime: "10:00", endTime: "12:00" });
    const result = findOrphanedVisits(visits, newSess, "doc");
    expect(result.orphaned).toBe(1);
    expect(result.orphanedTimes).toEqual(["2026-11-09 09:20"]);
  });

  it("blocks removing a weekday that has a booking", () => {
    // Booking on Friday (day 5), 2026-11-13 is a Friday
    const visits = [{ slotId: slotId("doc", "2026-11-14", "10:20"), date: "2026-11-14", time: "10:20" }];
    // New session drops Friday (was [1,3,5], now [1,3])
    const newSess = session({ weekdays: [1, 3] });
    const result = findOrphanedVisits(visits, newSess, "doc");
    expect(result.orphaned).toBe(1);
  });

  it("reports mixed: some bookings survive, some are orphaned", () => {
    const visits = [
      { slotId: slotId("doc", "2026-11-09", "10:00"), date: "2026-11-09", time: "10:00" },  // survives
      { slotId: slotId("doc", "2026-11-09", "10:20"), date: "2026-11-09", time: "10:20" },  // survives
      { slotId: slotId("doc", "2026-11-09", "11:00"), date: "2026-11-09", time: "11:00" },  // orphaned
      { slotId: slotId("doc", "2026-11-09", "11:40"), date: "2026-11-09", time: "11:40" },  // orphaned
    ];
    // Shrink from 10:00–12:00 to 10:00–11:00
    const newSess = session({ startTime: "10:00", endTime: "11:00" });
    const result = findOrphanedVisits(visits, newSess, "doc");
    expect(result.total).toBe(4);
    expect(result.orphaned).toBe(2);
    expect(result.orphanedTimes).toEqual(["2026-11-09 11:00", "2026-11-09 11:40"]);
  });
});

describe("elastic scheduling — wave sessions", () => {
  it("allows expanding a wave session's hours", () => {
    // Wave booking: held as "w-w1-2026-11-09-1000#1"
    const waveId = waveSlotId("w1", "2026-11-09", "10:00");
    const visits = [{ slotId: heldId(waveId, 1), date: "2026-11-09", time: "10:00" }];
    // Expand: 09:00–12:00
    const newSess = waveSession({ startTime: "09:00", endTime: "12:00" });
    const result = findOrphanedVisits(visits, newSess, "doc");
    expect(result.orphaned).toBe(0);
  });

  it("blocks shrinking a wave session when a wave is removed", () => {
    // Wave booking in the 11:00–12:00 wave
    const waveId = waveSlotId("w1", "2026-11-09", "11:00");
    const visits = [{ slotId: heldId(waveId, 2), date: "2026-11-09", time: "11:00" }];
    // Shrink: 10:00–11:00 (removes the 11:00–12:00 wave)
    const newSess = waveSession({ startTime: "10:00", endTime: "11:00" });
    const result = findOrphanedVisits(visits, newSess, "doc");
    expect(result.orphaned).toBe(1);
  });

  it("allows shrinking a wave session when the booked wave survives", () => {
    // Wave booking in the 10:00–11:00 wave
    const waveId = waveSlotId("w1", "2026-11-09", "10:00");
    const visits = [{ slotId: heldId(waveId, 3), date: "2026-11-09", time: "10:00" }];
    // Shrink: 10:00–11:00 (keeps the 10:00 wave)
    const newSess = waveSession({ startTime: "10:00", endTime: "11:00" });
    const result = findOrphanedVisits(visits, newSess, "doc");
    expect(result.orphaned).toBe(0);
  });
});

describe("elastic scheduling — slot length changes", () => {
  it("blocks a slot length change that removes a booked slot's time", () => {
    // Old: 20-min slots → 10:00, 10:20, 10:40, 11:00, 11:20, 11:40
    // Booking at 10:20
    const visits = [{ slotId: slotId("doc", "2026-11-09", "10:20"), date: "2026-11-09", time: "10:20" }];
    // New: 30-min slots → 10:00, 10:30, 11:00, 11:30
    // 10:20 no longer exists as a slot boundary
    const newSess = session({ slotMinutes: 30 });
    const result = findOrphanedVisits(visits, newSess, "doc");
    expect(result.orphaned).toBe(1);
  });

  it("allows a slot length change when all booked slots still align", () => {
    // Booking at 10:00 — this is a slot boundary in both 20-min and 30-min
    const visits = [{ slotId: slotId("doc", "2026-11-09", "10:00"), date: "2026-11-09", time: "10:00" }];
    // 30-min slots: 10:00 is still a valid slot start
    const newSess = session({ slotMinutes: 30 });
    const result = findOrphanedVisits(visits, newSess, "doc");
    expect(result.orphaned).toBe(0);
  });
});

describe("elastic scheduling — empty bookings", () => {
  it("returns zero for everything when there are no bookings", () => {
    const result = findOrphanedVisits([], session(), "doc");
    expect(result).toEqual({ total: 0, orphaned: 0, orphanedTimes: [] });
  });
});

describe("elastic scheduling — multiple dates", () => {
  it("checks bookings across multiple dates independently", () => {
    const visits = [
      { slotId: slotId("doc", "2026-11-09", "10:00"), date: "2026-11-09", time: "10:00" },  // Mon, survives
      { slotId: slotId("doc", "2026-11-11", "11:40"), date: "2026-11-11", time: "11:40" },  // Wed, orphaned
    ];
    // Shrink to 10:00–11:00
    const newSess = session({ startTime: "10:00", endTime: "11:00" });
    const result = findOrphanedVisits(visits, newSess, "doc");
    expect(result.total).toBe(2);
    expect(result.orphaned).toBe(1);
    expect(result.orphanedTimes).toEqual(["2026-11-11 11:40"]);
  });
});
