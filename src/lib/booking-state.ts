import type { Slot } from "./data";
import { EMPTY_FORM, type PatientForm } from "./validate";

export interface BookingPayment {
  amountPence: number;
  /** True when paid with the demo card at booking; otherwise it's paid at the desk. */
  paid: boolean;
}

export interface Booking {
  reference: string;
  doctorId: string;
  slot: Slot;
  reasonId: string;
  /** Wave bookings: the patient's place in the wave (token 1 is seen first). */
  token?: number;
  /** The visit's fee. Absent if it couldn't be recorded. */
  payment?: BookingPayment;
  /** Held in memory only. Absent after a reload. */
  patient?: PatientForm;
}

export interface BookingState {
  /** The time the patient is holding while they fill in details. */
  held: Slot | null;
  form: PatientForm;
  booking: Booking | null;
  /** A message to show on the schedule after a failed confirmation. */
  flash: { doctorId: string; message: string } | null;
}

export type BookingAction =
  | { type: "hydrate"; state: PersistedState }
  | { type: "hold"; slot: Slot }
  | { type: "release" }
  | { type: "updateForm"; patch: Partial<PatientForm> }
  | { type: "slotLost"; slot: Slot; message: string }
  | { type: "confirmed"; booking: Booking }
  | { type: "clearFlash" }
  | { type: "startOver" };

export const initialBookingState: BookingState = {
  held: null,
  form: EMPTY_FORM,
  booking: null,
  flash: null,
};

export function bookingReducer(state: BookingState, action: BookingAction): BookingState {
  switch (action.type) {
    case "hydrate":
      return {
        ...state,
        held: action.state.held ?? state.held,
        booking: state.booking ?? action.state.booking,
        flash: action.state.flash ?? state.flash,
      };
    case "hold":
      return { ...state, held: action.slot, flash: null };
    case "release":
      return { ...state, held: null };
    case "updateForm":
      return { ...state, form: { ...state.form, ...action.patch } };
    case "slotLost":
      return {
        ...state,
        held: null,
        flash: { doctorId: action.slot.doctorId, message: action.message },
      };
    case "confirmed":
      return {
        ...state,
        held: null,
        booking: action.booking,
        flash: null,
      };
    case "clearFlash":
      return state.flash ? { ...state, flash: null } : state;
    case "startOver":
      return initialBookingState;
  }
}

/* ---------- Session persistence ---------- */

export const STORAGE_KEY = "halden.booking.v1";

/**
 * What survives a reload. Patient details are deliberately excluded.
 * Availability is not cached here: the server's book is the only source of truth,
 * so a cancelled time is bookable again straight away.
 */
export interface PersistedState {
  held: Slot | null;
  booking: Omit<Booking, "patient"> | null;
  flash: BookingState["flash"];
}

export function toPersisted(state: BookingState): PersistedState {
  const booking = state.booking
    ? {
        reference: state.booking.reference,
        doctorId: state.booking.doctorId,
        slot: state.booking.slot,
        reasonId: state.booking.reasonId,
        ...(state.booking.token ? { token: state.booking.token } : {}),
        ...(state.booking.payment ? { payment: state.booking.payment } : {}),
      }
    : null;
  return { held: state.held, booking, flash: state.flash };
}

function isPayment(value: unknown): value is BookingPayment {
  if (!value || typeof value !== "object") return false;
  const payment = value as Record<string, unknown>;
  return (
    typeof payment.amountPence === "number" &&
    Number.isInteger(payment.amountPence) &&
    payment.amountPence >= 0 &&
    typeof payment.paid === "boolean"
  );
}

function isSlot(value: unknown): value is Slot {
  if (!value || typeof value !== "object") return false;
  const slot = value as Record<string, unknown>;
  return (
    typeof slot.id === "string" &&
    typeof slot.doctorId === "string" &&
    typeof slot.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(slot.date) &&
    typeof slot.time === "string" &&
    /^\d{2}:\d{2}$/.test(slot.time)
  );
}

/** Parse untrusted storage. Anything malformed is dropped rather than trusted. */
export function parsePersisted(raw: string | null): PersistedState | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    const held = isSlot(value.held) ? value.held : null;
    let booking: PersistedState["booking"] = null;
    const candidate = value.booking as Record<string, unknown> | null;
    if (
      candidate &&
      typeof candidate.reference === "string" &&
      typeof candidate.doctorId === "string" &&
      typeof candidate.reasonId === "string" &&
      isSlot(candidate.slot)
    ) {
      booking = {
        reference: candidate.reference,
        doctorId: candidate.doctorId,
        reasonId: candidate.reasonId,
        slot: candidate.slot,
        ...(typeof candidate.token === "number" && candidate.token > 0 ? { token: candidate.token } : {}),
        ...(isPayment(candidate.payment) ? { payment: { amountPence: candidate.payment.amountPence, paid: candidate.payment.paid } } : {}),
      };
    }
    const flashValue = value.flash as Record<string, unknown> | null;
    const flash =
      flashValue && typeof flashValue.doctorId === "string" && typeof flashValue.message === "string"
        ? { doctorId: flashValue.doctorId, message: flashValue.message }
        : null;
    return { held, booking, flash };
  } catch {
    return null;
  }
}
