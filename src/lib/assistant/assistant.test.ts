import { beforeEach, describe, expect, it } from "vitest";
import type { AppointmentRecord, PublicUser } from "../clinic-types";
import { setNow } from "../clock";
import { confirmBooking, getSlots } from "../repository";
import { openSlots } from "../schedule";
import { now } from "../clock";
import { getStore } from "../store";
import { confirmPending } from "./act";
import { resetConfirmationsForTests, issueConfirmation } from "./confirm-token";
import { isEcho } from "./echo";
import { interpretReply } from "./intent";
import { prescriptions, searchDoctors, visitConflicts } from "./read";
import { runTool } from "./tools";
import { handleTurn, resetTurnsForTests } from "./turn";

beforeEach(() => {
  process.env.ASSISTANT_TOKEN_SECRET = "assistant-test-secret";
  resetConfirmationsForTests();
  resetTurnsForTests();
  setNow(Date.UTC(2026, 9, 26, 13, 40));
});

function visit(overrides: Partial<AppointmentRecord>): AppointmentRecord {
  return {
    id: "v",
    reference: "HSP-100000",
    slotId: "slot",
    doctorId: "cho",
    date: "2026-11-12",
    time: "10:00",
    endTime: "10:15",
    reasonId: "follow",
    patientName: "Ann Lee",
    patientDob: "1980-03-14",
    patientMobile: "07700900123",
    patientChi: "1403801234",
    note: "private note",
    status: "booked",
    patientUserId: "user-patient-demo",
    createdAt: "2026-11-01T00:00:00.000Z",
    ...overrides,
  };
}

async function account(id: string): Promise<PublicUser> {
  const user = await (await getStore()).getUserById(id);
  if (!user) throw new Error(`Missing ${id}`);
  return user;
}

async function freeChoSlot() {
  const slots = openSlots(await getSlots("cho"), [], now());
  const slot = slots[0];
  if (!slot) throw new Error("No open slot for Dr Cho");
  return slot;
}

describe("assistant intent and echo", () => {
  it("accepts a short yes in English, Hindi and Hinglish, and refuses a changed request", () => {
    expect(interpretReply("yes")).toBe("confirm");
    expect(interpretReply("हाँ")).toBe("confirm");
    expect(interpretReply("theek hai")).toBe("confirm");
    expect(interpretReply("book karo")).toBe("confirm");
    expect(interpretReply("no")).toBe("reject");
    expect(interpretReply("नहीं")).toBe("reject");
    expect(interpretReply("nahi")).toBe("reject");
    expect(interpretReply("yes but make it 15:00")).toBe("chat");
    expect(interpretReply("yesterday")).toBe("chat");
    expect(interpretReply("please book Dr Cho tomorrow")).toBe("chat");
  });

  it("treats the assistant's own words as an echo", () => {
    expect(isEcho("Booked with Dr Cho on Thursday", "Booked with Dr Cho on Thursday at 10:00.")).toBe(true);
    expect(isEcho("book Dr Reid tomorrow morning", "Booked with Dr Cho on Thursday")).toBe(false);
  });
});

describe("assistant conflicts", () => {
  it("finds overlapping visits and ignores cancelled ones and other doctors", () => {
    const clashes = visitConflicts([
      visit({ id: "a", reference: "HSP-1", time: "10:00", endTime: "10:20" }),
      visit({ id: "b", reference: "HSP-2", time: "10:10", endTime: "10:30", patientName: "Ben" }),
      visit({ id: "c", reference: "HSP-3", time: "11:00", endTime: "11:15" }),
      visit({ id: "d", reference: "HSP-4", status: "cancelled", time: "10:00", endTime: "10:20", patientName: "Cara" }),
      visit({ id: "e", reference: "HSP-5", doctorId: "reid", time: "10:00", endTime: "10:20", patientName: "Dev" }),
    ]);
    expect(clashes).toEqual([
      expect.objectContaining({ referenceA: "HSP-1", referenceB: "HSP-2" }),
    ]);
  });
});

describe("assistant clinic actions", () => {
  it("does not book until the patient confirms, then books for real and refuses a second use", async () => {
    const patient = await account("user-patient-demo");
    const cho = await account("user-cho");
    const reid = await account("user-reid");
    const slot = await freeChoSlot();
    const store = await getStore();
    const before = (await store.listAppointments({ patientUserId: patient.id })).length;

    const proposed = await runTool(patient, "propose_book", { slotId: slot.id, reasonId: "follow", payOnline: false });
    expect(proposed.pending?.summary).toContain("Dr");
    expect(await store.listAppointments({ patientUserId: patient.id })).toHaveLength(before);

    const refused = await handleTurn(patient, [{ role: "user", content: "no thanks" }], proposed.pending!.token);
    expect(refused.reply).toMatch(/have not booked/i);
    expect(await store.listAppointments({ patientUserId: patient.id })).toHaveLength(before);

    const again = await runTool(patient, "propose_book", { slotId: slot.id, reasonId: "follow", payOnline: false });
    const booked = await handleTurn(patient, [{ role: "user", content: "yes" }], again.pending!.token);
    expect(booked.reply).toMatch(/Booked HSP-/);
    expect(booked.pending).toBeNull();
    const visits = await store.listAppointments({ patientUserId: patient.id });
    expect(visits).toHaveLength(before + 1);
    const visit = visits.find((item) => item.slotId === slot.id || item.slotId.startsWith(`${slot.id}#`));
    expect(visit?.status).toBe("booked");
    expect(visit?.patientDob).toBe(patient.dob);

    const replay = await confirmPending(patient, again.pending!.token);
    expect(replay.ok).toBe(false);
    expect(await store.listAppointments({ patientUserId: patient.id })).toHaveLength(before + 1);

    const listed = await runTool(cho, "list_appointments", { date: slot.date });
    const body = JSON.stringify(listed.forModel);
    expect(body).toContain(visit!.reference);
    expect(body).not.toContain(patient.mobile);
    expect(body).not.toContain(patient.dob);
    expect(body).not.toContain("private");

    const stats = await runTool(cho, "appointment_stats", { from: slot.date, to: slot.date });
    expect(stats.forModel).toMatchObject({ confirmed: expect.any(Number) });
    expect((stats.forModel as { confirmed: number }).confirmed).toBeGreaterThan(0);

    const hidden = await runTool(reid, "list_appointments", { date: slot.date });
    expect(JSON.stringify(hidden.forModel)).not.toContain(visit!.reference);

    const patientView = await runTool(patient, "list_appointments", { which: "upcoming" });
    expect(JSON.stringify(patientView.forModel)).toContain(visit!.reference);
    expect(JSON.stringify(patientView.forModel)).not.toContain("Ann Lee");

    expect(await runTool(patient, "appointment_stats", { from: slot.date })).toEqual({
      forModel: { error: "That action isn't available to this account." },
    });
    expect((await runTool(cho, "propose_book", { slotId: slot.id, reasonId: "follow" })).forModel).toMatchObject({
      error: expect.stringMatching(/isn't available|patient/i),
    });
  });

  it("rechecks the slot and books nothing if it was taken after the offer", async () => {
    const patient = await account("user-patient-demo");
    const slot = await freeChoSlot();
    const proposed = await runTool(patient, "propose_book", { slotId: slot.id, reasonId: "new", payOnline: false });
    await confirmBooking({ slot, reasonId: "bp", patientName: "Someone Else", patientUserId: "user-other" });
    const outcome = await confirmPending(patient, proposed.pending!.token);
    expect(outcome.ok).toBe(false);
    expect(outcome.summary).toMatch(/taken|no longer|Nothing was changed/i);
    const mine = await (await getStore()).listAppointments({ patientUserId: patient.id });
    expect(mine.some((item) => item.patientName === "Someone Else")).toBe(false);
  });

  it("rejects an expired confirmation and one sealed for someone else", async () => {
    const patient = await account("user-patient-demo");
    const cho = await account("user-cho");
    const expired = await issueConfirmation(patient, { type: "cancel", visitId: "missing" }, { title: "Cancel?", summary: "Cancel it", confirmLabel: "Cancel" }, Date.now() - 1000);
    const outcome = await confirmPending(patient, expired.token);
    expect(outcome.ok).toBe(false);
    expect(outcome.summary).toMatch(/expired/);

    const foreign = await issueConfirmation(cho, { type: "cancel", visitId: "missing" }, { title: "Cancel?", summary: "Cancel it", confirmLabel: "Cancel" });
    const stolen = await confirmPending(patient, foreign.token);
    expect(stolen.ok).toBe(false);
    expect(stolen.summary).toMatch(/another account/);
  });

  it("searches doctors, reports hours, and does not invent prescriptions", async () => {
    const patient = await account("user-patient-demo");
    const cho = await account("user-cho");
    const found = searchDoctors(patient, "diabetes");
    expect(JSON.stringify(found)).toContain("Reid");
    expect(prescriptions()).toMatchObject({ stored: false, prescriptions: [] });
    const hours = await runTool(cho, "working_hours", {});
    expect(JSON.stringify(hours.forModel)).toContain("leavesStored");
    const slot = await freeChoSlot();
    const day = await runTool(cho, "working_hours", { date: slot.date });
    expect(day.forModel).toMatchObject({ inClinic: true });
    const next = await runTool(patient, "next_available", { doctorId: "cho" });
    expect(JSON.stringify(next.forModel)).toContain("cho");
  });

  it("cancels only after confirmation and only for the owning patient", async () => {
    const patient = await account("user-patient-demo");
    const reid = await account("user-reid");
    const slot = await freeChoSlot();
    const booked = await confirmBooking({
      slot,
      reasonId: "meds",
      patientName: patient.name,
      patientDob: patient.dob,
      patientMobile: patient.mobile,
      patientUserId: patient.id,
    });
    const offered = await runTool(reid, "propose_cancel", { visitId: booked.visit.id });
    expect(offered.pending).toBeUndefined();
    expect(offered.forModel).toMatchObject({ error: expect.stringMatching(/own/i) });

    const mine = await runTool(patient, "propose_cancel", { visitId: booked.visit.id });
    expect(mine.pending).toBeTruthy();
    expect((await (await getStore()).getAppointment(booked.visit.id))?.status).toBe("booked");
    const done = await confirmPending(patient, mine.pending!.token);
    expect(done.ok).toBe(true);
    expect((await (await getStore()).getAppointment(booked.visit.id))?.status).toBe("cancelled");
  });
});
