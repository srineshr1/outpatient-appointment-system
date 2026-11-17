import { describe, expect, it } from "vitest";
import type { AppointmentRecord } from "./clinic-types";
import { readFileSync } from "node:fs";
import { clinicQueues, compareQueue, queueClock, queuePlace, sameClinicQueue } from "./queue";

function visit(overrides: Partial<AppointmentRecord> & Pick<AppointmentRecord, "id" | "time" | "status">): AppointmentRecord {
  return {
    reference: "WB-1",
    slotId: "reid-2026-11-17-09:00",
    doctorId: "reid",
    date: "2026-11-17",
    reasonId: "follow",
    patientName: "Ann",
    patientDob: "",
    patientMobile: "",
    patientChi: "",
    note: "",
    patientUserId: "p",
    createdAt: "2026-11-01T00:00:00Z",
    sessionId: "s-morning",
    token: null,
    ...overrides,
  };
}

describe("queuePlace", () => {
  const mine = visit({ id: "me", time: "10:00", status: "booked", token: 3, patientName: "Me" });

  it("counts booked patients ahead in the same session, in time then token order", () => {
    const roster = [
      mine,
      visit({ id: "earlier", time: "09:00", status: "booked", token: 1 }),
      visit({ id: "same-wave", time: "10:00", status: "booked", token: 2 }),
      visit({ id: "later", time: "10:00", status: "booked", token: 4 }),
      visit({ id: "done", time: "09:30", status: "completed", token: 2 }),
      visit({ id: "other-session", time: "09:00", status: "booked", sessionId: "s-afternoon" }),
      visit({ id: "other-doctor", time: "09:00", status: "booked", doctorId: "cho" }),
    ];
    expect(queuePlace(mine, roster)).toEqual({ ahead: 2, waiting: 4, position: 3, stage: "expected" });
    expect(sameClinicQueue(mine, roster[5]!)).toBe(false);
  });

  it("says you are next when nobody booked is ahead", () => {
    expect(queuePlace(mine, [mine, visit({ id: "later", time: "11:00", status: "booked" })])).toEqual({
      ahead: 0,
      waiting: 2,
      position: 1,
      stage: "expected",
    });
  });

  it("drops you from the queue once the visit is no longer booked", () => {
    const seen = visit({ id: "me", time: "10:00", status: "completed" });
    expect(queuePlace(seen, [seen, visit({ id: "still", time: "11:00", status: "booked" })])).toEqual({
      ahead: 0,
      waiting: 1,
      position: null,
      stage: null,
    });
  });
});

describe("check-in order", () => {
  const AT = "2026-11-17T09:05:00.000Z";

  it("puts the patient with the doctor first, then checked-in patients, then those not here yet", () => {
    const late = visit({ id: "late", time: "09:00", status: "booked" });
    const arrived = visit({ id: "arrived", time: "09:40", status: "booked", checkedInAt: AT });
    const seeing = visit({ id: "seeing", time: "09:20", status: "booked", checkedInAt: AT, consultStartedAt: AT });
    const roster = [late, arrived, seeing];
    expect([...roster].sort(compareQueue).map((item) => item.id)).toEqual(["seeing", "arrived", "late"]);
    expect(queuePlace(seeing, roster)).toEqual({ ahead: 0, waiting: 3, position: 1, stage: "seeing" });
    expect(queuePlace(arrived, roster)).toEqual({ ahead: 1, waiting: 3, position: 2, stage: "arrived" });
    expect(queuePlace(late, roster)).toEqual({ ahead: 2, waiting: 3, position: 3, stage: "expected" });
  });

  it("keeps booking order among checked-in patients, by time then token", () => {
    const one = visit({ id: "w1", time: "10:00", status: "booked", token: 1, checkedInAt: "2026-11-17T10:20:00.000Z" });
    const two = visit({ id: "w2", time: "10:00", status: "booked", token: 2, checkedInAt: "2026-11-17T09:50:00.000Z" });
    expect([two, one].sort(compareQueue).map((item) => item.id)).toEqual(["w1", "w2"]);
  });

  it("drops no-shows and cancelled visits so everyone behind moves up", () => {
    const mine = visit({ id: "me", time: "10:00", status: "booked" });
    const roster = [
      mine,
      visit({ id: "gone", time: "09:00", status: "no_show" }),
      visit({ id: "cancel", time: "09:20", status: "cancelled" }),
      visit({ id: "ahead", time: "09:40", status: "booked" }),
    ];
    expect(queuePlace(mine, roster)).toEqual({ ahead: 1, waiting: 2, position: 2, stage: "expected" });
    const missed = roster[1]!;
    expect(queuePlace(missed, roster).position).toBeNull();
  });
});

describe("clinicQueues", () => {
  it("lists who is being seen and who is up next for each doctor and session today", () => {
    const AT = "2026-11-17T09:05:00.000Z";
    const queues = clinicQueues(
      [
        visit({ id: "seeing", time: "09:20", status: "booked", checkedInAt: AT, consultStartedAt: AT }),
        visit({ id: "late", time: "09:00", status: "booked" }),
        visit({ id: "arrived", time: "09:40", status: "booked", checkedInAt: AT }),
        visit({ id: "done", time: "08:40", status: "completed" }),
        visit({ id: "missed", time: "08:20", status: "no_show" }),
        visit({ id: "cancel", time: "08:00", status: "cancelled" }),
        visit({ id: "pm", time: "14:00", status: "booked", sessionId: "s-afternoon" }),
        visit({ id: "tomorrow", time: "09:00", status: "booked", date: "2026-11-18" }),
      ],
      "2026-11-17",
    );
    expect(queues).toHaveLength(2);
    const [morning, afternoon] = queues;
    expect(morning!.seeing.map((item) => item.id)).toEqual(["seeing"]);
    expect(morning!.upNext.map((item) => item.id)).toEqual(["arrived", "late"]);
    expect(morning).toMatchObject({ arrived: 1, completed: 1, noShows: 1, start: "08:20" });
    expect(afternoon!.upNext.map((item) => item.id)).toEqual(["pm"]);
  });
});

describe("queueClock", () => {
  it("shows check-in times as HH:MM in the practice's time zone", () => {
    expect(queueClock("2026-11-17T14:50:00.000Z")).toBe("20:20");
  });

  it("is not taken from a client component by server pages (calling one from the server crashes the page)", () => {
    for (const file of ["src/app/appointments/[id]/queue/page.tsx", "src/components/clinic/VisitList.tsx"]) {
      expect(readFileSync(file, "utf8")).not.toMatch(/from "@\/components\/dashboard\/QueueBoard"/);
    }
  });
});
