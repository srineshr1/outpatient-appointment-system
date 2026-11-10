import { describe, expect, it } from "vitest";
import type { ConsultSession } from "@/lib/clinic-types";
import { mondayOf } from "@/lib/clock";
import { buildWeek, firstFreeHour, type ScheduleVisit } from "./schedule-model";

const at = "2026-10-01T00:00:00.000Z";

function session(patch: Partial<ConsultSession> = {}): ConsultSession {
  return {
    id: "s1",
    doctorId: "doc",
    label: "Morning",
    weekdays: [1, 2, 3, 4, 5],
    startTime: "09:00",
    endTime: "10:00",
    room: "Room 1",
    mode: "stream",
    slotMinutes: 15,
    waveMinutes: null,
    waveCapacity: null,
    startDate: "2026-11-01",
    endDate: "2026-12-31",
    onDate: null,
    archivedAt: null,
    createdAt: at,
    updatedAt: at,
    ...patch,
  };
}

function visit(patch: Partial<ScheduleVisit> = {}): ScheduleVisit {
  return {
    id: "a1",
    sessionId: "s1",
    slotId: "doc-2026-11-09-0900",
    date: "2026-11-09",
    time: "09:00",
    endTime: "09:15",
    token: null,
    patientName: "Ann Lee",
    reason: "A follow-up",
    status: "booked",
    reference: "HSP-000001",
    ...patch,
  };
}

describe("buildWeek", () => {
  const today = "2026-11-10";
  const monday = mondayOf(today);

  it("counts stream places across the week and seats a booked visit", () => {
    const week = buildWeek([session()], [visit({ date: monday })], [], monday, today);
    expect(week.capacity).toBe(5 * 4);
    expect(week.booked).toBe(1);
    const mondaySessions = week.days[0]!.sessions;
    expect(mondaySessions).toHaveLength(1);
    expect(mondaySessions[0]!.blocks[0]!.seats[0]!.visit?.patientName).toBe("Ann Lee");
    expect(mondaySessions[0]!.blocks[1]!.seats[0]!.visit).toBeNull();
  });

  it("groups a wave by token and keeps a visit that falls outside the hours", () => {
    const wave = session({
      id: "w1",
      mode: "wave",
      slotMinutes: null,
      waveMinutes: null,
      waveCapacity: 3,
      weekdays: [],
      onDate: monday,
      startTime: "14:00",
      endTime: "15:00",
    });
    const week = buildWeek(
      [wave],
      [
        visit({ id: "a2", sessionId: "w1", date: monday, time: "14:00", token: 2, patientName: "Priya Nair" }),
        visit({ id: "a3", sessionId: "w1", date: monday, time: "09:00", token: null, patientName: "Daniel Okafor" }),
      ],
      [],
      monday,
      today,
    );
    const block = week.days[0]!.sessions[0]!;
    expect(block.capacity).toBe(3);
    expect(block.booked).toBe(1);
    expect(block.blocks[0]!.seats[1]!.visit?.patientName).toBe("Priya Nair");
    expect(block.outside.map((item) => item.patientName)).toEqual(["Daniel Okafor"]);
  });

  it("finds a free hour that does not overlap a session", () => {
    expect(firstFreeHour([session()], [], monday)).toBe(8 * 60);
    expect(firstFreeHour([session({ startTime: "08:00", endTime: "18:00", slotMinutes: 30 })], [], monday)).toBeNull();
  });
});
