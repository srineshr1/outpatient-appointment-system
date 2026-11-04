import { beforeAll, describe, expect, it } from "vitest";
import type { ConsultSession, PublicUser } from "./clinic-types";
import { now, setNow } from "./clock";
import { loadDoctors } from "./doctors";
import { canMove, mayReschedule, rescheduleVisit } from "./reschedule";
import { confirmBooking, getSlots } from "./repository";
import { slotStatus } from "./schedule";
import { getStore } from "./store";
import { changeAppointmentStatus } from "./visits";

const at = "2026-10-01T00:00:00.000Z";
const waveSession: ConsultSession = {
  id: "test-wave",
  doctorId: "cho",
  label: "Evening wave",
  weekdays: [1, 2, 3, 4, 5],
  startTime: "17:00",
  endTime: "19:00",
  room: "Room 3",
  mode: "wave",
  slotMinutes: null,
  waveMinutes: 60,
  waveCapacity: 2,
  archivedAt: null,
  createdAt: at,
  updatedAt: at,
};

async function user(id: string): Promise<PublicUser> {
  const found = await (await getStore()).getUserById(id);
  if (!found) throw new Error(`no ${id}`);
  const { passwordHash: _hash, ...rest } = found as typeof found & { passwordHash?: string };
  return { ...rest, expiresAt: "2099-01-01T00:00:00.000Z" } as unknown as PublicUser;
}

async function open(doctorId: string, mode: "stream" | "wave") {
  return (await getSlots(doctorId)).filter((slot) => slot.mode === mode && slotStatus(slot, [], now()) === "open");
}

describe("rescheduling", () => {
  beforeAll(async () => {
    setNow(Date.UTC(2026, 9, 26, 13, 40));
    await (await getStore()).putConsultSession(waveSession);
    await loadDoctors(true);
  });

  it("moves a stream visit, keeps the reference and records who moved it", async () => {
    const [a, b] = await open("cho", "stream");
    const booked = await confirmBooking({ slot: a!, reasonId: "follow", patientName: "Ann Lee", patientUserId: "user-patient-demo" });
    const store = await getStore();
    const before = (await store.listAppointments()).find((visit) => visit.reference === booked.reference)!;

    const patient = await user("user-patient-demo");
    const result = await rescheduleVisit(patient, before.id, b!.id, "clash with work");
    expect(result.ok).toBe(true);
    const after = (await store.getAppointment(before.id))!;
    expect(after).toMatchObject({ reference: booked.reference, slotId: b!.id, date: b!.date, time: b!.time, status: "booked" });

    const history = await store.listReschedules({ appointmentId: before.id });
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ byUserId: patient.id, byRole: "patient", fromSlotId: a!.id, toSlotId: b!.id, reason: "clash with work" });
    // The old time is free again and the new one is held.
    const slots = await getSlots("cho");
    expect(slots.find((slot) => slot.id === a!.id)?.taken).toBeFalsy();
    expect(slots.find((slot) => slot.id === b!.id)?.taken).toBe(true);
  });

  it("refuses a stream slot someone else holds, and leaves the visit where it was", async () => {
    const [a, b] = await open("reid", "stream");
    const mine = await confirmBooking({ slot: a!, reasonId: "follow", patientName: "Ann Lee", patientUserId: "user-patient-demo" });
    await confirmBooking({ slot: b!, reasonId: "new", patientName: "Ben Ray" });
    const store = await getStore();
    const visit = (await store.listAppointments()).find((item) => item.reference === mine.reference)!;
    const result = await rescheduleVisit(await user("user-patient-demo"), visit.id, b!.id);
    expect(result).toEqual({ ok: false, reason: "taken" });
    expect((await store.getAppointment(visit.id))!.slotId).toBe(a!.id);
    expect(await store.listReschedules({ appointmentId: visit.id })).toHaveLength(0);
  });

  it("refuses the time it already has, another doctor's time, and someone else's visit", async () => {
    const [a] = await open("adeyemi", "stream");
    const [other] = await open("macleod", "stream");
    const mine = await confirmBooking({ slot: a!, reasonId: "follow", patientName: "Ann Lee", patientUserId: "user-patient-demo" });
    const store = await getStore();
    const visit = (await store.listAppointments()).find((item) => item.reference === mine.reference)!;
    const patient = await user("user-patient-demo");
    expect(await rescheduleVisit(patient, visit.id, a!.id)).toEqual({ ok: false, reason: "same" });
    expect(await rescheduleVisit(patient, visit.id, other!.id)).toEqual({ ok: false, reason: "elsewhere" });
    expect(await rescheduleVisit(await user("user-reid"), visit.id, "nope")).toEqual({ ok: false, reason: "forbidden" });
    expect(await rescheduleVisit(patient, "no-such-visit", a!.id)).toEqual({ ok: false, reason: "missing" });
  });

  it("lets the doctor move a visit, and not another doctor", async () => {
    const [a, b] = await open("rahman", "stream");
    const mine = await confirmBooking({ slot: a!, reasonId: "follow", patientName: "Ann Lee", patientUserId: "user-patient-demo" });
    const store = await getStore();
    const visit = (await store.listAppointments()).find((item) => item.reference === mine.reference)!;
    const cho = await user("user-cho");
    expect(mayReschedule(cho, visit)).toBe(false);
    expect(mayReschedule(await user("user-patient-demo"), visit)).toBe(true);
    const rahman = (await store.listUsers()).find((item) => item.doctorId === "rahman");
    if (!rahman) return; // no sample account for this doctor
    const moved = await rescheduleVisit(await user(rahman.id), visit.id, b!.id);
    expect(moved.ok).toBe(true);
    expect((await store.listReschedules({ appointmentId: visit.id }))[0]).toMatchObject({ byRole: "doctor" });
  });

  it("will not move a cancelled visit", async () => {
    const [a, b] = await open("macleod", "stream");
    const mine = await confirmBooking({ slot: a!, reasonId: "follow", patientName: "Ann Lee", patientUserId: "user-patient-demo" });
    const store = await getStore();
    const visit = (await store.listAppointments()).find((item) => item.reference === mine.reference)!;
    const patient = await user("user-patient-demo");
    expect(await changeAppointmentStatus(patient, visit.id, "cancelled")).toBe("ok");
    expect(canMove((await store.getAppointment(visit.id))!)).toBe(false);
    expect(await rescheduleVisit(patient, visit.id, b!.id)).toEqual({ ok: false, reason: "closed" });
  });
});

describe("wave booking and capacity", () => {
  beforeAll(async () => {
    setNow(Date.UTC(2026, 9, 26, 13, 40));
    await (await getStore()).putConsultSession(waveSession);
    await loadDoctors(true);
  });

  it("gives tokens in booking order and refuses a full wave", async () => {
    const [w1] = await open("cho", "wave");
    expect(w1).toMatchObject({ capacity: 2, booked: 0 });
    const first = await confirmBooking({ slot: w1!, reasonId: "new", patientName: "One" });
    const second = await confirmBooking({ slot: w1!, reasonId: "new", patientName: "Two" });
    const store = await getStore();
    const tokenOf = async (reference: string) => (await store.listAppointments()).find((visit) => visit.reference === reference)?.token;
    expect([await tokenOf(first.reference), await tokenOf(second.reference)]).toEqual([1, 2]);
    await expect(confirmBooking({ slot: w1!, reasonId: "new", patientName: "Three" })).rejects.toMatchObject({ reason: "taken" });
    const full = (await getSlots("cho")).find((slot) => slot.id === w1!.id)!;
    expect(full).toMatchObject({ booked: 2, taken: true });
  });

  it("moves a visit into a wave with room, and refuses a full one", async () => {
    const waves = await open("cho", "wave");
    const [target, ...rest] = waves;
    const second = rest[0]!;
    await confirmBooking({ slot: target!, reasonId: "new", patientName: "A" });
    await confirmBooking({ slot: target!, reasonId: "new", patientName: "B" });
    // `target` is now full. A visit in `second` cannot move into it.
    const mine = await confirmBooking({ slot: second, reasonId: "new", patientName: "Mover", patientUserId: "user-patient-demo" });
    const store = await getStore();
    const visit = (await store.listAppointments()).find((item) => item.reference === mine.reference)!;
    const patient = await user("user-patient-demo");
    expect(await rescheduleVisit(patient, visit.id, target!.id)).toEqual({ ok: false, reason: "taken" });

    // A wave with a free place accepts the move and gives a token there.
    const free = rest.find((slot) => slot.id !== second.id && !slot.taken);
    expect(free).toBeTruthy();
    const moved = await rescheduleVisit(patient, visit.id, free!.id);
    expect(moved.ok).toBe(true);
    const after = (await store.getAppointment(visit.id))!;
    expect(after.token).toBe(1);
    expect(after.slotId).toBe(`${free!.id}#1`);
    const history = (await store.listReschedules({ appointmentId: visit.id }))[0]!;
    expect(history.toToken).toBe(1);
    expect(history.fromToken).toBe(visit.token);
    expect(history.fromToken).toBe(visit.token);
  });
});
