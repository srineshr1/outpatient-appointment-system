import { beforeAll, describe, expect, it } from "vitest";
import type { AppointmentRecord, PublicUser } from "../clinic-types";
import { now, setNow } from "../clock";
import { loadDoctors } from "../doctors";
import { getOps } from "../ops";
import type { OpsStore } from "../ops/types";
import { cronAuthorised, runCron } from "../cron";
import { confirmBooking, getSlots } from "../repository";
import { rescheduleVisit, notifyRescheduled } from "../reschedule";
import { slotStatus } from "../schedule";
import { getStore } from "../store";
import { changeAppointmentStatus } from "../visits";
import { DEFAULT_DOCTOR_PREFS, getDoctorPrefs, readDoctorPrefs, saveDoctorPrefs } from "./doctor-prefs";
import { onBookingConfirmed, queueDailySummaries, SUMMARY_HOUR_SETTING } from "./service";
import { renderNotice } from "./templates";

// Tuesday 27 Oct 2026, 02:00 UTC = 07:30 India time; London is on GMT.
const MORNING = Date.UTC(2026, 9, 27, 2, 0);
const EARLY = Date.UTC(2026, 9, 27, 0, 30); // 06:00 India time
const TODAY = "2026-10-27";

let ops: OpsStore;

async function user(id: string): Promise<PublicUser> {
  const found = await (await getStore()).getUserById(id);
  if (!found) throw new Error(`no ${id}`);
  const { passwordHash: _hash, ...rest } = found as typeof found & { passwordHash?: string };
  return { ...rest, expiresAt: "2099-01-01T00:00:00.000Z" } as unknown as PublicUser;
}

async function open(doctorId: string) {
  return (await getSlots(doctorId)).filter((slot) => slot.mode === "stream" && slotStatus(slot, [], now()) === "open");
}

async function book(doctorId: string, index = 0, name = "Ann Lee"): Promise<AppointmentRecord> {
  const slot = (await open(doctorId))[index]!;
  const result = await confirmBooking({ slot, reasonId: "follow", patientName: name, patientUserId: "user-patient-demo" });
  return (await (await getStore()).listAppointments()).find((visit) => visit.reference === result.reference)!;
}

const rows = async (appointmentId: string, kind?: string) =>
  (await ops.listNotifications({ appointmentId })).filter((row) => !kind || row.kind === kind);

describe("doctor notifications", () => {
  beforeAll(async () => {
    setNow(MORNING);
    ops = await getOps();
    await loadDoctors(true);
  });

  it("emails the doctor once when a visit is confirmed, greeting them by surname, and sends nothing for a held place", async () => {
    const visit = await book("reid");
    await onBookingConfirmed(visit);
    await onBookingConfirmed(visit);
    const sent = await rows(visit.id, "doctor_booking");
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ channel: "email", recipient: "callum.reid@halden.example", status: "scheduled" });
    const message = renderNotice("doctor_booking", sent[0]!.payload as never);
    expect(message.text).toContain("Hello Dr Reid,");
    expect(message.text).not.toContain("Hello Dr,");
    expect(message.subject).toContain(visit.reference);
    expect(message.text).toContain("A follow-up");

    const hold = await confirmBooking({ slot: (await open("adeyemi"))[0]!, reasonId: "follow", patientName: "Ann Lee", patientUserId: "user-patient-demo", payOnline: true });
    const held = (await (await getStore()).listAppointments()).find((item) => item.reference === hold.reference)!;
    expect(held.status).toBe("pending_payment");
    expect(await rows(held.id, "doctor_booking")).toHaveLength(0);
  });

  it("keeps each notification kind switchable, defaulting to on", async () => {
    expect(readDoctorPrefs(undefined)).toEqual(DEFAULT_DOCTOR_PREFS);
    expect(readDoctorPrefs({ booked: false, cancelled: "no", junk: false })).toEqual({ ...DEFAULT_DOCTOR_PREFS, booked: false });
    const visit = await book("cho");
    await saveDoctorPrefs("user-cho", { ...DEFAULT_DOCTOR_PREFS, booked: false });
    expect((await getDoctorPrefs("user-cho")).booked).toBe(false);
    await onBookingConfirmed(visit);
    expect(await rows(visit.id, "doctor_booking")).toHaveLength(0);
    await saveDoctorPrefs("user-cho", DEFAULT_DOCTOR_PREFS);
  });

  it("tells the doctor when the patient cancels, and the patient when the doctor does, but never mails an actor about themselves", async () => {
    const mine = await book("reid", 1);
    await changeAppointmentStatus(await user("user-patient-demo"), mine.id, "cancelled");
    const doctorRow = (await rows(mine.id, "doctor_cancelled"))[0]!;
    expect(doctorRow.recipient).toBe("callum.reid@halden.example");
    expect(doctorRow.payload).toMatchObject({ cancelledBy: "patient", actorName: "Ann Lee" });

    const theirs = await book("reid", 2);
    expect(await changeAppointmentStatus(await user("user-reid"), theirs.id, "cancelled")).toBe("ok");
    expect(await rows(theirs.id, "doctor_cancelled")).toHaveLength(0);
    const patientRow = (await rows(theirs.id, "appointment_cancelled"))[0]!;
    expect(patientRow.payload).toMatchObject({ cancelledBy: "clinic", actorName: "Dr Callum Reid" });
    expect(renderNotice("appointment_cancelled", patientRow.payload as never).text).toContain("cancelled by Dr Callum Reid");
  });

  it("emails the doctor when a patient reschedules, and the patient when the doctor does, once per move", async () => {
    const visit = await book("reid", 3);
    const [, target] = await open("reid");
    const byPatient = await rescheduleVisit(await user("user-patient-demo"), visit.id, target!.id, "clash");
    if (!byPatient.ok) throw new Error(byPatient.reason);
    const patient = await user("user-patient-demo");
    await notifyRescheduled(patient, byPatient.visit, byPatient.history);
    await notifyRescheduled(patient, byPatient.visit, byPatient.history);
    expect(await rows(visit.id, "doctor_rescheduled")).toHaveLength(1);
    expect(await rows(visit.id, "appointment_rescheduled")).toHaveLength(0);

    const [, , next] = await open("reid");
    const doctor = await user("user-reid");
    const byDoctor = await rescheduleVisit(doctor, visit.id, next!.id, "ward round");
    if (!byDoctor.ok) throw new Error(byDoctor.reason);
    await notifyRescheduled(doctor, byDoctor.visit, byDoctor.history);
    expect(await rows(visit.id, "doctor_rescheduled")).toHaveLength(1);
    const toPatient = (await rows(visit.id, "appointment_rescheduled"))[0]!;
    expect(toPatient.recipient).toBe("ann.lee@halden.example");
    const message = renderNotice("appointment_rescheduled", toPatient.payload as never);
    expect(message.text).toContain("Hello Ann,");
    expect(message.text).toContain("ward round");
    expect(message.text).toContain("Was:");
  });
});

describe("daily schedule", () => {
  beforeAll(async () => {
    setNow(MORNING);
    ops = await getOps();
    await loadDoctors(true);
  });

  it("queues one summary per doctor with visits today, only from the summary hour, and never twice", async () => {
    setNow(MORNING);
    const a = await book("macleod", 0, "Zed One");
    const b = await book("macleod", 1, "Amy Two");
    expect([a.date, b.date]).toEqual([TODAY, TODAY]);

    setNow(EARLY);
    expect(await queueDailySummaries()).toBe(0);

    setNow(MORNING);
    expect(await queueDailySummaries()).toBeGreaterThanOrEqual(1);
    expect(await queueDailySummaries()).toBe(0);
    const all = (await ops.listNotifications({ kind: "doctor_daily_summary" })).filter((row) => row.dedupeKey.endsWith(`:${TODAY}:email`));
    const mac = all.filter((row) => row.recipient === "iona.macleod@halden.example");
    expect(mac).toHaveLength(1);
    const payload = mac[0]!.payload as { items: Array<{ patientName: string }>; firstName: string };
    expect(payload.items.map((item) => item.patientName)).toEqual(["Zed One", "Amy Two"]);
    const message = renderNotice("doctor_daily_summary", mac[0]!.payload as never);
    expect(message.text).toContain("Hello Dr MacLeod,");
    expect(message.subject).toMatch(/2 appointments/);
    // A doctor with nothing booked today gets nothing.
    expect(all.some((row) => row.recipient === "yusuf.rahman@halden.example")).toBe(false);
  });

  it("honours the doctor's switch and a changed summary hour", async () => {
    setNow(MORNING);
    await book("rahman", 0, "Only One");
    await saveDoctorPrefs("user-rahman", { ...DEFAULT_DOCTOR_PREFS, dailySummary: false });
    await ops.setSetting(SUMMARY_HOUR_SETTING, 9);
    expect(await queueDailySummaries()).toBe(0);
    await ops.setSetting(SUMMARY_HOUR_SETTING, 7);
    await queueDailySummaries();
    const rahman = (await ops.listNotifications({ kind: "doctor_daily_summary" })).filter((row) => row.recipient === "yusuf.rahman@halden.example");
    expect(rahman).toHaveLength(0);
    await saveDoctorPrefs("user-rahman", DEFAULT_DOCTOR_PREFS);
    await queueDailySummaries();
    expect((await ops.listNotifications({ kind: "doctor_daily_summary" })).filter((row) => row.recipient === "yusuf.rahman@halden.example")).toHaveLength(1);
  });

  it("is a step of the cron tick", async () => {
    expect(await cronAuthorised(null)).toBe(false);
    const result = await runCron();
    expect(result).toHaveProperty("summariesQueued");
    expect(result.errors).toEqual([]);
  });
});
