import { describe, expect, it } from "vitest";
import { bookingReducer, initialBookingState, parsePersisted, toPersisted } from "./booking-state";
import { setNow } from "./clock";
import { confirmBooking, getSlots, getUpcoming, SlotUnavailableError } from "./repository";
import { EMPTY_FORM } from "./validate";

const slot = { id: "cho-2026-10-27-1420", doctorId: "cho", date: "2026-10-27", time: "14:20" };

describe("bookingReducer", () => {
  it("holds and releases a time, clearing any flash", () => {
    const flashed = { ...initialBookingState, flash: { doctorId: "cho", message: "x" } };
    const held = bookingReducer(flashed, { type: "hold", slot });
    expect(held.held).toEqual(slot);
    expect(held.flash).toBeNull();
    expect(bookingReducer(held, { type: "release" }).held).toBeNull();
  });

  it("marks a lost slot as taken and flashes the doctor's schedule", () => {
    const next = bookingReducer({ ...initialBookingState, held: slot }, { type: "slotLost", slot, message: "Gone." });
    expect(next.held).toBeNull();
    expect(next.takenIds).toEqual([slot.id]);
    expect(next.flash).toEqual({ doctorId: "cho", message: "Gone." });
  });

  it("starts over but remembers what was booked", () => {
    const booked = bookingReducer(
      { ...initialBookingState, held: slot, form: { ...EMPTY_FORM, name: "Ann" } },
      { type: "confirmed", booking: { reference: "HSP-1", doctorId: "cho", slot, reasonId: "new" } },
    );
    const fresh = bookingReducer(booked, { type: "startOver" });
    expect(fresh.booking).toBeNull();
    expect(fresh.form).toEqual(EMPTY_FORM);
    expect(fresh.takenIds).toEqual([slot.id]);
  });
});

describe("persistence", () => {
  it("never writes patient details to storage", () => {
    const state = {
      ...initialBookingState,
      form: { ...EMPTY_FORM, name: "Ann Lee", chi: "1403801234" },
      booking: {
        reference: "HSP-1",
        doctorId: "cho",
        slot,
        reasonId: "new",
        patient: { ...EMPTY_FORM, name: "Ann Lee", chi: "1403801234", mobile: "07700900123" },
      },
    };
    const raw = JSON.stringify(toPersisted(state));
    expect(raw).not.toContain("Ann");
    expect(raw).not.toContain("1403801234");
    expect(raw).not.toContain("07700900123");
    expect(parsePersisted(raw)?.booking?.reference).toBe("HSP-1");
  });

  it("drops malformed or hostile storage", () => {
    expect(parsePersisted("not json")).toBeNull();
    const parsed = parsePersisted(JSON.stringify({ held: { id: 1 }, takenIds: ["a", 2], booking: { slot: "x" } }));
    expect(parsed).toEqual({ held: null, takenIds: ["a"], booking: null, flash: null });
  });
});

describe("repository", () => {
  it("confirms an open slot with a reference", async () => {
    setNow(Date.UTC(2026, 9, 26, 13, 40));
    const open = (await getUpcoming())["cho"]![0]!;
    const result = await confirmBooking({ slot: open, reasonId: "new", patientName: "Ann", takenIds: [] }, 0);
    expect(result.reference).toMatch(/^HSP-\d{4}$/);
  });

  it("rejects a slot taken earlier in the session", async () => {
    setNow(Date.UTC(2026, 9, 26, 13, 40));
    const open = (await getUpcoming())["cho"]![0]!;
    await expect(
      confirmBooking({ slot: open, reasonId: "new", patientName: "Ann", takenIds: [open.id] }, 0),
    ).rejects.toBeInstanceOf(SlotUnavailableError);
  });

  it("rejects a slot that has started while the form was open", async () => {
    setNow(Date.UTC(2026, 9, 26, 9, 0));
    const open = (await getSlots("adeyemi")).find((item) => item.date === "2026-10-26" && !item.taken && item.time > "09:00")!;
    setNow(Date.UTC(2026, 9, 26, 17, 0));
    await expect(
      confirmBooking({ slot: open, reasonId: "new", patientName: "Ann", takenIds: [] }, 0),
    ).rejects.toMatchObject({ reason: "past" });
  });
});
