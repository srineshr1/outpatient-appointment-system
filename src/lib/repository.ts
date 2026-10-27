/**
 * Data access for the booking flow.
 *
 * Today this is backed by the deterministic in-memory generator in `data.ts`.
 * To connect a real practice system, replace the bodies of these functions with
 * API calls; every caller already treats them as asynchronous.
 */
import { now } from "./clock";
import { bookWindow, doctors, generateSlots, reasons, type BookWindow, type Doctor, type Slot } from "./data";
import { slotStatus } from "./schedule";
import { getStore } from "./store";

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
  const blocked = new Set(await (await getStore()).listBlockedSlotIds());
  const merged = all.map((slot) => (blocked.has(slot.id) && !slot.taken ? { ...slot, taken: true } : slot));
  return doctorId ? merged.filter((slot) => slot.doctorId === doctorId) : merged;
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
  patientDob?: string;
  patientMobile?: string;
  patientChi?: string;
  note?: string;
  patientUserId?: string | null;
}

/** "HSP-482913": six random digits, checked against the book so no two visits share one. */
export function newReference(): string {
  const value = crypto.getRandomValues(new Uint32Array(1))[0]! % 900000;
  return `HSP-${100000 + value}`;
}

async function uniqueReference(store: Awaited<ReturnType<typeof getStore>>): Promise<string> {
  const used = new Set((await store.listAppointments()).map((visit) => visit.reference));
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const reference = newReference();
    if (!used.has(reference)) return reference;
  }
  throw new Error("Could not allocate a booking reference.");
}

export interface ConfirmResult {
  reference: string;
}

export async function confirmBooking(input: ConfirmInput, latency = 0): Promise<ConfirmResult> {
  if (latency > 0) await new Promise((resolve) => setTimeout(resolve, latency));
  if (!reasons.some((reason) => reason.id === input.reasonId)) throw new Error("Unknown visit reason.");

  const current = slotsForWindow(bookWindow(now())).find((slot) => slot.id === input.slot.id);
  if (!current) throw new SlotUnavailableError(input.slot.id, "missing");

  const store = await getStore();
  const blocked = await store.listBlockedSlotIds();
  const status = slotStatus(current, blocked, now());
  if (status !== "open") throw new SlotUnavailableError(current.id, status);

  const reference = await uniqueReference(store);
  const outcome = await store.createAppointment({
    id: crypto.randomUUID(),
    reference,
    slotId: current.id,
    doctorId: current.doctorId,
    date: current.date,
    time: current.time,
    reasonId: input.reasonId,
    patientName: input.patientName.trim(),
    patientDob: input.patientDob ?? "",
    patientMobile: input.patientMobile ?? "",
    patientChi: (input.patientChi ?? "").replace(/\s/g, ""),
    note: input.note?.trim() ?? "",
    status: "booked",
    patientUserId: input.patientUserId ?? null,
    createdAt: new Date().toISOString(),
  });
  if (outcome === "taken") throw new SlotUnavailableError(current.id, "taken");
  return { reference };
}
