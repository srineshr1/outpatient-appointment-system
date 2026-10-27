import { afterEach, describe, expect, it } from "vitest";
import { allDoctors, bookWindow, doctors, findDoctor, generateSlots, setStaffDoctors, staffDoctorProfile } from "./data";

afterEach(() => setStaffDoctors([]));

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
    const slots = generateSlots(bookWindow(new Date("2026-10-27T09:00:00Z"))).filter((slot) => slot.doctorId === "acct-1");
    expect(slots.length).toBe(4 * 5 * 10);
    expect(slots.every((slot) => !slot.taken && !slot.teaching)).toBe(true);
  });
});
