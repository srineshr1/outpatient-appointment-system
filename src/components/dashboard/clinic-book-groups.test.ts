import { describe, expect, it } from "vitest";
import type { AppointmentRecord } from "@/lib/clinic-types";
import { groupVisits } from "./ClinicBookView";

function visit(id: string, date: string, status: AppointmentRecord["status"]): AppointmentRecord {
  return {
    id, reference: `HSP-${id}`, slotId: `doc-${date}-0900`, doctorId: "doc", date, time: "09:00", endTime: "09:20",
    sessionId: "s1", token: null, waveCapacity: null, reasonId: "new", patientName: "Example", patientDob: "",
    patientMobile: "", patientChi: "", note: "", status, patientUserId: "p", createdAt: "",
  };
}

describe("Clinic book groups", () => {
  it("keeps displaced visits out of Today, Upcoming and Earlier", () => {
    const groups = groupVisits(
      [
        visit("1", "2026-11-13", "displaced"),
        visit("2", "2026-11-20", "displaced"),
        visit("3", "2026-11-13", "booked"),
        visit("4", "2026-11-20", "booked"),
        visit("5", "2026-11-10", "cancelled"),
      ],
      "2026-11-13",
    );
    expect(groups.todayVisits.map((v) => v.id)).toEqual(["3"]);
    expect(groups.upcoming.map((v) => v.id)).toEqual(["4"]);
    expect(groups.earlier).toEqual([]);
    expect(groups.cancelled.map((v) => v.id).sort()).toEqual(["1", "2", "5"]);
  });
});
