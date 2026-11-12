/**
 * Changes go through the same booking, reschedule and payment functions as the rest of the app.
 * propose* only seals a confirmation. Nothing is written until confirmPending runs, and the slot
 * is read again at that moment.
 */
import { revalidatePath } from "next/cache";
import { actorOf, recordEventSoon, visitSummary } from "../audit";
import { forgetBlockedSlots } from "../blocked-slots";
import type { PublicUser } from "../clinic-types";
import { now, todayIso } from "../clock";
import { findDoctor, reasons } from "../data";
import { formatMoney } from "../fees";
import { formatFull } from "../format";
import { onBookingConfirmedSoon } from "../notifications/service";
import { normalisePhone } from "../phone";
import { onlinePaymentsAvailable } from "../payments/index";
import { resolveFee } from "../payments/fees";
import { beginCheckout, PaymentError } from "../payments/service";
import { confirmBooking, getSlot, SlotUnavailableError } from "../repository";
import { RESCHEDULE_MESSAGES, canMove, mayReschedule, notifyRescheduled, openTimesFor, rescheduleVisit } from "../reschedule";
import { slotStatus } from "../schedule";
import { baseSlotId } from "../sessions";
import { getStore } from "../store";
import { FIELD_ORDER, validatePatient } from "../validate";
import { changeAppointmentStatus } from "../visits";
import { cardFromSealed, claimConfirmation, issueConfirmation, verifyConfirmation, type PendingAction, type PendingCard } from "./confirm-token";
import { reasonLabel } from "./read";

export interface ActionOutcome {
  ok: boolean;
  summary: string;
  payUrl?: string;
}

const CLOSED = "Nothing was changed.";

function when(date: string, time: string): string {
  return `${formatFull(date)} at ${time}`;
}

async function seal(
  user: PublicUser,
  action: PendingAction,
  card: { title: string; summary: string; confirmLabel: string },
): Promise<PendingCard | { error: string }> {
  try {
    return await issueConfirmation(user, action, card);
  } catch {
    return { error: "Confirmations are unavailable until AUTH_SECRET is set on the server. Nothing was changed." };
  }
}

async function refreshBook(): Promise<void> {
  try {
    revalidatePath("/", "layout");
  } catch {
    // Unit tests run outside the Next.js cache.
  }
}

async function slotStillOpen(slotId: string) {
  const slot = await getSlot(slotId);
  if (!slot) return { error: "That time is no longer on the book." as const };
  const status = slotStatus(slot, [], now());
  if (status !== "open") {
    const message =
      status === "past" ? "That time has passed or closed for online booking." : status === "teaching" ? "That time isn't open for booking." : "That time has just been taken.";
    return { error: message };
  }
  return { slot };
}

export async function proposeBook(user: PublicUser, slotId: string, reasonId: string, payOnline: boolean, note: string): Promise<{ forModel: unknown; pending?: PendingCard }> {
  if (user.role !== "patient") return { forModel: { error: "Doctors and staff can't book through the assistant. Sign in as a patient." } };
  if (!reasons.some((reason) => reason.id === reasonId)) {
    return { forModel: { error: "Choose a visit reason: new, follow, meds or bp.", reasons: reasons.map((reason) => ({ id: reason.id, label: reason.label })) } };
  }
  const formError = validatePatient(
    { name: user.name, dob: user.dob, mobile: user.mobile, chi: "", reasonId, note: note.slice(0, 200), isNew: false },
    todayIso(now()),
  );
  const first = FIELD_ORDER.find((key) => formError[key]);
  if (first && first !== "reasonId") {
    return { forModel: { error: `${formError[first]} Add it on your profile before booking. Nothing has been booked.` } };
  }
  const open = await slotStillOpen(slotId);
  if ("error" in open) return { forModel: { error: `${open.error} Nothing has been booked.` } };
  const { slot } = open;
  let fee = 0;
  try {
    fee = await resolveFee(slot.doctorId, reasonId);
  } catch {
    return { forModel: { error: "The fee couldn't be read, so nothing has been booked. Please try again." } };
  }
  const online = payOnline && fee > 0;
  if (online && !onlinePaymentsAvailable()) {
    return { forModel: { error: "Online payment isn't switched on. Ask to book and pay at the desk instead. Nothing has been booked." } };
  }
  const doctor = findDoctor(slot.doctorId)?.name ?? "the doctor";
  const payLine = fee <= 0 ? "There is no fee." : online ? `Pay ${formatMoney(fee)} online. The time is held until payment finishes.` : `Pay ${formatMoney(fee)} at the desk.`;
  const summary = `${doctor}, ${when(slot.date, slot.time)}, ${reasonLabel(reasonId)}. ${payLine}`;
  const pending = await seal(user, { type: "book", slotId: slot.id, reasonId, payOnline: online, note: note.slice(0, 200) }, { title: "Book this visit?", summary, confirmLabel: "Book" });
  if ("error" in pending) return { forModel: { error: pending.error } };
  return {
    pending,
    forModel: {
      needsConfirmation: true,
      summary,
      instruction: "Ask the user to confirm. Do not say it is booked.",
    },
  };
}

export async function proposeCancel(user: PublicUser, visitId: string): Promise<{ forModel: unknown; pending?: PendingCard }> {
  const store = await getStore();
  const visit = await store.getAppointment(visitId);
  if (!visit) return { forModel: { error: "That visit is not on the book." } };
  const allowed = user.role === "patient" ? user.id === visit.patientUserId : user.role === "doctor" && user.doctorId === visit.doctorId;
  if (!allowed) return { forModel: { error: "You can only cancel a visit on your own account." } };
  if (visit.status !== "booked" && visit.status !== "pending_payment") {
    return { forModel: { error: "That visit is already finished, cancelled, or the payment hold has expired." } };
  }
  const who = user.role === "doctor" ? visit.patientName : "your";
  const summary = `Cancel ${who} visit ${visit.reference} on ${when(visit.date, visit.time)} with ${findDoctor(visit.doctorId)?.name ?? "the doctor"}. A paid visit is refunded under the practice rules.`;
  const pending = await seal(user, { type: "cancel", visitId: visit.id }, { title: "Cancel this visit?", summary, confirmLabel: "Cancel visit" });
  if ("error" in pending) return { forModel: { error: pending.error } };
  return { pending, forModel: { needsConfirmation: true, summary, instruction: "Ask the user to confirm. Do not say it is cancelled." } };
}

export async function proposeReschedule(user: PublicUser, visitId: string, slotId: string, reason: string): Promise<{ forModel: unknown; pending?: PendingCard }> {
  const store = await getStore();
  const visit = await store.getAppointment(visitId);
  if (!visit) return { forModel: { error: "That visit is not on the book." } };
  if (!mayReschedule(user, visit)) return { forModel: { error: "You can only move a visit on your own account." } };
  if (!canMove(visit)) return { forModel: { error: "This visit can't be moved. It is cancelled, finished, or has already started." } };
  const open = await slotStillOpen(slotId);
  if ("error" in open) return { forModel: { error: open.error } };
  if (open.slot.doctorId !== visit.doctorId) return { forModel: { error: "Pick one of this doctor's times." } };
  if (open.slot.id === baseSlotId(visit.slotId)) return { forModel: { error: "That is the time the visit already has." } };
  const summary = `Move ${visit.reference} from ${when(visit.date, visit.time)} to ${when(open.slot.date, open.slot.time)}. The doctor stays ${findDoctor(visit.doctorId)?.name ?? "the same"}.`;
  const pending = await seal(
    user,
    { type: "reschedule", visitId: visit.id, slotId: open.slot.id, reason: reason.slice(0, 200) },
    { title: "Move this visit?", summary, confirmLabel: "Move" },
  );
  if ("error" in pending) return { forModel: { error: pending.error } };
  return { pending, forModel: { needsConfirmation: true, summary, instruction: "Ask the user to confirm. Do not say it has moved." } };
}

export async function suggestMove(user: PublicUser, visitId: string) {
  const store = await getStore();
  const visit = await store.getAppointment(visitId);
  if (!visit) return { error: "That visit is not on the book." };
  if (!mayReschedule(user, visit)) return { error: "You can only look at times for your own visit." };
  if (!canMove(visit)) return { error: "This visit can't be moved." };
  const slots = (await openTimesFor(visit)).slice(0, 8);
  return {
    visitId: visit.id,
    reference: visit.reference,
    current: { date: visit.date, time: visit.time },
    suggestions: slots.map((slot) => ({ id: slot.id, date: slot.date, time: slot.time, endTime: slot.endTime ?? null })),
    note: slots.length ? "These times are free now. They can still be taken before you confirm." : "No other open time in the bookable window.",
  };
}

export async function proposePay(user: PublicUser, visitId: string): Promise<{ forModel: unknown; pending?: PendingCard }> {
  if (user.role !== "patient") return { forModel: { error: "Only the patient can pay for a visit." } };
  const store = await getStore();
  const visit = await store.getAppointment(visitId);
  if (!visit || visit.patientUserId !== user.id) return { forModel: { error: "That visit is not on your account." } };
  if (visit.status === "booked") return { forModel: { error: "This visit is already confirmed. Pay any remaining fee at the desk." } };
  if (visit.status !== "pending_payment") return { forModel: { error: "This visit is not waiting for a payment." } };
  if (!onlinePaymentsAvailable()) return { forModel: { error: "Online payment isn't switched on. Pay at the desk, or ask the practice." } };
  const summary = `Continue to payment for ${visit.reference} on ${when(visit.date, visit.time)}. The amount is the fee stored for this visit, not a figure from the chat.`;
  const pending = await seal(user, { type: "pay", visitId: visit.id }, { title: "Pay for this visit?", summary, confirmLabel: "Continue to payment" });
  if ("error" in pending) return { forModel: { error: pending.error } };
  return { pending, forModel: { needsConfirmation: true, summary, instruction: "Ask the user to confirm before opening the payment page." } };
}

export async function confirmPending(user: PublicUser, token: string): Promise<ActionOutcome> {
  let verified;
  try {
    verified = await verifyConfirmation(token, user.id);
  } catch {
    return { ok: false, summary: `The assistant cannot confirm changes until the server has AUTH_SECRET. ${CLOSED}` };
  }
  if (!verified.ok) {
    const summary =
      verified.reason === "expired"
        ? `That confirmation has expired. ${CLOSED} Ask again if you still want it.`
        : verified.reason === "forbidden"
          ? `That confirmation belongs to another account. ${CLOSED}`
          : `That confirmation is not valid. ${CLOSED}`;
    return { ok: false, summary };
  }
  if (!claimConfirmation(verified.sealed.jti, verified.sealed.exp)) {
    return { ok: false, summary: `That confirmation was already used. ${CLOSED}` };
  }
  try {
    return await runAction(user, verified.sealed.action);
  } catch (error) {
    console.error(`[assistant] Confirm failed: ${error instanceof Error ? error.message : "unknown error"}`);
    return { ok: false, summary: `Something went wrong and nothing further was changed. Please try again from the book.` };
  }
}

/** Drop a confirmation the user has refused. It cannot be used afterwards. */
export async function rejectPending(user: PublicUser, token: string): Promise<ActionOutcome> {
  const verified = await verifyConfirmation(token, user.id).catch(() => null);
  if (verified?.ok) claimConfirmation(verified.sealed.jti, verified.sealed.exp);
  return { ok: true, summary: "Okay. I have not booked, cancelled, moved or opened a payment." };
}

async function runAction(user: PublicUser, action: PendingAction): Promise<ActionOutcome> {
  if (action.type === "book") return book(user, action);
  if (action.type === "cancel") return cancel(user, action.visitId);
  if (action.type === "reschedule") return move(user, action.visitId, action.slotId, action.reason);
  return pay(user, action.visitId);
}

async function book(user: PublicUser, action: Extract<PendingAction, { type: "book" }>): Promise<ActionOutcome> {
  if (user.role !== "patient") return { ok: false, summary: `Only a patient can book. ${CLOSED}` };
  const open = await slotStillOpen(action.slotId);
  if ("error" in open) return { ok: false, summary: `${open.error} ${CLOSED}` };
  const slot = open.slot;
  // The fee and the hold are decided again here, from the database, not from the earlier chat.
  let online = action.payOnline;
  if (online) {
    const fee = await resolveFee(slot.doctorId, action.reasonId).catch(() => -1);
    if (fee < 0) return { ok: false, summary: `The fee couldn't be read. ${CLOSED}` };
    if (fee === 0) online = false;
    else if (!onlinePaymentsAvailable()) return { ok: false, summary: `Online payment isn't switched on. ${CLOSED} You can book and pay at the desk.` };
  }
  try {
    const result = await confirmBooking({
      slot,
      reasonId: action.reasonId,
      patientName: user.name,
      patientDob: user.dob,
      patientMobile: normalisePhone(user.mobile) ?? user.mobile.trim(),
      patientChi: "",
      note: action.note,
      patientUserId: user.id,
      payOnline: online,
    });
    await recordEventSoon({
      actor: actorOf(user),
      action: "appointment.booked",
      subjectType: "appointment",
      subjectId: result.visit.id,
      summary: visitSummary(result.visit),
    });
    if (online) {
      try {
        const checkout = await beginCheckout(result.visit);
        await refreshBook();
        const hold = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(checkout.holdExpiresAt));
        return {
          ok: true,
          payUrl: `/pay/${result.visit.id}`,
          summary: `Held ${result.reference} with ${findDoctor(slot.doctorId)?.name ?? "the doctor"} on ${when(result.visit.date, result.visit.time)}. Pay ${formatMoney(checkout.amountMinor)} before ${hold} IST. If payment doesn't finish, the time is released.`,
        };
      } catch (error) {
        await (await getStore()).transitionStatus(result.visit.id, "pending_payment", "expired").catch(() => undefined);
        forgetBlockedSlots();
        console.error(`[assistant] Checkout failed for ${result.reference}: ${error instanceof Error ? error.message : "unknown error"}`);
        await refreshBook();
        return { ok: false, summary: "The payment couldn't be started, so the hold has been released. Nothing is booked. Try again, or pay at the desk." };
      }
    }
    await onBookingConfirmedSoon(result.visit);
    await refreshBook();
    const fee = result.payment?.amountPence ?? 0;
    const pay = fee > 0 ? ` Pay ${formatMoney(fee)} at the desk.` : " There is no fee.";
    return {
      ok: true,
      summary: `Booked ${result.reference} with ${findDoctor(slot.doctorId)?.name ?? "the doctor"} on ${when(result.visit.date, result.visit.time)}.${result.visit.token ? ` Token ${result.visit.token}.` : ""}${pay}`,
    };
  } catch (error) {
    if (error instanceof SlotUnavailableError) {
      const message = error.reason === "past" ? "That time has passed or closed for online booking." : "That time has just been taken.";
      return { ok: false, summary: `${message} ${CLOSED}` };
    }
    return { ok: false, summary: `The booking system couldn't be reached. ${CLOSED}` };
  }
}

async function cancel(user: PublicUser, visitId: string): Promise<ActionOutcome> {
  const outcome = await changeAppointmentStatus(user, visitId, "cancelled", "Cancelled in the assistant");
  await refreshBook();
  if (outcome !== "ok") {
    const message = outcome === "missing" ? "That visit is no longer on the book." : outcome === "forbidden" ? "You can only cancel your own visit." : "That visit can no longer be cancelled.";
    return { ok: false, summary: `${message} ${CLOSED}` };
  }
  const store = await getStore();
  const visit = await store.getAppointment(visitId);
  return {
    ok: true,
    summary: `Cancelled ${visit?.reference ?? "the visit"}. If it was paid, the refund follows the practice rules and shows under Payments.`,
  };
}

async function move(user: PublicUser, visitId: string, slotId: string, reason: string): Promise<ActionOutcome> {
  const open = await slotStillOpen(slotId);
  if ("error" in open) return { ok: false, summary: `${open.error} ${CLOSED}` };
  const outcome = await rescheduleVisit(user, visitId, slotId, reason);
  await refreshBook();
  if (!outcome.ok) return { ok: false, summary: `${RESCHEDULE_MESSAGES[outcome.reason]} ${CLOSED}` };
  await notifyRescheduled(user, outcome.visit, outcome.history);
  return { ok: true, summary: `Moved ${outcome.visit.reference} to ${when(outcome.visit.date, outcome.visit.time)}.` };
}

async function pay(user: PublicUser, visitId: string): Promise<ActionOutcome> {
  if (user.role !== "patient") return { ok: false, summary: `Only the patient can pay. ${CLOSED}` };
  const visit = await (await getStore()).getAppointment(visitId);
  if (!visit || visit.patientUserId !== user.id) return { ok: false, summary: `That visit is not on your account. ${CLOSED}` };
  if (visit.status !== "pending_payment") return { ok: false, summary: `This visit is not waiting for payment. ${CLOSED}` };
  try {
    const checkout = await beginCheckout(visit);
    return {
      ok: true,
      payUrl: `/pay/${visit.id}`,
      summary: `Payment is ready for ${visit.reference}: ${formatMoney(checkout.amountMinor)}. Open Pay to finish. The hold runs out at ${checkout.holdExpiresAt}.`,
    };
  } catch (error) {
    if (error instanceof PaymentError) return { ok: false, summary: `${error.message} ${CLOSED}` };
    return { ok: false, summary: `The payment couldn't be started. ${CLOSED} If money left your account, it will be confirmed or refunded.` };
  }
}

export async function restoreCard(user: PublicUser, token: string): Promise<PendingCard | null> {
  const verified = await verifyConfirmation(token, user.id).catch(() => null);
  if (!verified?.ok) return null;
  if (!isAction(verified.sealed.action)) return null;
  return cardFromSealed(token, verified.sealed);
}

function isAction(value: PendingAction): boolean {
  return value.type === "book" || value.type === "cancel" || value.type === "reschedule" || value.type === "pay";
}
