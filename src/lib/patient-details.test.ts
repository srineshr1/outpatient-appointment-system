import { describe, expect, it } from "vitest";
import type { AppointmentRecord } from "./clinic-types";
import { setNow } from "./clock";
import { ageOn, canViewPatientDetails, loadPatientDetails, pastVisitsOf, samePatient } from "./patient-details";
import { patientProfileRecord } from "./profiles";
import { confirmBooking, getUpcoming } from "./repository";
import { runQueueStep } from "./visits";
import { getStore } from "./store";

function record(overrides: Partial<AppointmentRecord> & Pick<AppointmentRecord, "id">): AppointmentRecord {
  return {
    reference: `WB-${overrides.id}`,
    slotId: `cho-${overrides.id}`,
    doctorId: "cho",
    date: "2026-10-26",
    time: "09:00",
    reasonId: "follow",
    patientName: "Ann Lee",
    patientDob: "1980-03-14",
    patientMobile: "",
    patientChi: "",
    note: "",
    status: "completed",
    patientUserId: "user-patient-demo",
    createdAt: "2026-10-01T09:00:00.000Z",
    ...overrides,
  };
}

describe("patient details helpers", () => {
  it("works out age on the day of the visit", () => {
    expect(ageOn("1980-03-14", "2026-03-13")).toBe(45);
    expect(ageOn("1980-03-14", "2026-03-14")).toBe(46);
    expect(ageOn("", "2026-03-14")).toBeNull();
    expect(ageOn("not a date", "2026-03-14")).toBeNull();
  });

  it("matches the same patient by account, then CHI, then name and date of birth", () => {
    const a = record({ id: "a" });
    expect(samePatient(a, record({ id: "b" }))).toBe(true);
    expect(samePatient(a, record({ id: "b", patientUserId: "someone-else" }))).toBe(false);
    const desk = { patientUserId: null };
    expect(samePatient(record({ id: "c", ...desk, patientChi: "123 456 7890" }), record({ id: "d", ...desk, patientChi: "1234567890", patientName: "A Lee" }))).toBe(true);
    expect(samePatient(record({ id: "e", ...desk }), record({ id: "f", ...desk, patientName: " ann  lee " }))).toBe(true);
    expect(samePatient(record({ id: "g", ...desk }), record({ id: "h", ...desk, patientDob: "1990-01-01" }))).toBe(false);
  });

  it("lists only earlier visits, newest first", () => {
    const today = record({ id: "now", date: "2026-10-26", time: "10:00", status: "booked" });
    const book = [
      today,
      record({ id: "old", date: "2026-08-01" }),
      record({ id: "newer", date: "2026-09-15", status: "no_show" }),
      record({ id: "same-day-earlier", date: "2026-10-26", time: "09:00" }),
      record({ id: "later", date: "2026-11-02", status: "booked" }),
      record({ id: "other-patient", date: "2026-07-01", patientUserId: "user-x", patientName: "Bo" }),
    ];
    expect(pastVisitsOf(today, book).map((visit) => visit.id)).toEqual(["same-day-earlier", "newer", "old"]);
  });

  it("lets the visit's doctor, reception and admins open details, and nobody else", () => {
    const visit = { doctorId: "cho" };
    expect(canViewPatientDetails({ role: "doctor", doctorId: "cho" }, visit)).toBe(true);
    expect(canViewPatientDetails({ role: "doctor", doctorId: "reid" }, visit)).toBe(false);
    expect(canViewPatientDetails({ role: "doctor", doctorId: null }, visit)).toBe(false);
    expect(canViewPatientDetails({ role: "reception", doctorId: null }, visit)).toBe(true);
    expect(canViewPatientDetails({ role: "admin", doctorId: null }, visit)).toBe(true);
    expect(canViewPatientDetails({ role: "patient", doctorId: null }, visit)).toBe(false);
  });
});

describe("loading a patient's details on the server", () => {
  it("returns the details to the visit's doctor and the desk, and refuses everyone else", async () => {
    setNow(Date.UTC(2026, 9, 26, 3, 0));
    const slot = (await getUpcoming())["cho"]![0]!;
    const booked = await confirmBooking(
      {
        slot,
        reasonId: "follow",
        patientName: "Ann Lee",
        patientDob: "1980-03-14",
        patientMobile: "07700 900123",
        patientChi: "140 380 1234",
        note: "Penicillin allergy",
        patientUserId: "user-patient-demo",
      },
      0,
    );
    const store = await getStore();
    const visit = (await store.listAppointments()).find((item) => item.reference === booked.reference)!;
    await store.putProfile(patientProfileRecord("user-patient-demo", { gender: "female" }, "2026-10-01T00:00:00.000Z"));
    await store.createAppointment(record({ id: "pd-past-cho", reference: "WB-PAST1", date: "2026-08-01", doctorId: "cho" }));
    await store.createAppointment(record({ id: "pd-past-reid", reference: "WB-PAST2", date: "2026-08-02", doctorId: "reid", slotId: "reid-pd" }));

    const doctor = (await store.getUserById("user-cho"))!;
    const other = (await store.getUserById("user-reid"))!;
    const desk = (await store.getUserById("user-desk"))!;
    const admin = (await store.getUserById("user-admin"))!;
    const patient = (await store.getUserById("user-patient-demo"))!;

    setNow(Date.parse(`${visit.date}T04:00:00Z`));
    expect(await runQueueStep(desk, visit.id, "check_in")).toBe("ok");

    const result = await loadPatientDetails(doctor, visit.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const details = result.details;
    expect(details).toMatchObject({
      name: "Ann Lee",
      dob: "1980-03-14",
      sex: "Female",
      mobile: "07700 900123",
      email: "ann.lee@halden.example",
      chi: "1403801234",
      note: "Penicillin allergy",
      status: "booked",
      reference: visit.reference,
    });
    expect(details.age).toBe(46);
    expect(details.checkedInAt).toBe(new Date(Date.parse(`${visit.date}T04:00:00Z`)).toISOString());
    expect(details.checkedInLabel).toMatch(/^\d{2}:\d{2}$/);
    expect(details.token).not.toBeNull();
    // Past visits are this doctor's only.
    const refs = details.pastVisits.map((item) => item.reference);
    expect(refs).toContain("WB-PAST1");
    expect(refs).not.toContain("WB-PAST2");

    expect((await loadPatientDetails(desk, visit.id)).ok).toBe(true);
    expect((await loadPatientDetails(admin, visit.id)).ok).toBe(true);
    expect(await loadPatientDetails(other, visit.id)).toEqual({ ok: false, reason: "forbidden" });
    expect(await loadPatientDetails(patient, visit.id)).toEqual({ ok: false, reason: "forbidden" });
    expect(await loadPatientDetails(null, visit.id)).toEqual({ ok: false, reason: "signed_out" });
    expect(await loadPatientDetails(doctor, "no-such-visit")).toEqual({ ok: false, reason: "missing" });
    setNow(null);
  }, 20000);
});
