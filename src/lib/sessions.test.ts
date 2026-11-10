import { describe, expect, it } from "vitest";
import type { ConsultSession } from "./clinic-types";
import {
  describeSession,
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
  stepMinutes,
  modeSummary,
  overriddenDates,
  sessionCalendar,
  weekHourBounds,
  weekRangeTitle,
  firstRunDate,
  timesLookSet,
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
    // Wave length is no longer chosen: an unknown length just means one wave for the whole session.
    expect(checkSession({ ...input, mode: "wave", waveMinutes: 25, waveCapacity: 4 }, [])).toMatchObject({ ok: true, value: { waveMinutes: null } });
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

describe("recurring date ranges and one-off sessions (IST dates)", () => {
  const wave = {
    id: "s1",
    doctorId: "d1",
    label: "Wave",
    weekdays: [1, 2, 4],
    startTime: "10:00",
    endTime: "11:00",
    room: "Room 1",
    mode: "wave" as const,
    slotMinutes: null,
    waveMinutes: 30,
    waveCapacity: 3,
    archivedAt: null,
    createdAt: "x",
    updatedAt: "x",
  };

  it("cuts a wave session into sub-slots that each take the capacity", () => {
    const slots = slotsForSession(wave, "d1", "2026-11-09", "2026-11-09");
    expect(slots.map((slot) => `${slot.time}-${slot.endTime}:${slot.capacity}`)).toEqual(["10:00-10:30:3", "10:30-11:00:3"]);
    const filled = applyHeld(slots, [`${slots[0]!.id}#1`, `${slots[0]!.id}#2`]);
    expect(placesLabel(filled[0]!)).toBe("1 of 3 places left");
    expect(applyHeld(slots, [1, 2, 3].map((t) => `${slots[0]!.id}#${t}`))[0]!.taken).toBe(true);
  });

  it("only makes slots on chosen weekdays inside the date range", () => {
    const ranged = { ...wave, startDate: "2026-11-10", endDate: "2026-11-19" };
    const dates = [...new Set(slotsForSession(ranged, "d1", "2026-11-02", "2026-11-30").map((slot) => slot.date))];
    expect(dates).toEqual(["2026-11-10", "2026-11-12", "2026-11-16", "2026-11-17", "2026-11-19"]);
  });

  it("makes slots for a one-off session on its date only, whatever the weekdays", () => {
    const once = { ...wave, mode: "stream" as const, slotMinutes: 30, waveMinutes: null, waveCapacity: null, weekdays: [], onDate: "2026-11-07", startTime: "12:00", endTime: "15:00" };
    const slots = slotsForSession(once, "d1", "2026-11-02", "2026-11-14");
    expect(new Set(slots.map((slot) => slot.date))).toEqual(new Set(["2026-11-07"]));
    expect(slots).toHaveLength(6);
    expect(describeSession(once)).toContain("Sat 7 Nov 2026 only");
  });

  const input = { label: "", room: "Room 1", mode: "wave", waveMinutes: 30, waveCapacity: 3, startTime: "12:00", endTime: "15:00", weekdays: [] as number[] };

  it("checks a one-off date: Mon–Sat, not in the past, and stores no weekdays", () => {
    expect(checkSession({ ...input, kind: "once", onDate: "2026-11-08" }, [], "2026-11-04")).toMatchObject({ ok: false });
    expect(checkSession({ ...input, kind: "once", onDate: "2026-11-03" }, [], "2026-11-04")).toMatchObject({ ok: false });
    const ok = checkSession({ ...input, kind: "once", onDate: "2026-11-07", weekdays: [1] }, [], "2026-11-04");
    expect(ok).toMatchObject({ ok: true, value: { onDate: "2026-11-07", weekdays: [], startDate: null } });
  });

  it("checks a recurring range", () => {
    expect(checkSession({ ...input, weekdays: [1], startDate: "2026-11-20", endDate: "2026-11-10" }, [], "2026-11-04")).toMatchObject({ ok: false });
    expect(checkSession({ ...input, weekdays: [1], startDate: "2026-11-10", endDate: "2026-11-15" }, [], "2026-11-04")).toMatchObject({ ok: false });
    expect(checkSession({ ...input, weekdays: [1, 2, 4], startDate: "2026-11-10", endDate: "2026-12-31" }, [], "2026-11-04")).toMatchObject({ ok: true });
  });

  it("only reports overlaps when the sessions can share a date", () => {
    const saturday = { ...wave, weekdays: [6], startTime: "12:00", endTime: "15:00" };
    // A one-off session replaces the weekly ones on its date, so it never clashes with them.
    expect(checkSession({ ...input, kind: "once", onDate: "2026-11-07" }, [saturday], "2026-11-04")).toMatchObject({ ok: true });
    expect(checkSession({ ...input, weekdays: [6] }, [{ ...saturday, weekdays: [], onDate: "2026-11-07" }], "2026-11-04")).toMatchObject({ ok: true });
    expect(
      checkSession({ ...input, kind: "once", onDate: "2026-11-07" }, [{ ...saturday, weekdays: [], onDate: "2026-11-07" }], "2026-11-04"),
    ).toMatchObject({ ok: false });
    expect(checkSession({ ...input, kind: "once", onDate: "2026-11-07" }, [{ ...saturday, endDate: "2026-11-01" }], "2026-11-04")).toMatchObject({ ok: true });
    expect(checkSession({ ...input, weekdays: [6], startDate: "2026-12-01" }, [{ ...saturday, endDate: "2026-11-30" }], "2026-11-04")).toMatchObject({ ok: true });
  });
});

describe("whole-session waves and one-off overrides", () => {
  const base = wave();
  it("makes a wave without a length into one wave for the whole session", () => {
    const whole = { ...base, waveMinutes: null };
    const slots = slotsForSession(whole, "doc", "2026-10-26", "2026-10-26");
    expect(slots.map((slot) => [slot.time, slot.endTime, slot.capacity])).toEqual([["09:00", "11:00", 3]]);
    expect(stepMinutes(whole)).toBe(120);
    expect(modeSummary(whole)).toBe("one wave, up to 3 patients, seen in token order");
  });

  it("keeps a legacy wave length as sub-waves", () => {
    expect(slotsForSession(base, "doc", "2026-10-26", "2026-10-26")).toHaveLength(2);
    expect(modeSummary(base)).toBe("60-minute waves, up to 3 patients each");
  });

  it("drops weekly sessions on a date that has a one-off session", () => {
    const once = { ...base, id: "once", weekdays: [], onDate: "2026-10-26", startTime: "15:00", endTime: "16:00", waveMinutes: null };
    const overridden = overriddenDates([base, once]);
    expect([...overridden]).toEqual(["2026-10-26"]);
    expect(slotsForSession(base, "doc", "2026-10-26", "2026-10-27", overridden).map((slot) => slot.date)).not.toContain("2026-10-26");
    expect(slotsForSession(once, "doc", "2026-10-26", "2026-10-27", overridden)).toHaveLength(1);
    expect(overriddenDates([{ ...once, archivedAt: "2026-10-20T00:00:00Z" }]).size).toBe(0);
    const days = sessionCalendar([base, once], "2026-10-26", "2026-10-26").get("2026-10-26")!;
    expect(days.map((entry) => [entry.session.id, entry.replaced])).toEqual([
      [base.id, true],
      ["once", false],
    ]);
  });



  it("formats a same-month week title as 2–8 Nov 2026", () => {
    expect(weekRangeTitle("2026-11-02")).toBe("2–8 Nov 2026");
  });

  it("finds the first draft day and rejects unset midnight times", () => {
    expect(timesLookSet("09:00", "12:00")).toBe(true);
    expect(timesLookSet("00:00", "00:00")).toBe(false);
    expect(timesLookSet("", "12:00")).toBe(false);
    expect(timesLookSet("00:00", "12:00")).toBe(false);
    const draft = {
      weekdays: [1, 2, 3, 4, 5],
      startDate: "2026-11-07",
      endDate: "2026-11-09",
      onDate: null as string | null,
    };
    expect(firstRunDate(draft, "2026-11-06")).toBe("2026-11-09");
  });

  it("widens the week hour window to cover session times", () => {
    expect(weekHourBounds([])).toEqual({ startHour: 8, endHour: 17 });
    expect(weekHourBounds([{ startTime: "07:30", endTime: "18:15" }])).toEqual({ startHour: 7, endHour: 19 });
    expect(weekHourBounds([{ startTime: "09:00", endTime: "12:00" }])).toEqual({ startHour: 8, endHour: 17 });
  });
  it("shows every slot as a start–end range", () => {
    expect(slotTimeLabel({ time: "09:00", endTime: "09:30", mode: "stream" })).toBe("09:00–09:30");
  });
});
