/**
 * Data access for the booking flow.
 *
 * Today this is backed by the deterministic in-memory generator in `data.ts`.
 * To connect a real practice system, replace the bodies of these functions with
 * API calls; every caller already treats them as asynchronous.
 */
import { now } from "./clock";
import { bookWindow, doctors, generateSlots, reasons, type BookWindow, type Doctor, type Slot } from "./data";
import { referenceFor } from "./format";
import { slotStatus } from "./schedule";

export class SlotUnavailableError extends Error {
  readonly slotId: string;
  readonly reason: "taken" | "past" | "teaching" | "missing";

  constructor(slotId: string, reason: SlotUnavailableError["reason"]) {
    super(reason === "past" ? "This time has passed or closed for online booking." : "This time has just been taken.");
    this.name = "SlotUnavailableError";
    this.slotId = slotId;
    this.reason = reason;
  }
}

let cache: { key: string; slots: Slot[] } | null = null;

function slotsForWindow(window: BookWindow): Slot[] {
  if (cache?.key !== window.firstWeek) cache = { key: window.firstWeek, slots: generateSlots(window) };
  return cache.slots;
}

export async function getWindow(): Promise<BookWindow> {
  return bookWindow(now());
}

export async function getDoctors(): Promise<Doctor[]> {
  return doctors;
}

export async function getDoctor(id: string): Promise<Doctor | null> {
  return doctors.find((doctor) => doctor.id === id) ?? null;
}

export async function getSlots(doctorId?: string): Promise<Slot[]> {
  const all = slotsForWindow(bookWindow(now()));
  return doctorId ? all.filter((slot) => slot.doctorId === doctorId) : all;
}

/** For each doctor, the next few bookable-looking slots. Used by the directory. */
export async function getUpcoming(perDoctor = 12): Promise<Record<string, Slot[]>> {
  const instant = now();
  const all = await getSlots();
  const result: Record<string, Slot[]> = {};
  for (const doctor of doctors) {
    result[doctor.id] = all
      .filter((slot) => slot.doctorId === doctor.id && slotStatus(slot, [], instant) === "open")
      .slice(0, perDoctor);
  }
  return result;
}

export interface ConfirmInput {
  slot: Slot;
  reasonId: string;
  patientName: string;
  /** Times booked earlier in this session; the stand-in for server-side state. */
  takenIds: readonly string[];
}

export interface ConfirmResult {
  reference: string;
}

const LATENCY_MS = 650;

export async function confirmBooking(input: ConfirmInput, latency = LATENCY_MS): Promise<ConfirmResult> {
  if (latency > 0) await new Promise((resolve) => setTimeout(resolve, latency));
  if (!reasons.some((reason) => reason.id === input.reasonId)) throw new Error("Unknown visit reason.");

  const current = slotsForWindow(bookWindow(now())).find((slot) => slot.id === input.slot.id);
  if (!current) throw new SlotUnavailableError(input.slot.id, "missing");
  const status = slotStatus(current, input.takenIds, now());
  if (status !== "open") throw new SlotUnavailableError(current.id, status);

  return { reference: referenceFor(current.id, input.patientName) };
}
