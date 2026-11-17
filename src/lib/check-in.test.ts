import { describe, expect, it } from "vitest";
import { setNow } from "./clock";
import { confirmBooking, getUpcoming } from "./repository";
import { queuePlace } from "./queue";
import { getStore } from "./store";
import { runQueueStep } from "./visits";

describe("check-in and the day's queue", () => {
  it("checks a patient in once, calls them in, and closes a no-show so the queue moves up", async () => {
    setNow(Date.UTC(2026, 9, 26, 13, 40));
    const slots = (await getUpcoming())["cho"]!;
    const [first, second, third] = slots;
    expect(first && second && third).toBeTruthy();
    const book = (slot: typeof first, name: string) =>
      confirmBooking({ slot: slot!, reasonId: "follow", patientName: name, patientUserId: "user-patient-demo" }, 0);
    const a = await book(first, "Ann Queue");
    const b = await book(second, "Ben Queue");
    const c = await book(third, "Cat Queue");

    const store = await getStore();
    const byRef = async (reference: string) => (await store.listAppointments()).find((item) => item.reference === reference)!;
    const [visitA, visitB, visitC] = [await byRef(a.reference), await byRef(b.reference), await byRef(c.reference)];
    const desk = (await store.getUserById("user-desk"))!;
    const doctor = (await store.getUserById("user-cho"))!;
    const otherDoctor = (await store.getUserById("user-reid"))!;
    const patient = (await store.getUserById("user-patient-demo"))!;

    // Only on the day of the visit.
    const visitDay = Date.parse(`${visitA.date}T12:00:00Z`);
    if (visitA.date !== new Date(Date.UTC(2026, 9, 26)).toISOString().slice(0, 10)) {
      expect(await runQueueStep(desk, visitA.id, "check_in")).toBe("not_today");
    }
    setNow(visitDay);

    // Patients and other doctors cannot run the queue.
    expect(await runQueueStep(patient, visitA.id, "check_in")).toBe("forbidden");
    expect(await runQueueStep(otherDoctor, visitA.id, "check_in")).toBe("forbidden");

    // Check-in records the time once; a second check-in changes nothing.
    expect(await runQueueStep(desk, visitC.id, "check_in")).toBe("ok");
    const checked = await store.getAppointment(visitC.id);
    expect(checked?.status).toBe("booked");
    expect(checked?.checkedInAt).toBe(new Date(visitDay).toISOString());
    setNow(visitDay + 60_000);
    expect(await runQueueStep(doctor, visitC.id, "check_in")).toBe("already");
    expect((await store.getAppointment(visitC.id))?.checkedInAt).toBe(new Date(visitDay).toISOString());

    // Checked-in Cat goes ahead of Ann and Ben, who have not arrived yet.
    let roster = await store.listAppointments({ doctorId: "cho" });
    expect(queuePlace((await store.getAppointment(visitC.id))!, roster)).toMatchObject({ ahead: 0, position: 1, stage: "arrived" });
    expect(queuePlace(visitA, roster)).toMatchObject({ ahead: 1, position: 2, stage: "expected" });
    expect(queuePlace(visitB, roster)).toMatchObject({ ahead: 2, position: 3, stage: "expected" });

    // A checked-in patient is not a no-show.
    expect(await runQueueStep(desk, visitC.id, "no_show")).toBe("closed");

    // Ann never comes: Ben moves up.
    expect(await runQueueStep(desk, visitA.id, "no_show")).toBe("ok");
    expect((await store.getAppointment(visitA.id))?.status).toBe("no_show");
    expect(await runQueueStep(desk, visitA.id, "no_show")).toBe("already");
    expect(await runQueueStep(desk, visitA.id, "check_in")).toBe("closed");
    roster = await store.listAppointments({ doctorId: "cho" });
    expect(queuePlace(visitB, roster)).toMatchObject({ ahead: 1, position: 2 });

    // The doctor calls Cat in; Ben (called in without checking in) is checked in at the same time.
    expect(await runQueueStep(doctor, visitC.id, "start_consult")).toBe("ok");
    expect(await runQueueStep(doctor, visitC.id, "start_consult")).toBe("already");
    roster = await store.listAppointments({ doctorId: "cho" });
    expect(queuePlace((await store.getAppointment(visitC.id))!, roster)).toMatchObject({ stage: "seeing", position: 1 });
    expect(queuePlace(visitB, roster)).toMatchObject({ ahead: 1, stage: "expected" });

    expect(await store.transitionStatus(visitC.id, "booked", "completed")).toBe("ok");
    expect(await runQueueStep(doctor, visitB.id, "start_consult")).toBe("ok");
    const ben = (await store.getAppointment(visitB.id))!;
    expect(ben.checkedInAt).toBeTruthy();
    expect(ben.consultStartedAt).toBeTruthy();
    roster = await store.listAppointments({ doctorId: "cho" });
    expect(queuePlace(ben, roster)).toMatchObject({ ahead: 0, position: 1, stage: "seeing", waiting: 1 });
  }, 20000);
});
