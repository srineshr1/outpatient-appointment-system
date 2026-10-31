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
import {
  bookWindow,
  findDoctor,
  generateSlots,
  isListed,
  reasons,
  scheduleVersion,
  type BookWindow,
  type Doctor,
  type Slot,
} from "./data";
import { loadDoctors } from "./doctors";
import { totals } from "./payments";
import { releaseExpiredHolds } from "./payments/holds";
import { slotStatus } from "./schedule";
import { applyHeld, freeToken, heldId } from "./sessions";
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
  const key = `${window.firstWeek}|${scheduleVersion()}|${list.map((doctor) => doctor.id).join(",")}`;
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
  const merged = applyHeld(all, taken);
  return doctorId ? merged.filter((slot) => slot.doctorId === doctorId) : merged;
}

/** One slot or wave by id, as it stands now (bookings applied), or null when no such time exists. */
export async function getSlot(id: string): Promise<Slot | null> {
  const store = await getStore();
  const [doctors, held] = await Promise.all([loadDoctors(), store.listBlockedSlotIds()]);
  const found = slotsForWindow(bookWindow(now()), doctors).find((slot) => slot.id === id);
  return found ? (applyHeld([found], held)[0] ?? null) : null;
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
  /** Hold the place and pay the fee online. Otherwise it's paid at the desk. */
  payNow?: boolean;
  /**
   * Hold the place while the patient pays online: the visit is saved as "pending_payment" and counts toward
   * capacity until it is paid or the hold runs out. No charge is opened; the payment service owns the money.
   */
  payOnline?: boolean;
}

/** "HSP-482913": six random digits, checked against the book so no two visits share one. */
export function newReference(): string {
  const value = crypto.getRandomValues(new Uint32Array(1))[0]! % 900000;
  return `HSP-${100000 + value}`;
}

async function uniqueReference(store: Awaited<ReturnType<typeof getStore>>): Promise<string> {
  // One indexed lookup per candidate, not a read of every visit ever booked.
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const reference = newReference();
    if (!(await store.referenceInUse(reference))) return reference;
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

  // The doctors, the held slots and a free reference don't depend on each other: ask for them together.
  const store = await getStore();
  const reference$ = uniqueReference(store);
  reference$.catch(() => undefined); // surfaced below, only if the booking gets that far
  // A payment hold that ran out still sits in the booked list until released, so release it first.
  await releaseExpiredHolds();
  const [doctors, blocked] = await Promise.all([loadDoctors(), store.listBlockedSlotIds()]);
  const found = slotsForWindow(bookWindow(now()), doctors).find((slot) => slot.id === input.slot.id);
  if (!found || !isListed(found.doctorId)) throw new SlotUnavailableError(input.slot.id, "missing");
  const current = applyHeld([found], blocked)[0]!;
  const status = slotStatus(current, blocked, now());
  if (status !== "open") throw new SlotUnavailableError(current.id, status);

  const reference = await reference$;
  let held = blocked;
  let attempt = 0;
  for (;;) {
    // A wave booking holds "<wave>#<token>": the lowest token nobody holds. A stream slot holds its own id.
    const token = current.mode === "wave" ? freeToken(current.id, current.capacity ?? 1, held) : null;
    if (current.mode === "wave" && token === null) throw new SlotUnavailableError(current.id, "taken");
    const visit = buildVisit(input, current, reference, token);
    const outcome = await store.createAppointment(visit);
    if (outcome === "ok") {
      forgetBlockedSlots();
      return finishBooking(visit, input, reference);
    }
    forgetBlockedSlots();
    // Someone took that token a moment ago: read what is held now and try the next one.
    attempt += 1;
    if (current.mode !== "wave" || attempt >= 5) throw new SlotUnavailableError(current.id, "taken");
    held = await store.listBlockedSlotIds();
  }
}

function buildVisit(input: ConfirmInput, current: Slot, reference: string, token: number | null): AppointmentRecord {
  return {
    id: crypto.randomUUID(),
    reference,
    slotId: token === null ? current.id : heldId(current.id, token),
    doctorId: current.doctorId,
    date: current.date,
    time: current.time,
    reasonId: input.reasonId,
    patientName: input.patientName.trim(),
    patientDob: input.patientDob ?? "",
    patientMobile: input.patientMobile ?? "",
    patientChi: (input.patientChi ?? "").replace(/\s/g, ""),
    note: input.note?.trim() ?? "",
    status: input.payOnline ? "pending_payment" : "booked",
    patientUserId: input.patientUserId ?? null,
    createdAt: new Date().toISOString(),
    sessionId: current.sessionId ?? null,
    token,
    waveCapacity: current.mode === "wave" ? (current.capacity ?? 1) : null,
    endTime: current.endTime ?? null,
  };
}

async function finishBooking(visit: AppointmentRecord, input: ConfirmInput, reference: string): Promise<ConfirmResult> {
  // Held for online payment: the payment service records the money once it arrives.
  if (input.payOnline) return { reference, visit, payment: null };

  // The visit is booked either way. A fee that fails to save shows as "No fee recorded" to staff.
  const charge = await openCharge(visit, Boolean(input.payNow)).catch((error: unknown) => {
    console.error(`[billing] Could not record the fee for ${reference}: ${error instanceof Error ? error.message : "unknown error"}`);
    return null;
  });
  const payment = charge ? { amountPence: charge.amountPence, paid: totals(charge.entries).netPence >= charge.amountPence } : null;
  return { reference, visit, payment };
}
