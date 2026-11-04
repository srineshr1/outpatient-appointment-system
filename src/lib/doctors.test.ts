import { afterEach, describe, expect, it } from "vitest";
import { allDoctors, bookWindow, doctors, findDoctor, generateSlots, setConsultSessions, setStaffDoctors, staffDoctorProfile } from "./data";
import { defaultSession } from "./sessions";

afterEach(() => {
  setStaffDoctors([]);
  setConsultSessions([]);
});

describe("doctors added in the admin console", () => {
  it("get a listing named from the account", () => {
    const profile = staffDoctorProfile({ id: "acct-1", name: "Srinesh Kumar" });
    expect(profile).toMatchObject({ id: "acct-1", name: "Dr Srinesh Kumar", short: "Dr Kumar", interest: "General practice" });
    expect(staffDoctorProfile({ id: "acct-2", name: "dr.  Srinesh" }).name).toBe("Dr Srinesh");
  });

  it("are listed after the practice's doctors and can be found by id", () => {
    const profile = staffDoctorProfile({ id: "acct-1", name: "Srinesh" });
    setStaffDoctors([profile]);
    expect(allDoctors().map((doctor) => doctor.id)).toEqual([...doctors.map((doctor) => doctor.id), "acct-1"]);
    expect(findDoctor("acct-1")?.name).toBe("Dr Srinesh");
    expect(findDoctor("cho")?.name).toBe("Dr Helen Cho");
  });

  it("get open weekday times in the bookable window", () => {
    setStaffDoctors([staffDoctorProfile({ id: "acct-1", name: "Srinesh" })]);
    setConsultSessions([defaultSession("acct-1", "Room 6", "2026-10-01T00:00:00.000Z")]);
    const slots = generateSlots(bookWindow(new Date("2026-10-27T09:00:00Z"))).filter((slot) => slot.doctorId === "acct-1");
    // Weekday mornings 09:00 to 13:00 in 20-minute slots: 12 a day.
    expect(slots.length).toBeGreaterThan(0);
    expect(slots.length % 12).toBe(0);
    expect(slots.every((slot) => !slot.taken && !slot.teaching)).toBe(true);
  });

  it("get no times until they have a session", () => {
    setStaffDoctors([staffDoctorProfile({ id: "acct-1", name: "Srinesh" })]);
    const slots = generateSlots(bookWindow(new Date("2026-10-27T09:00:00Z"))).filter((slot) => slot.doctorId === "acct-1");
    expect(slots).toEqual([]);
  });
});
