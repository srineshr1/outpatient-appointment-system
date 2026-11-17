import { describe, expect, it } from "vitest";
import type { AppointmentRecord } from "./clinic-types";
import { queuePlace, sameClinicQueue } from "./queue";

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
    expect(queuePlace(mine, roster)).toEqual({ ahead: 2, waiting: 4, position: 3 });
    expect(sameClinicQueue(mine, roster[5]!)).toBe(false);
  });

  it("says you are next when nobody booked is ahead", () => {
    expect(queuePlace(mine, [mine, visit({ id: "later", time: "11:00", status: "booked" })])).toEqual({
      ahead: 0,
      waiting: 2,
      position: 1,
    });
  });

  it("drops you from the queue once the visit is no longer booked", () => {
    const seen = visit({ id: "me", time: "10:00", status: "completed" });
    expect(queuePlace(seen, [seen, visit({ id: "still", time: "11:00", status: "booked" })])).toEqual({
      ahead: 0,
      waiting: 1,
      position: null,
    });
  });
});
