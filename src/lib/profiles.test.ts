import { describe, expect, it } from "vitest";
import { createDoctorSelfSignup } from "./accounts";
import { createStaff } from "./admin";
import { allDoctors, findDoctor } from "./data";
import { doctorStatusOf } from "./doctor-status";
import { loadDoctors } from "./doctors";
import { checkDoctorProfile, checkPatientProfile, doctorProfileRecord, parseFee } from "./profiles";
import { defaultSession } from "./sessions";
import { getStore } from "./store";
import type { SessionUser } from "./clinic-types";

const doctorForm = {
  specialty: "Cardiology",
  qualification: "MBBS, MD",
  years: "8",
  room: "Room 9",
  fee: "45.50",
  bio: "I look after hearts and the people attached to them.",
  languages: "English, Hindi",
};

describe("doctor profile form", () => {
  it("accepts a full profile and turns the fee into pence", () => {
    expect(checkDoctorProfile(doctorForm)).toMatchObject({
      ok: true,
      value: { specialty: "Cardiology", years: 8, feePence: 4550, languages: ["English", "Hindi"] },
    });
    expect(checkDoctorProfile({ ...doctorForm, fee: "", languages: "" })).toMatchObject({ ok: true, value: { feePence: null, languages: ["English"] } });
  });

  it("says what is missing or wrong", () => {
    const bad = checkDoctorProfile({ specialty: "", qualification: "", years: "x", room: "", fee: "abc", bio: "short", languages: "" });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(Object.keys(bad.errors).sort()).toEqual(["bio", "fee", "qualification", "room", "specialty", "years"]);
    expect(parseFee("£45")).toBe(4500);
    expect(parseFee("45.555")).toBeUndefined();
  });
});

describe("patient profile form", () => {
  it("takes an Indian or UK number and an optional date of birth and gender", () => {
    expect(checkPatientProfile({ name: " Asha  Rao ", mobile: "98765 43210", dob: "", gender: "" }, "2026-10-28")).toMatchObject({
      ok: true,
      value: { name: "Asha Rao", dob: "", gender: "" },
    });
    expect(checkPatientProfile({ name: "A", mobile: "07700 900123", dob: "1990-05-01", gender: "female" }, "2026-10-28").ok).toBe(true);
  });

  it("needs a name and a real phone, and refuses a future birth date", () => {
    const bad = checkPatientProfile({ name: "", mobile: "12", dob: "2030-01-01", gender: "x" }, "2026-10-28");
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(Object.keys(bad.errors).sort()).toEqual(["dob", "gender", "mobile", "name"]);
  });
});

describe("who patients can see", () => {
  const done = doctorProfileRecord("d", { ...checkDoctorValue() }, "2026-10-28T00:00:00.000Z");
  const empty = doctorProfileRecord("d", { specialty: "", qualification: "", years: null, room: "", feePence: null, bio: "", languages: [] }, "2026-10-28T00:00:00.000Z");

  it("lists the checklist for a doctor who has done nothing", () => {
    const status = doctorStatusOf({ name: "Asha Rao" }, empty, []);
    expect(status.visible).toBe(false);
    expect(status.steps.map((step) => step.done)).toEqual([false, false]);
    expect(status.steps[0]!.detail).toContain("specialty");
  });

  it("needs both a complete profile and a live session", () => {
    const session = defaultSession("d", "Room 9", "2026-10-28T00:00:00.000Z");
    expect(doctorStatusOf({ name: "Asha Rao" }, done, []).visible).toBe(false);
    expect(doctorStatusOf({ name: "Asha Rao" }, empty, [session]).visible).toBe(false);
    expect(doctorStatusOf({ name: "Asha Rao" }, done, [session]).visible).toBe(true);
    expect(doctorStatusOf({ name: "Asha Rao" }, done, [{ ...session, archivedAt: "2026-10-28T01:00:00.000Z" }]).visible).toBe(false);
  });

  it("keeps a self-signed-up doctor off the patient list until they finish, then lists them", async () => {
    const doctor = await createDoctorSelfSignup("new.doctor@example.org", "Asha Rao");
    expect(doctor).toMatchObject({ role: "doctor", doctorId: doctor.id });
    await loadDoctors(true);
    expect(allDoctors().some((item) => item.id === doctor.id)).toBe(false);
    expect(findDoctor(doctor.id)).toBeTruthy(); // their own pages can still find them

    const store = await getStore();
    await store.putProfile(doctorProfileRecord(doctor.id, checkDoctorValue(), "2026-10-28T00:00:00.000Z"));
    await loadDoctors(true);
    expect(allDoctors().some((item) => item.id === doctor.id)).toBe(false); // profile alone is not enough

    await store.putConsultSession(defaultSession(doctor.id, "Room 9", "2026-10-28T00:00:00.000Z"));
    await loadDoctors(true);
    expect(allDoctors().find((item) => item.id === doctor.id)).toMatchObject({ interest: "Cardiology", room: "Room 9", feePence: 4550 });
  });

  it("still lets an admin add a doctor who is ready straight away", async () => {
    const store = await getStore();
    const admin = (await store.listUsers()).find((user) => user.role === "admin")!;
    const added = await createStaff({ ...admin, expiresAt: "2099-01-01T00:00:00.000Z", sessionId: null } as SessionUser, {
      name: "Priya Nair",
      email: "priya.nair@example.org",
      role: "doctor",
      doctorId: null,
    });
    await loadDoctors(true);
    expect(allDoctors().some((item) => item.id === added.id)).toBe(true);
    expect(await store.listConsultSessions(added.id)).toHaveLength(1);
  });
});

function checkDoctorValue() {
  const checked = checkDoctorProfile(doctorForm);
  if (!checked.ok) throw new Error("fixture is wrong");
  return checked.value;
}
