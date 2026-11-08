import { describe, expect, it } from "vitest";
import type { AppointmentRecord, ConsultSession, Placement } from "./clinic-types";
import { applyReservations, placementConflicts, placementIsCurrent, sessionStructureChanged } from "./elastic-scheduling";
import { heldId, slotsForSession } from "./sessions";

const session: ConsultSession = { id: "elastic", doctorId: "doctor", label: "Clinic", weekdays: [1],
  startTime: "10:00", endTime: "12:00", room: "Room 1", mode: "stream", slotMinutes: 30,
  waveMinutes: null, waveCapacity: null, archivedAt: null, createdAt: "", updatedAt: "" };
const date = "2026-11-09";
function slots(s = session) { return slotsForSession(s, "doctor", date, date); }
function visit(patch: Partial<AppointmentRecord> = {}): AppointmentRecord {
  return { id: "visit", reference: "HSP-100001", slotId: "doctor-2026-11-09-1130", doctorId: "doctor", date,
    time: "11:30", endTime: "12:00", sessionId: session.id, token: null, waveCapacity: null,
    reasonId: "new", patientName: "Example", patientDob: "", patientMobile: "", patientChi: "", note: "",
    status: "booked", patientUserId: "patient", createdAt: "", ...patch };
}
function placement(v: AppointmentRecord): Placement { return { ...v, sessionId: v.sessionId ?? null,
  endTime: v.endTime ?? null, token: v.token ?? null, waveCapacity: v.waveCapacity ?? null }; }

describe("elastic availability", () => {
  it("shrinks free hours without altering a late booking", () => {
    const booked = visit(); const before = structuredClone(booked);
    const result = applyReservations(slots({ ...session, endTime: "11:00" }), [booked]);
    expect(result.map(s => s.time)).toEqual(["10:00", "10:30"]);
    expect(booked).toEqual(before);
  });
  it("expands early hours and keeps existing places blocked", () => {
    const result = applyReservations(slots({ ...session, startTime: "09:00" }), [visit()]);
    expect(result.filter(s => !s.taken).map(s => s.time)).toContain("09:00");
    expect(result.find(s => s.time === "11:30")?.taken).toBe(true);
  });
  it("blocks shifted intervals instead of only matching slot IDs", () => {
    const result = applyReservations(slots({ ...session, startTime: "09:15", endTime: "12:15" }), [visit()]);
    expect(result.filter(s => s.taken).map(s => s.time)).toEqual(["11:15", "11:45"]);
  });
  it.each(["booked", "pending_payment", "completed"] as const)("protects %s reservations", status => {
    expect(applyReservations(slots(), [visit({ status })]).at(-1)?.taken).toBe(true);
  });
  it.each(["cancelled", "expired"] as const)("releases %s reservations", status => {
    expect(applyReservations(slots(), [visit({ status })]).at(-1)?.taken).not.toBe(true);
  });
  it("does not block adjacent intervals, other doctors or dates", () => {
    expect(applyReservations(slots(), [visit({ slotId: "doctor-2026-11-09-1200", time: "12:00", endTime: "12:30" }), visit({ doctorId: "other", slotId: "other-2026-11-09-1130" }), visit({ date: "2026-11-10", slotId: "doctor-2026-11-10-1130" })]).some(s => s.taken)).toBe(false);
  });
  it("conservatively protects legacy rows without an end time", () => {
    expect(applyReservations(slots(), [visit({ time: "10:30", endTime: null })]).filter(s => s.taken)).toHaveLength(3);
  });
  it("recovers a legacy stream duration without blocking the rest of the day", () => {
    const old = visit({ slotId: "doctor-2026-11-09-1030", time: "10:30", endTime: null });
    const result = applyReservations(slots(), [old], [session]);
    expect(result.filter(s => s.taken).map(s => s.time)).toEqual(["10:30"]);
    expect(applyReservations(slots({ ...session, startTime: "09:15", endTime: "12:15" }), [old], [session]).filter(s => s.taken).map(s => s.time)).toEqual(["10:15", "10:45"]);
  });
  it("counts tokens normally for an unchanged wave", () => {
    const wave = { ...session, mode: "wave" as const, slotMinutes: null, waveCapacity: 3 };
    const slot = slots(wave)[0]!;
    const booked = visit({ slotId: heldId(slot.id, 2), time: slot.time, endTime: slot.endTime, token: 2, waveCapacity: 3 });
    expect(applyReservations([slot], [booked])[0]).toMatchObject({ booked: 1, taken: false });
  });
  it("does not reset capacity when a whole wave is resized", () => {
    const wave = { ...session, mode: "wave" as const, slotMinutes: null, waveCapacity: 3 };
    const old = slots(wave)[0]!;
    const booked = visit({ slotId: heldId(old.id, 2), time: old.time, endTime: old.endTime, token: 2, waveCapacity: 3 });
    for (const next of [{ ...wave, startTime: "09:00" }, { ...wave, endTime: "11:00" }]) {
      expect(applyReservations(slots(next), [booked])[0]?.taken).toBe(true);
    }
    expect(booked.token).toBe(2);
  });
  it("keeps unaffected legacy sub-waves bookable and blocks overlapping shifted waves", () => {
    const wave = { ...session, mode: "wave" as const, slotMinutes: null, waveMinutes: 30, waveCapacity: 3 };
    const old = slots(wave)[1]!;
    const booked = visit({ slotId: heldId(old.id, 1), time: old.time, endTime: old.endTime, token: 1, waveCapacity: 3 });
    expect(applyReservations(slots({ ...wave, startTime: "09:00" }), [booked]).find(s => s.time === "10:30")).toMatchObject({ booked: 1, taken: false });
    expect(applyReservations(slots({ ...wave, startTime: "09:15", endTime: "12:15" }), [booked]).filter(s => s.taken)).toHaveLength(2);
  });
  it("permits hour edits but guards recurrence, capacity and mode changes", () => {
    expect(sessionStructureChanged(session, { ...session, startTime: "09:00", endTime: "11:00" })).toBe(false);
    expect(sessionStructureChanged(session, { ...session, weekdays: [2] })).toBe(true);
    expect(sessionStructureChanged(session, { ...session, slotMinutes: 15 })).toBe(true);
  });
  it("rejects stale placements removed by a shrink", () => {
    expect(placementIsCurrent("doctor", placement(visit()), [{ ...session, endTime: "11:00" }])).toBe(false);
    expect(placementIsCurrent("doctor", placement(visit()), [session])).toBe(true);
  });
  it("rejects a same-ID wave whose end time changed", () => {
    const wave = { ...session, mode: "wave" as const, slotMinutes: null, waveCapacity: 3 };
    const slot = slots(wave)[0]!;
    const booked = visit({ slotId: heldId(slot.id, 1), time: slot.time, endTime: slot.endTime, token: 1, waveCapacity: 3 });
    expect(placementIsCurrent("doctor", placement(booked), [{ ...wave, endTime: "11:00" }])).toBe(false);
  });
  it("honours one-off overrides and doctor ownership", () => {
    const place = placement(visit());
    expect(placementIsCurrent("other", place, [session])).toBe(false);
    expect(placementIsCurrent("doctor", place, [session, { ...session, id: "once", onDate: date, weekdays: [] }])).toBe(false);
  });
  it("checks overlapping reservations during transactional placement", () => {
    const old = visit(); const place = placement(visit({ slotId: "doctor-2026-11-09-1115", time: "11:15", endTime: "11:45" }));
    expect(placementConflicts("doctor", place, [old])).toBe(true);
    expect(placementConflicts("doctor", place, [old], old.id)).toBe(false);
  });
});
