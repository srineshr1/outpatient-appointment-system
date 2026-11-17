import { describe, expect, it } from "vitest";
import type { AppointmentRecord } from "./clinic-types";
import { SqliteClinicStore } from "./sqlite-store";

const AT = "2026-11-17T07:00:00.000Z";

function visit(id: string, time: string, status: AppointmentRecord["status"] = "booked"): AppointmentRecord {
  const [hour, minute] = time.split(":").map(Number);
  const endMinutes = hour! * 60 + minute! + 20;
  const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;
  return {
    id,
    reference: `HSP-${id}`,
    slotId: `reid-20261117-${time.replace(":", "")}`,
    doctorId: "reid",
    date: "2026-11-17",
    time,
    endTime,
    reasonId: "follow-up",
    patientName: "Ann Lee",
    patientDob: "1990-01-01",
    patientMobile: "",
    patientChi: "",
    note: "",
    status,
    patientUserId: "patient",
    createdAt: "2026-11-17T06:00:00.000Z",
    sessionId: null,
    token: null,
    waveCapacity: null,
  };
}

describe("saveRating", () => {
  it("keeps one rating on a completed visit and refuses anything else", async () => {
    const store = new SqliteClinicStore(":memory:");
    await store.ensureReady();
    expect(await store.createAppointment(visit("seen", "09:00"))).toBe("ok");
    expect(await store.saveRating("seen", 5, "Too soon", AT)).toBe("closed");
    expect((await store.getAppointment("seen"))?.ratingScore).toBeUndefined();

    expect(await store.transitionStatus("seen", "booked", "completed")).toBe("ok");
    expect(await store.saveRating("missing", 4, null, AT)).toBe("missing");
    expect(await store.saveRating("seen", 4, "  Kind and clear  ", AT)).toBe("ok");
    expect(await store.getAppointment("seen")).toMatchObject({
      status: "completed",
      ratingScore: 4,
      ratingNote: "Kind and clear",
      ratedAt: AT,
    });
    expect(await store.saveRating("seen", 1, "Changed my mind", "2026-11-17T08:00:00.000Z")).toBe("rated");
    expect(await store.getAppointment("seen")).toMatchObject({ ratingScore: 4, ratingNote: "Kind and clear" });

    expect(await store.createAppointment(visit("blank", "15:00", "completed"))).toBe("ok");
    expect(await store.saveRating("blank", 5, `  ${"a".repeat(300)}  `, AT)).toBe("ok");
    expect((await store.getAppointment("blank"))?.ratingNote).toHaveLength(280);

    expect(await store.createAppointment(visit("quiet", "12:00", "completed"))).toBe("ok");
    expect(await store.saveRating("quiet", 3, "   ", AT)).toBe("ok");
    const quiet = await store.getAppointment("quiet");
    expect(quiet?.ratingScore).toBe(3);
    expect(quiet?.ratingNote).toBeNull();

    expect(await store.createAppointment(visit("gone", "16:00"))).toBe("ok");
    expect(await store.transitionStatus("gone", "booked", "cancelled")).toBe("ok");
    expect(await store.saveRating("gone", 2, null, AT)).toBe("closed");
  });
});
