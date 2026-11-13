import { describe, expect, it } from "vitest";
import type { AppointmentRecord, ConsultSession, SessionTrim } from "./clinic-types";
import { applyReservations, isUpcomingVisit, occupiesTime } from "./elastic-scheduling";
import { doctorTitle } from "./names";
import { checkDoctorProfile, doctorProfileRecord, readDoctorProfile } from "./profiles";
import { addBlockedReason, toRecurringDraft } from "./session-defaults";
import {
  canonicalHeldIds,
  checkSession,
  freeToken,
  heldId,
  hoursOnDate,
  newAbsorptions,
  placesLabel,
  slotsForSession,
  studioDateAfterSave,
  visitWhenLabel,
  waveSlotId,
  type SessionInput,
} from "./sessions";

const at = "2026-10-01T00:00:00.000Z";
const date = "2026-12-02"; // a Wednesday

function session(patch: Partial<ConsultSession> = {}): ConsultSession {
  return {
    id: "s1", doctorId: "doc", label: "Clinic", weekdays: [3], startTime: "10:00", endTime: "11:00", room: "Room 1",
    mode: "stream", slotMinutes: 20, waveMinutes: null, waveCapacity: null, archivedAt: null, createdAt: at, updatedAt: at,
    ...patch,
  };
}
const wholeWave = (patch: Partial<ConsultSession> = {}) =>
  session({ id: "wave", mode: "wave", slotMinutes: null, waveMinutes: null, waveCapacity: 6, onDate: date, weekdays: [], ...patch });
const stream = session({ id: "stream", onDate: date, weekdays: [], startTime: "09:00", endTime: "10:40" });
const trim: SessionTrim = { sessionId: "wave", date, startTime: "10:00", endTime: "10:40", absorbedBy: "stream" };

function visit(patch: Partial<AppointmentRecord> = {}): AppointmentRecord {
  return {
    id: "v1", reference: "HSP-100001", slotId: heldId(waveSlotId("wave", date, "10:00"), 1), doctorId: "doc", date,
    time: "10:00", endTime: "11:00", sessionId: "wave", token: 1, waveCapacity: 6, reasonId: "new", patientName: "Example",
    patientDob: "", patientMobile: "", patientChi: "", note: "", status: "booked", patientUserId: "p", createdAt: at, ...patch,
  };
}

describe("A5: whole-session wave ids survive free-edge cuts", () => {
  it("keeps the same wave id when a neighbour's cut is applied or lifted", () => {
    const wave = wholeWave();
    const cut = slotsForSession(wave, "doc", date, date, new Set(), [trim], [wave, stream]);
    const plain = slotsForSession(wave, "doc", date, date);
    expect(cut).toHaveLength(1);
    expect(cut[0]).toMatchObject({ time: "10:40", endTime: "11:00" });
    expect(plain[0]).toMatchObject({ time: "10:00", endTime: "11:00" });
    expect(cut[0]!.id).toBe(plain[0]!.id);
  });

  it("counts a visit booked while the wave was cut once the cut is lifted (no more '6 of 6 places left')", () => {
    const wave = wholeWave();
    const bookedWhileCut = visit({ slotId: heldId(waveSlotId("wave", date, "10:40"), 1), time: "10:40", endTime: "11:00" });
    const [slot] = applyReservations(slotsForSession(wave, "doc", date, date), [bookedWhileCut], [wave]);
    expect(slot).toMatchObject({ booked: 1 });
    // The wave's hours moved under a reserved patient, so it stays closed that day, and says so.
    expect(slot!.taken).toBe(true);
    expect(placesLabel(slot!)).toBe("Full");
  });

  it("matches a visit booked before a cut was applied, and the next token is not reused", () => {
    const wave = wholeWave();
    const booked = visit();
    const roster = [wave, stream];
    const [slot] = applyReservations(slotsForSession(wave, "doc", date, date, new Set(), [trim], roster), [booked], roster);
    expect(slot).toMatchObject({ booked: 1 });
    const legacy = [heldId(waveSlotId("wave", date, "10:40"), 1)];
    expect(freeToken(slot!.id, 6, legacy)).toBe(1);
    expect(freeToken(slot!.id, 6, canonicalHeldIds(legacy, roster, slot!))).toBe(2);
  });

  it("leaves stream slots and multi-wave sessions alone", () => {
    const multi = session({ id: "multi", mode: "wave", slotMinutes: null, waveMinutes: 30, waveCapacity: 2 });
    const other = heldId(waveSlotId("multi", date, "10:30"), 1);
    expect(canonicalHeldIds([other], [multi], { sessionId: "multi", date, mode: "wave" })).toEqual([other]);
    expect(canonicalHeldIds(["doc-2026-12-02-1000"], [stream], { sessionId: "stream", date, mode: "stream" })).toEqual(["doc-2026-12-02-1000"]);
  });

  it("reports whole-slot hours even when no cut applies", () => {
    const ragged = session({ startTime: "09:00", endTime: "10:50", slotMinutes: 20 });
    expect(hoursOnDate(ragged, date, [])).toEqual({ startTime: "09:00", endTime: "10:40" });
    expect(hoursOnDate(wholeWave(), date, [])).toEqual({ startTime: "10:00", endTime: "11:00" });
  });
});

describe("A11: completed visits are not upcoming", () => {
  it("keeps a completed visit's time but does not count it as upcoming", () => {
    expect(occupiesTime({ status: "completed" })).toBe(true);
    expect(isUpcomingVisit({ status: "completed" })).toBe(false);
    expect(isUpcomingVisit({ status: "booked" })).toBe(true);
    expect(isUpcomingVisit({ status: "pending_payment" })).toBe(true);
    expect(isUpcomingVisit({ status: "cancelled" })).toBe(false);
  });
});

describe("A1: the studio stays on the saved session's day", () => {
  it("uses a one-off's date, the viewed day when the session runs then, or its next run", () => {
    expect(studioDateAfterSave({ weekdays: [], onDate: "2026-12-04" }, "2026-11-20", "2026-11-13")).toBe("2026-12-04");
    expect(studioDateAfterSave({ weekdays: [3], startDate: "2026-11-01", endDate: "2026-12-31" }, "2026-11-25", "2026-11-13")).toBe("2026-11-25");
    expect(studioDateAfterSave({ weekdays: [3], startDate: "2026-11-01", endDate: "2026-12-31" }, "2026-11-26", "2026-11-13")).toBe("2026-12-02");
    expect(studioDateAfterSave({ weekdays: [3], startDate: "2026-11-01", endDate: "2026-12-31" }, "junk", "2026-11-13")).toBe("2026-11-18");
  });
});

describe("other 8: no new session today in the past", () => {
  const input: SessionInput = {
    label: "", kind: "once", onDate: "2026-11-13", startDate: null, endDate: null, weekdays: [], startTime: "09:00", endTime: "10:00",
    room: "Room 1", mode: "stream", slotMinutes: 20, waveMinutes: null, waveCapacity: null,
  };
  it("refuses a start time that has already passed today", () => {
    expect(checkSession(input, [], "2026-11-13", { nowMinutes: 9 * 60 + 17 })).toMatchObject({ ok: false, message: expect.stringContaining("already passed today") });
    expect(checkSession({ ...input, startTime: "10:00", endTime: "11:00" }, [], "2026-11-13", { nowMinutes: 9 * 60 + 17 })).toMatchObject({ ok: true });
    expect(checkSession({ ...input, onDate: "2026-11-14" }, [], "2026-11-13", { nowMinutes: 9 * 60 + 17 })).toMatchObject({ ok: true });
    // Without a clock (an edit that keeps its start), the old rule applies.
    expect(checkSession(input, [], "2026-11-13")).toMatchObject({ ok: true });
  });
});

describe("other 4: Recurring follows the chosen date", () => {
  it("uses the one-off date's weekday and starts from that date", () => {
    const draft = { kind: "once" as const, onDate: "2026-11-18", startDate: "2026-11-13", endDate: "2027-02-05", weekdays: [5] };
    expect(toRecurringDraft(draft, "2026-11-13")).toMatchObject({ kind: "recurring", weekdays: [3], startDate: "2026-11-18", endDate: "2027-02-05" });
  });
  it("gives a saved weekly session its own days back", () => {
    const draft = { kind: "once" as const, onDate: "2026-11-18", startDate: "", endDate: "", weekdays: [3] };
    const saved = { onDate: null, weekdays: [1, 4], startDate: "2026-11-02", endDate: "2026-12-31" };
    expect(toRecurringDraft(draft, "2026-11-13", saved)).toMatchObject({ weekdays: [1, 4], startDate: "2026-11-02", endDate: "2026-12-31" });
  });
});

describe("A8: where a session can be added", () => {
  it("explains Sundays and past days instead of moving the draft", () => {
    expect(addBlockedReason("2026-11-15", "2026-11-13")).toContain("Sundays");
    expect(addBlockedReason("2026-11-12", "2026-11-13")).toContain("passed");
    expect(addBlockedReason("2026-11-13", "2026-11-13")).toBeNull();
    expect(addBlockedReason("2026-11-14", "2026-11-13")).toBeNull();
  });
});

describe("other 7: taking another session's hours", () => {
  it("only flags hours this session does not already hold", () => {
    const held: SessionTrim[] = [{ ...trim, date: "2026-12-02" }];
    expect(newAbsorptions([{ ...trim, date: "2026-12-09" }], held, "stream")).toEqual([]);
    expect(newAbsorptions([{ ...trim, endTime: "10:20" }], held, "stream")).toHaveLength(1);
    expect(newAbsorptions([trim], held, "__draft__")).toHaveLength(1);
  });
});

describe("small labels", () => {
  it("formats displaced visit times for the practice", () => {
    expect(visitWhenLabel({ date: "2026-12-01", time: "09:40" })).toBe("1 Dec, 09:40");
  });
  it("never doubles the doctor's title", () => {
    expect(doctorTitle("Asha Rao")).toBe("Dr Asha Rao");
    expect(doctorTitle("Dr. Asha Rao")).toBe("Dr Asha Rao");
    expect(doctorTitle("dr asha")).toBe("Dr asha");
    expect(doctorTitle("  ")).toBe("Doctor");
  });
  it("keeps a fee of 0 as free of charge", () => {
    const form = { specialty: "GP", qualification: "MBBS", years: "3", room: "Room 1", fee: "0", bio: "Ten characters at least.", languages: "" };
    const checked = checkDoctorProfile(form);
    expect(checked).toMatchObject({ ok: true, value: { feePence: 0 } });
    if (!checked.ok) return;
    expect(readDoctorProfile(doctorProfileRecord("d", checked.value, at)).feePence).toBe(0);
    expect(readDoctorProfile(doctorProfileRecord("d", { ...checked.value, feePence: null }, at)).feePence).toBeNull();
  });
});
