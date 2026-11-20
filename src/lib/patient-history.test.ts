import { describe, expect, it } from "vitest";
import type { AppointmentRecord } from "./clinic-types";
import { ageOn, canViewPatientDetails, pastVisitsOf, samePatient, sessionPatientDetails } from "./patient-history";

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

describe("patient history", () => {
  it("works out age on the day of the visit", () => {
    expect(ageOn("1980-03-14", "2026-03-13")).toBe(45);
    expect(ageOn("1980-03-14", "2026-03-14")).toBe(46);
    expect(ageOn("", "2026-03-14")).toBeNull();
  });

  it("matches the same patient by account, then CHI, then name and date of birth", () => {
    const a = record({ id: "a" });
    expect(samePatient(a, record({ id: "b" }))).toBe(true);
    expect(samePatient(a, record({ id: "b", patientUserId: "someone-else" }))).toBe(false);
    const desk = { patientUserId: null };
    expect(samePatient(record({ id: "c", ...desk, patientChi: "123 456 7890" }), record({ id: "d", ...desk, patientChi: "1234567890" }))).toBe(true);
    expect(samePatient(record({ id: "e", ...desk }), record({ id: "f", ...desk, patientDob: "1990-01-01" }))).toBe(false);
  });

  it("lists only earlier visits, newest first, with the patient's note and rating", () => {
    const today = record({ id: "now", date: "2026-10-26", time: "10:00", status: "booked" });
    const book = [
      today,
      record({ id: "old", date: "2026-08-01", note: "Cough for two weeks", ratingScore: 5, ratedAt: "2026-08-01T12:00:00Z" }),
      record({ id: "newer", date: "2026-09-15", status: "no_show" }),
      record({ id: "later", date: "2026-11-02", status: "booked" }),
      record({ id: "held", date: "2026-07-01", status: "pending_payment" }),
      record({ id: "other-patient", date: "2026-07-01", patientUserId: "user-x", patientName: "Bo" }),
    ];
    const past = pastVisitsOf(today, book);
    expect(past.map((visit) => visit.id)).toEqual(["newer", "old"]);
    expect(past[1]).toMatchObject({ note: "Cough for two weeks", rating: 5, reason: "A follow-up" });
  });

  it("only the visit's own doctor, reception and admins see details", () => {
    expect(canViewPatientDetails({ role: "doctor", doctorId: "cho" }, { doctorId: "cho" })).toBe(true);
    expect(canViewPatientDetails({ role: "doctor", doctorId: "reid" }, { doctorId: "cho" })).toBe(false);
    expect(canViewPatientDetails({ role: "reception", doctorId: null }, { doctorId: "cho" })).toBe(true);
    expect(canViewPatientDetails({ role: "patient", doctorId: null }, { doctorId: "cho" })).toBe(false);
  });

  it("builds details for this and upcoming sessions only, never for another doctor's visits", () => {
    const book = [
      record({ id: "today", status: "booked" }),
      record({ id: "past", date: "2026-09-01" }),
      record({ id: "cancelled", status: "cancelled" }),
      record({ id: "far", date: "2027-03-01", status: "booked" }),
      record({ id: "theirs", doctorId: "reid", status: "booked" }),
    ];
    const details = sessionPatientDetails({ role: "doctor", doctorId: "cho" }, book, [], {}, "2026-10-26");
    expect(Object.keys(details)).toEqual(["today"]);
    expect(details.today!.pastVisits.map((visit) => visit.id)).toEqual(["past"]);
  });
});
