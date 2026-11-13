/**
 * Displaced patient rebooking.
 *
 * Normally a session change that would cut into a reservation is refused. When the doctor explicitly
 * confirms "notify them and offer new times", the visits in the removed hours are marked "displaced"
 * (never deleted: the row keeps its original time), and each paid or desk-booked visit gets an offer of
 * the nearest free times with the same doctor. Those times are held for OFFER_HOLD_HOURS so nobody else
 * takes them. The patient then accepts one (the visit moves there, same reference and same payment),
 * asks to cancel (full refund through the normal refund flow), or lets it lapse (the cron cancels and
 * refunds). When a whole session is removed, its unpaid payment holds are displaced without an offer:
 * no money was taken, and a payment that still arrives is refunded by the existing late-payment path.
 *
 * Only the SHA-256 of a patient's link token is stored (see rebook-links.ts). Every change is told
 * to the patient through the outbox after it is committed (see rebooking-notices.ts).
 */
import { timingSafeEqual } from "node:crypto";
import { SYSTEM_ACTOR, actorOf, recordEvent, visitSummary } from "./audit";
import { settleCancelledVisit } from "./billing";
import { forgetBlockedSlots } from "./blocked-slots";
import type {
  AppointmentRecord,
  ClinicStore,
  ConsultSession,
  Displacement,
  Placement,
  PublicUser,
  RebookingOffer,
  RescheduleRecord,
  SessionTrim,
} from "./clinic-types";
import { addDays, now, todayIso } from "./clock";
import type { Slot } from "./data";
import { applyReservations, holdReservations, occupiesTime, sessionStructureChanged, stillFits, type Reservation } from "./elastic-scheduling";
import { hashToken } from "./passwords";
import { rebookPath, rebookToken, rebookTokenHash } from "./rebook-links";
import { cancelReminders, rescheduleReminders } from "./notifications/service";
import { releaseExpiredHolds } from "./payments/holds";
import { notifyDisplaced, notifyOfferClosed, notifyRebooked } from "./rebooking-notices";
import { refundForCancellation, type CancellationRefund } from "./payments/service";
import { getSlot } from "./repository";
import { slotStart, slotStatus } from "./schedule";
import { baseSlotId, freeToken, heldId, isTime, minutesOverlap, overriddenDates, slotsForSession, toMinutes, tokenOfHeld } from "./sessions";
import { getStore } from "./store";

/** How long the offered times stay held for the patient. */
export const OFFER_HOLD_HOURS = 24;
/** How many alternative times an offer holds. */
export const OFFER_SLOTS = 3;
export const MAX_OFFER_SLOTS = 5;
/** How far ahead to look for alternative times. */
export const OFFER_HORIZON_DAYS = 28;
export const DEFAULT_DISPLACED_REASON = "The doctor changed their consulting hours.";

/* ---------- Tokens ---------- */

export { rebookPath, rebookToken, rebookTokenHash };

function sameText(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/* ---------- Which visits a change displaces ---------- */

function displaceable(visit: AppointmentRecord): visit is AppointmentRecord & { status: "booked" | "pending_payment" } {
  return visit.status === "booked" || visit.status === "pending_payment";
}

/**
 * The reservations a session change would strand. Removing the session strands every upcoming booked
 * visit and payment hold in it. Changing its hours strands the booked visits whose slot or wave no
 * longer exists at the same time; payment holds keep their original time as elastic scheduling already
 * allows (they are paid at that time or lapse within minutes). A structural change (patients per wave,
 * slot length, wave interval, stream/wave, days or dates) strands every booked visit and hold that no
 * longer fits. Pure: the caller passes the visits.
 */
export function displacedBy(
  visits: readonly AppointmentRecord[],
  existing: ConsultSession,
  next: ConsultSession,
  today: string,
  trims: readonly SessionTrim[] = [],
): AppointmentRecord[] {
  const upcoming = visits.filter((visit) => displaceable(visit) && visit.date >= today);
  const ownUpcoming = upcoming.filter((visit) => visit.sessionId === existing.id);
  let stranded: AppointmentRecord[] = [];
  if (next.archivedAt) {
    stranded = [...ownUpcoming];
  } else {
    // An hours-only change keeps payment holds where they are (elastic scheduling). A structural change
    // (fewer patients per wave, another slot length or wave interval, stream/wave, days or dates) must move
    // every reservation that no longer fits, holds included.
    const structural = sessionStructureChanged(existing, next);
    stranded = ownUpcoming
      .filter((visit) => structural || visit.status === "booked")
      .filter((visit) => !stillFits(visit, next));
  }

  // Also include any visits in other sessions that overlap absorbed trims
  if (trims.length > 0) {
    const otherVisits = upcoming.filter((visit) => visit.sessionId !== existing.id);
    for (const visit of otherVisits) {
      if (!isTime(visit.time)) continue;
      const vStart = toMinutes(visit.time);
      const vEnd = visit.endTime && isTime(visit.endTime) ? toMinutes(visit.endTime) : vStart + 15;
      const hit = trims.some(
        (t) =>
          t.sessionId === visit.sessionId &&
          t.date === visit.date &&
          minutesOverlap(toMinutes(t.startTime), toMinutes(t.endTime), vStart, vEnd),
      );
      if (hit && !stranded.some((s) => s.id === visit.id)) {
        stranded.push(visit);
      }
    }
  }

  return sortByTime(stranded);
}

function sortByTime<T extends Pick<AppointmentRecord, "date" | "time">>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => (a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)));
}

/* ---------- Choosing alternative times ---------- */

export interface AlternativeInput {
  visit: Pick<AppointmentRecord, "doctorId" | "date" | "time">;
  /** The doctor's sessions as they will be after the change. */
  sessions: readonly ConsultSession[];
  trims: readonly SessionTrim[];
  /** Everything that holds time: occupying visits that stay, and held offer slots. */
  reserved: readonly Reservation[];
  instant: Date;
  count?: number;
  horizonDays?: number;
}

/** Open times of the doctor's sessions from today, with reservations applied. */
export function openSlotsFor(input: Omit<AlternativeInput, "visit" | "count"> & { doctorId: string }): Slot[] {
  const today = todayIso(input.instant);
  const last = addDays(today, input.horizonDays ?? OFFER_HORIZON_DAYS);
  const roster = input.sessions.filter((session) => session.doctorId === input.doctorId && !session.archivedAt);
  const overridden = overriddenDates(roster);
  const slots = roster.flatMap((session) => slotsForSession(session, input.doctorId, today, last, overridden, input.trims, roster));
  return applyReservations(slots, input.reserved, roster).filter((slot) => slotStatus(slot, [], input.instant) === "open");
}

/** The place a slot offers next: a stream slot itself, or a wave's lowest free token. Null when full. */
export function placementFor(slot: Slot, heldIds: readonly string[]): Placement | null {
  const token = slot.mode === "wave" ? freeToken(slot.id, slot.capacity ?? 1, heldIds) : null;
  if (slot.mode === "wave" && token === null) return null;
  return {
    slotId: token === null ? slot.id : heldId(slot.id, token),
    date: slot.date,
    time: slot.time,
    sessionId: slot.sessionId ?? null,
    token,
    waveCapacity: slot.mode === "wave" ? (slot.capacity ?? 1) : null,
    endTime: slot.endTime ?? null,
  };
}

/** Up to `count` free places with the same doctor, nearest in time to the original visit first. */
export function pickAlternatives(input: AlternativeInput): Placement[] {
  const count = Math.max(0, Math.min(input.count ?? OFFER_SLOTS, MAX_OFFER_SLOTS));
  const origin = slotStart(input.visit).getTime();
  const open = openSlotsFor({ ...input, doctorId: input.visit.doctorId }).sort((a, b) => {
    const da = Math.abs(slotStart(a).getTime() - origin);
    const db = Math.abs(slotStart(b).getTime() - origin);
    return da - db || slotStart(a).getTime() - slotStart(b).getTime();
  });
  const heldIds = input.reserved.filter(occupiesTime).map((item) => item.slotId);
  const picked: Placement[] = [];
  for (const slot of open) {
    if (picked.length >= count) break;
    const place = placementFor(slot, heldIds);
    if (place) picked.push(place);
  }
  return picked;
}

/** One offer per booked visit, each holding times no other offer in the batch holds. */
export function planOffers(input: {
  displaced: readonly AppointmentRecord[];
  sessions: readonly ConsultSession[];
  trims: readonly SessionTrim[];
  reserved: readonly Reservation[];
  instant: Date;
  reason: string;
  count?: number;
  newId?: () => string;
}): Displacement[] {
  const reserved: Reservation[] = [...input.reserved];
  const at = input.instant.toISOString();
  const expiresAt = new Date(input.instant.getTime() + OFFER_HOLD_HOURS * 3_600_000).toISOString();
  const newId = input.newId ?? (() => crypto.randomUUID());
  return input.displaced.filter(displaceable).map((visit) => {
    let offer: RebookingOffer | null = null;
    if (visit.status === "booked") {
      const id = newId();
      const slots = pickAlternatives({ visit, sessions: input.sessions, trims: input.trims, reserved, instant: input.instant, count: input.count });
      offer = { id, appointmentId: visit.id, doctorId: visit.doctorId, tokenHash: rebookTokenHash(id), status: "pending",
        slots, reason: input.reason, createdAt: at, expiresAt, closedAt: null, chosenSlotId: null };
      reserved.push(...holdReservations([offer]));
    }
    return { appointmentId: visit.id, fromStatus: visit.status, fromSlotId: visit.slotId, reason: input.reason, at, offer };
  });
}

/* ---------- Displacing ---------- */

async function pendingHolds(store: ClinicStore, doctorId: string): Promise<Reservation[]> {
  return holdReservations(await store.listRebookingOffers({ doctorId, status: "pending" }));
}

/** The visits this change would displace, read now. */
export async function previewDisplacement(existing: ConsultSession, next: ConsultSession): Promise<AppointmentRecord[]> {
  const visits = await (await getStore()).listAppointments({ doctorId: existing.doctorId });
  return displacedBy(visits, existing, next, todayIso(now()));
}

export type DisplaceResult =
  | { ok: true; displaced: AppointmentRecord[]; offers: RebookingOffer[] }
  | { ok: false; reason: "none" | "changed" | "stale" | "taken" };

/**
 * Save `next` (the change to `existing`) and displace the reservations it strands, after the doctor
 * confirmed `expected` of them. "changed" when a different number is affected now (ask again).
 * Nothing changes unless the whole write succeeds.
 */
export async function displaceAndSave(
  actor: PublicUser,
  existing: ConsultSession,
  next: ConsultSession,
  trims: readonly SessionTrim[],
  options: { expected: number; reason?: string },
): Promise<DisplaceResult> {
  await releaseExpiredHolds();
  const store = await getStore();
  const instant = now();
  const [visits, sessions, storedTrims, holds] = await Promise.all([
    store.listAppointments({ doctorId: existing.doctorId }),
    store.listConsultSessions(existing.doctorId),
    store.listSessionTrims(existing.doctorId),
    pendingHolds(store, existing.doctorId),
  ]);
  const displaced = displacedBy(visits, existing, next, todayIso(instant), trims);
  if (displaced.length === 0) return { ok: false, reason: "none" };
  if (displaced.length !== options.expected) return { ok: false, reason: "changed" };

  const leaving = new Set(displaced.map((visit) => visit.id));
  const roster = sessions.map((session) => (session.id === next.id ? next : session));
  const after = [...storedTrims.filter((trim) => trim.absorbedBy !== next.id), ...trims.map((trim) => ({ ...trim, absorbedBy: next.id }))];
  const reserved = [...visits.filter((visit) => !leaving.has(visit.id)), ...holds];
  const reason = (options.reason ?? "").replace(/\s+/g, " ").trim().slice(0, 200) || DEFAULT_DISPLACED_REASON;
  const plan = planOffers({ displaced, sessions: roster, trims: after, reserved, instant, reason });

  const outcome = await store.saveSessionDisplacing(next, trims, plan);
  forgetBlockedSlots();
  if (outcome !== "ok") return { ok: false, reason: outcome };

  const offers = plan.flatMap((item) => (item.offer ? [item.offer] : []));
  const moved = displaced.map((visit) => ({ ...visit, status: "displaced" as const, displacedAt: instant.toISOString(), displacedReason: reason }));
  for (const visit of moved) {
    await cancelReminders(visit.id);
    const offer = offers.find((item) => item.appointmentId === visit.id);
    await recordEvent({
      actor: actorOf(actor),
      action: "appointment.displaced",
      subjectType: "appointment",
      subjectId: visit.id,
      summary: `${visitSummary(visit)} · ${offer ? `${offer.slots.length} new ${offer.slots.length === 1 ? "time" : "times"} offered` : "unpaid hold released"}`,
      reason,
    });
  }
  await notifyDisplaced(moved, offers);
  return { ok: true, displaced: moved, offers };
}

/* ---------- The patient's side ---------- */

export type OfferView =
  | { state: "pending"; offer: RebookingOffer; visit: AppointmentRecord }
  | { state: "accepted" | "expired" | "cancelled"; offer: RebookingOffer; visit: AppointmentRecord }
  | { state: "invalid" };

/** The offer behind a link token, and whether it can still be used. Unknown or malformed tokens are "invalid". */
export async function findOffer(token: string, instant: Date = now()): Promise<OfferView> {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return { state: "invalid" };
  const store = await getStore();
  const offer = await store.getRebookingOfferByTokenHash(hashToken(token));
  if (!offer || !sameText(offer.tokenHash, hashToken(token))) return { state: "invalid" };
  const visit = await store.getAppointment(offer.appointmentId);
  if (!visit) return { state: "invalid" };
  if (offer.status === "pending" && new Date(offer.expiresAt).getTime() <= instant.getTime()) return { state: "expired", offer, visit };
  return { state: offer.status, offer, visit } as OfferView;
}

/** More open times with the doctor than the offer holds (the "show more times" list). */
export async function moreTimes(offer: RebookingOffer, limit = 20): Promise<Placement[]> {
  const store = await getStore();
  const instant = now();
  const [visits, sessions, trims, holds] = await Promise.all([
    store.listAppointments({ doctorId: offer.doctorId }),
    store.listConsultSessions(offer.doctorId),
    store.listSessionTrims(offer.doctorId),
    pendingHolds(store, offer.doctorId),
  ]);
  const reserved = [...visits, ...holds];
  const heldIds = reserved.filter(occupiesTime).map((item) => item.slotId);
  const offered = new Set(offer.slots.map((slot) => baseSlotId(slot.slotId)));
  const places: Placement[] = [];
  for (const slot of openSlotsFor({ doctorId: offer.doctorId, sessions, trims, reserved, instant })) {
    if (places.length >= limit) break;
    if (offered.has(slot.id)) continue;
    const place = placementFor(slot, heldIds);
    if (place) places.push(place);
  }
  return sortByTime(places);
}

export type AcceptResult =
  | { ok: true; visit: AppointmentRecord; previous: AppointmentRecord; history: RescheduleRecord }
  | { ok: false; reason: "invalid" | "expired" | "closed" | "taken" | "missing" };

export const ACCEPT_MESSAGES: Record<Exclude<AcceptResult, { ok: true }>["reason"], string> = {
  invalid: "This link is not valid. Use the latest email from the practice.",
  expired: "These times are no longer held for you. Your visit has been or will be cancelled and refunded.",
  closed: "This offer has already been used.",
  taken: "That time was just taken. Pick another one.",
  missing: "That time is no longer available. Pick another one.",
};

/**
 * Move the displaced visit to `slotId`: one of the offered (held) places, or another open time with
 * the same doctor. The reference, the patient and the payment stay with the visit, so nothing is charged again.
 */
export async function acceptOffer(token: string, slotId: string): Promise<AcceptResult> {
  const view = await findOffer(token);
  if (view.state === "invalid") return { ok: false, reason: "invalid" };
  if (view.state === "expired") return { ok: false, reason: "expired" };
  if (view.state !== "pending" || view.visit.status !== "displaced") return { ok: false, reason: "closed" };
  const { offer, visit } = view;
  const store = await getStore();

  let to: Placement | null = offer.slots.find((slot) => slot.slotId === slotId) ?? null;
  if (!to) {
    const slot = await getSlot(baseSlotId(slotId));
    if (!slot || slot.doctorId !== offer.doctorId || slotStatus(slot, [], now()) !== "open") return { ok: false, reason: "missing" };
    const own = new Set(offer.slots.map((item) => item.slotId));
    to = placementFor(slot, (await store.listBlockedSlotIds()).filter((id) => !own.has(id)));
    if (!to) return { ok: false, reason: "taken" };
  }
  if (slotStart(to).getTime() <= now().getTime()) return { ok: false, reason: "missing" };

  const history: RescheduleRecord = {
    id: crypto.randomUUID(),
    appointmentId: visit.id,
    reference: visit.reference,
    doctorId: visit.doctorId,
    patientUserId: visit.patientUserId,
    byUserId: visit.patientUserId,
    byName: visit.patientName,
    byRole: "patient",
    fromSlotId: visit.slotId,
    fromDate: visit.date,
    fromTime: visit.time,
    fromToken: visit.token ?? tokenOfHeld(visit.slotId),
    toSlotId: to.slotId,
    toDate: to.date,
    toTime: to.time,
    toToken: to.token,
    reason: "Rebooked after the doctor changed their hours",
    at: now().toISOString(),
  };
  const outcome = await store.acceptRebookingOffer(offer.id, to, history, now().toISOString());
  forgetBlockedSlots();
  if (outcome === "expired") return { ok: false, reason: "expired" };
  if (outcome === "stale") return { ok: false, reason: "closed" };
  if (outcome === "taken") return { ok: false, reason: "taken" };
  const moved: AppointmentRecord = { ...visit, ...to, status: "booked" };
  await recordEvent({
    actor: { id: visit.patientUserId, name: visit.patientName, role: "patient" },
    action: "appointment.rebooked",
    subjectType: "appointment",
    subjectId: visit.id,
    summary: `${visitSummary(moved)} · was ${visit.date} ${visit.time}`,
  });
  await rescheduleReminders(moved);
  await notifyRebooked(moved, visit, history);
  return { ok: true, visit: moved, previous: visit, history };
}

export interface ClosedOffer {
  offer: RebookingOffer;
  visit: AppointmentRecord;
  /** The online refund, when the visit was paid through the payment system. */
  refund: CancellationRefund | null;
  /** Refunded through the older desk/demo ledger instead (minor units). */
  ledgerRefundMinor: number;
}

/**
 * Close an offer as cancelled (the patient asked) or expired (nobody answered): its holds are released,
 * the displaced visit is cancelled, and anything paid goes back in full (a clinic-side cancellation).
 * Null when it was already closed. A refund that fails to start is retried by the cron.
 */
export async function closeOffer(offer: RebookingOffer, status: "cancelled" | "expired"): Promise<ClosedOffer | null> {
  const store = await getStore();
  const outcome = await store.closeRebookingOffer(offer.id, status, now().toISOString());
  if (outcome !== "ok") return null;
  forgetBlockedSlots();
  const visit = await store.getAppointment(offer.appointmentId);
  if (!visit) return null;
  const actor = status === "cancelled" ? { id: visit.patientUserId, name: visit.patientName, role: "patient" as const } : SYSTEM_ACTOR;
  const result = await refundDisplaced(visit);
  await recordEvent({
    actor,
    action: "appointment.cancelled",
    subjectType: "appointment",
    subjectId: visit.id,
    summary: visitSummary(visit),
    reason: status === "cancelled" ? "Displaced by a schedule change; the patient chose a refund" : "Displaced by a schedule change; no new time chosen within the offer",
  });
  const closed: ClosedOffer = { offer: { ...offer, status, slots: [], closedAt: now().toISOString() }, visit, ...result };
  await notifyOfferClosed(closed, status);
  return closed;
}

async function refundDisplaced(visit: AppointmentRecord): Promise<Pick<ClosedOffer, "refund" | "ledgerRefundMinor">> {
  const refund = await refundForCancellation(visit, "clinic", SYSTEM_ACTOR.name).catch((error: unknown) => {
    console.error(`[rebooking] Could not refund ${visit.reference}: ${error instanceof Error ? error.message : "unknown error"}`);
    return "error" as const;
  });
  if (refund === "error") return { refund: null, ledgerRefundMinor: 0 };
  if (refund !== null) return { refund, ledgerRefundMinor: 0 };
  const ledgerRefundMinor = await settleCancelledVisit(visit, SYSTEM_ACTOR).catch(() => 0);
  return { refund: null, ledgerRefundMinor };
}

/** The patient asked to cancel instead of picking a time. */
export async function cancelOffer(token: string): Promise<{ ok: true; closed: ClosedOffer } | { ok: false; reason: "invalid" | "closed" | "expired" }> {
  const view = await findOffer(token);
  if (view.state === "invalid") return { ok: false, reason: "invalid" };
  if (view.state === "expired") return { ok: false, reason: "expired" };
  if (view.state !== "pending") return { ok: false, reason: "closed" };
  const closed = await closeOffer(view.offer, "cancelled");
  return closed ? { ok: true, closed } : { ok: false, reason: "closed" };
}

/** Cron: close every pending offer past its expiry. Safe to run repeatedly; each offer closes once. */
export async function expireOffers(instant: Date = now()): Promise<ClosedOffer[]> {
  const store = await getStore();
  const due = (await store.listRebookingOffers({ status: "pending" })).filter((offer) => new Date(offer.expiresAt).getTime() <= instant.getTime());
  const closed: ClosedOffer[] = [];
  for (const offer of due) {
    const result = await closeOffer(offer, "expired");
    if (result) closed.push(result);
  }
  return closed;
}

/* ---------- The doctor's list ---------- */

export type DisplacedStatus = "pending" | "rebooked" | "refunded" | "released";

export interface DisplacedEntry {
  visit: AppointmentRecord;
  offer: RebookingOffer | null;
  status: DisplacedStatus;
}

/**
 * Every visit the doctor displaced, newest first: "pending" while the patient can still choose,
 * "rebooked" once they picked a time, "refunded" when cancelled or lapsed, "released" for an unpaid hold.
 */
export async function displacedFor(doctorId: string): Promise<DisplacedEntry[]> {
  const store = await getStore();
  const [visits, offers] = await Promise.all([store.listAppointments({ doctorId }), store.listRebookingOffers({ doctorId })]);
  const entries: DisplacedEntry[] = [];
  for (const visit of visits) {
    if (!visit.displacedAt) continue;
    const offer = offers.find((item) => item.appointmentId === visit.id) ?? null;
    const status: DisplacedStatus = !offer ? "released" : offer.status === "accepted" ? "rebooked" : offer.status === "pending" ? "pending" : "refunded";
    entries.push({ visit, offer, status });
  }
  return entries.sort((a, b) => (b.visit.displacedAt ?? "").localeCompare(a.visit.displacedAt ?? ""));
}
