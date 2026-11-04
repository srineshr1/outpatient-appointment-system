import { describe, expect, it } from "vitest";
import type { ConsultSession } from "./clinic-types";
import {
  applyHeld,
  baseSlotId,
  checkSession,
  freeToken,
  heldId,
  placesLabel,
  remainingPlaces,
  sessionBlocks,
  slotsForSession,
  slotTimeLabel,
  tokenOfHeld,
  waveSlotId,
} from "./sessions";

const at = "2026-10-01T00:00:00.000Z";

function session(patch: Partial<ConsultSession> = {}): ConsultSession {
  return {
    id: "s1",
    doctorId: "doc",
    label: "Morning",
    weekdays: [1, 2, 3, 4, 5],
    startTime: "09:00",
    endTime: "11:00",
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

const wave = (patch: Partial<ConsultSession> = {}) =>
  session({ id: "w1", mode: "wave", slotMinutes: null, waveMinutes: 60, waveCapacity: 3, ...patch });

describe("stream slots", () => {
  it("cuts a session into fixed slots of the chosen length", () => {
    expect(sessionBlocks(session())).toHaveLength(6);
    expect(sessionBlocks(session({ slotMinutes: 15 }))).toHaveLength(8);
    expect(sessionBlocks(session({ slotMinutes: 30 }))[1]).toEqual({ time: "09:30", endTime: "10:00" });
  });

  it("drops a last slot that would run past the end", () => {
    const blocks = sessionBlocks(session({ startTime: "09:00", endTime: "10:50", slotMinutes: 20 }));
    expect(blocks.at(-1)).toEqual({ time: "10:20", endTime: "10:40" });
  });

  it("only makes slots on the chosen weekdays, one id per slot", () => {
    // 2026-10-26 is a Monday; the week has 5 weekdays.
    const slots = slotsForSession(session({ weekdays: [2, 4] }), "doc", "2026-10-26", "2026-11-01");
    expect(slots).toHaveLength(2 * 6);
    expect(new Set(slots.map((slot) => slot.id)).size).toBe(slots.length);
    expect(slots.every((slot) => slot.mode === "stream" && slot.id.startsWith("doc-2026-10-"))).toBe(true);
  });

  it("makes nothing for an archived session", () => {
    expect(slotsForSession(session({ archivedAt: at }), "doc", "2026-10-26", "2026-11-01")).toEqual([]);
  });

  it("marks a held slot taken and leaves the rest", () => {
    const slots = slotsForSession(session(), "doc", "2026-10-26", "2026-10-26");
    const marked = applyHeld(slots, [slots[1]!.id]);
    expect(marked.filter((slot) => slot.taken).map((slot) => slot.id)).toEqual([slots[1]!.id]);
    expect(placesLabel(marked[1]!)).toBe("");
  });
});

describe("wave capacity", () => {
  const slots = slotsForSession(wave(), "doc", "2026-10-26", "2026-10-26");

  it("cuts the session into waves with a capacity", () => {
    expect(slots.map((slot) => [slot.time, slot.endTime, slot.capacity])).toEqual([
      ["09:00", "10:00", 3],
      ["10:00", "11:00", 3],
    ]);
    expect(slots[0]!.id).toBe(waveSlotId("w1", "2026-10-26", "09:00"));
    expect(slotTimeLabel(slots[0]!)).toBe("09:00–10:00");
  });

  it("counts places left and is full only at capacity", () => {
    const first = slots[0]!;
    const one = applyHeld(slots, [heldId(first.id, 1)])[0]!;
    expect(one).toMatchObject({ booked: 1, taken: false });
    expect(remainingPlaces(one)).toBe(2);
    expect(placesLabel(one)).toBe("2 of 3 places left");
    const full = applyHeld(slots, [1, 2, 3].map((token) => heldId(first.id, token)))[0]!;
    expect(full.taken).toBe(true);
    expect(placesLabel(full)).toBe("Full");
  });

  it("hands out the lowest free token and none once full", () => {
    const id = slots[0]!.id;
    expect(freeToken(id, 3, [])).toBe(1);
    expect(freeToken(id, 3, [heldId(id, 1), heldId(id, 3)])).toBe(2);
    expect(freeToken(id, 3, [1, 2, 3].map((token) => heldId(id, token)))).toBeNull();
    // Tokens held in another wave don't count.
    expect(freeToken(id, 3, [heldId(slots[1]!.id, 1)])).toBe(1);
  });

  it("reads a held id back into wave and token", () => {
    const held = heldId("w-s1-2026-10-26-0900", 4);
    expect(baseSlotId(held)).toBe("w-s1-2026-10-26-0900");
    expect(tokenOfHeld(held)).toBe(4);
    expect(tokenOfHeld("doc-2026-10-26-0900")).toBeNull();
  });
});

describe("checkSession", () => {
  const input = {
    label: "Clinic",
    weekdays: [1, 3],
    startTime: "09:00",
    endTime: "12:00",
    room: "Room 2",
    mode: "stream",
    slotMinutes: 20,
  };

  it("accepts a stream and a wave and normalises the days", () => {
    const stream = checkSession({ ...input, weekdays: [3, 1, 3] }, []);
    expect(stream.ok && stream.value.weekdays).toEqual([1, 3]);
    const waves = checkSession({ ...input, mode: "wave", waveMinutes: 60, waveCapacity: 5 }, []);
    expect(waves).toMatchObject({ ok: true, value: { mode: "wave", waveMinutes: 60, waveCapacity: 5, slotMinutes: null } });
  });

  it("refuses bad timings and capacities", () => {
    expect(checkSession({ ...input, slotMinutes: 25 }, []).ok).toBe(false);
    expect(checkSession({ ...input, endTime: "09:10" }, []).ok).toBe(false);
    expect(checkSession({ ...input, endTime: "08:00" }, []).ok).toBe(false);
    expect(checkSession({ ...input, weekdays: [] }, []).ok).toBe(false);
    expect(checkSession({ ...input, mode: "wave", waveMinutes: 60, waveCapacity: 0 }, []).ok).toBe(false);
    expect(checkSession({ ...input, mode: "wave", waveMinutes: 60, waveCapacity: 99 }, []).ok).toBe(false);
    expect(checkSession({ ...input, mode: "wave", waveMinutes: 20, waveCapacity: 4 }, []).ok).toBe(false);
    expect(checkSession({ ...input, mode: "other" }, []).ok).toBe(false);
  });

  it("refuses a session that overlaps another on a shared day", () => {
    const clash = checkSession({ ...input, startTime: "11:00", endTime: "13:00" }, [session({ weekdays: [3], startTime: "10:00", endTime: "12:00" })]);
    expect(clash.ok).toBe(false);
    const fine = checkSession({ ...input, startTime: "12:00", endTime: "13:00" }, [session({ weekdays: [3], startTime: "10:00", endTime: "12:00" })]);
    expect(fine.ok).toBe(true);
    const otherDay = checkSession({ ...input, startTime: "11:00", endTime: "13:00" }, [session({ weekdays: [2], startTime: "10:00", endTime: "12:00" })]);
    expect(otherDay.ok).toBe(true);
  });
});
