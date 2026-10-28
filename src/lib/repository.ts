/**
 * Data access for the booking flow.
 *
 * Today this is backed by the deterministic in-memory generator in `data.ts`.
 * To connect a real practice system, replace the bodies of these functions with
 * API calls; every caller already treats them as asynchronous.
 */
import { openCharge } from "./billing";
import { blockedSlotIds, forgetBlockedSlots } from "./blocked-slots";
import type { AppointmentRecord } from "./clinic-types";
import { now } from "./clock";
import { bookWindow, findDoctor, generateSlots, reasons, type BookWindow, type Doctor, type Slot } from "./data";
import { loadDoctors } from "./doctors";
import { totals } from "./payments";
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

/** Call after `loadDoctors`: the cache is keyed by the week and the doctors listed. */
function slotsForWindow(window: BookWindow, list: readonly Doctor[]): Slot[] {
  const key = `${window.firstWeek}|${list.map((doctor) => doctor.id).join(",")}`;
  if (cache?.key !== key) cache = { key, slots: generateSlots(window) };
  return cache.slots;
}

export async function getWindow(): Promise<BookWindow> {
  return bookWindow(now());
}

export async function getDoctors(): Promise<Doctor[]> {
  return loadDoctors();
}

export async function getDoctor(id: string): Promise<Doctor | null> {
  await loadDoctors();
  return findDoctor(id) ?? null;
}

export async function getSlots(doctorId?: string): Promise<Slot[]> {
  // The doctor list and the booked-slot list are separate reads: fetch them together.
  const [list, taken] = await Promise.all([loadDoctors(), blockedSlotIds()]);
  const all = slotsForWindow(bookWindow(now()), list);
  const blocked = new Set(taken);
  const merged = all.map((slot) => (blocked.has(slot.id) && !slot.taken ? { ...slot, taken: true } : slot));
  return doctorId ? merged.filter((slot) => slot.doctorId === doctorId) : merged;
}

/** For each doctor, the next few bookable-looking slots. Used by the directory. */
export async function getUpcoming(perDoctor = 12): Promise<Record<string, Slot[]>> {
  const instant = now();
  const all = await getSlots();
  const result: Record<string, Slot[]> = {};
  for (const doctor of await loadDoctors()) {
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
  /** Pay the fee now with the demo card. Otherwise it's paid at the desk. */
  payNow?: boolean;
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
  /** The stored visit. */
  visit: AppointmentRecord;
  /** The visit's fee and whether it's paid. Null if the fee couldn't be recorded. */
  payment: { amountPence: number; paid: boolean } | null;
}

export async function confirmBooking(input: ConfirmInput, latency = 0): Promise<ConfirmResult> {
  if (latency > 0) await new Promise((resolve) => setTimeout(resolve, latency));
  if (!reasons.some((reason) => reason.id === input.reasonId)) throw new Error("Unknown visit reason.");

  const current = slotsForWindow(bookWindow(now()), await loadDoctors()).find((slot) => slot.id === input.slot.id);
  if (!current) throw new SlotUnavailableError(input.slot.id, "missing");

  const store = await getStore();
  const blocked = await store.listBlockedSlotIds();
  const status = slotStatus(current, blocked, now());
  if (status !== "open") throw new SlotUnavailableError(current.id, status);

  const reference = await uniqueReference(store);
  const visit: AppointmentRecord = {
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
  };
  const outcome = await store.createAppointment(visit);
  forgetBlockedSlots();
  if (outcome === "taken") throw new SlotUnavailableError(current.id, "taken");

  // The visit is booked either way. A fee that fails to save shows as "No fee recorded" to staff.
  const charge = await openCharge(visit, Boolean(input.payNow)).catch((error: unknown) => {
    console.error(`[billing] Could not record the fee for ${reference}: ${error instanceof Error ? error.message : "unknown error"}`);
    return null;
  });
  const payment = charge ? { amountPence: charge.amountPence, paid: totals(charge.entries).netPence >= charge.amountPence } : null;
  return { reference, visit, payment };
}
