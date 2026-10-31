import { actorOf, recordEvent, visitSummary } from "./audit";
import { settleCancelledVisit } from "./billing";
import type { AppointmentRecord, AppointmentStatus, PublicUser, RescheduleRecord } from "./clinic-types";
import { forgetBlockedSlots } from "./blocked-slots";
import { cancelReminders, dispatchSoon, queueNotice } from "./notifications/service";
import { refundForCancellation, type CancellationRefund } from "./payments/service";
import { getStore } from "./store";

export type VisitChange = "ok" | "missing" | "forbidden" | "closed";

export function sortVisits(visits: readonly AppointmentRecord[]): AppointmentRecord[] {
  return [...visits].sort((a, b) => (a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)));
}

/** Reception and admins see every doctor's book. */
export function seesWholeBook(user: Pick<PublicUser, "role">): boolean {
  return user.role === "reception" || user.role === "admin";
}

export async function visitsFor(user: PublicUser): Promise<AppointmentRecord[]> {
  const store = await getStore();
  // Ask the store for just this person's book rather than reading every visit and filtering here.
  if (seesWholeBook(user)) return sortVisits(await store.listAppointments());
  if (user.role === "doctor") {
    if (!user.doctorId) return [];
    return sortVisits(await store.listAppointments({ doctorId: user.doctorId }));
  }
  return sortVisits(await store.listAppointments({ patientUserId: user.id }));
}

export async function changeAppointmentStatus(
  actor: PublicUser,
  id: string,
  status: Extract<AppointmentStatus, "completed" | "cancelled">,
  reason = "",
): Promise<VisitChange> {
  const store = await getStore();
  const visit = await store.getAppointment(id);
  if (!visit) return "missing";
  // A held place that is waiting for payment can be given up; nothing else is open except a booked visit.
  if (visit.status !== "booked" && visit.status !== "pending_payment") return "closed";
  if (visit.status === "pending_payment" && status === "completed") return "closed";

  const owns = actor.id === visit.patientUserId;
  const doctor = actor.role === "doctor" && actor.doctorId === visit.doctorId;
  const desk = seesWholeBook(actor);
  if (status === "completed" && !(doctor || desk)) return "forbidden";
  if (status === "cancelled" && !(owns || doctor || desk)) return "forbidden";

  // Move from the status we read, so two people cancelling at once (or a payment landing) change it once.
  if ((await store.transitionStatus(id, visit.status, status)) !== "ok") return "closed";
  forgetBlockedSlots();
  const who = actorOf(actor);
  await recordEvent({
    actor: who,
    action: status === "cancelled" ? "appointment.cancelled" : "appointment.completed",
    subjectType: "appointment",
    subjectId: visit.id,
    summary: visitSummary(visit),
    reason: reason.trim().slice(0, 200),
  });
  // Reminders only make sense for a visit that is still going to happen.
  await cancelReminders(visit.id);
  if (status === "cancelled" && visit.status === "booked") {
    const cancelledBy = owns && !doctor && !desk ? "patient" : "clinic";
    // Paid through the payment system: the refund policy decides. Otherwise the older desk and demo flow applies.
    const real: CancellationRefund | null | "error" = await refundForCancellation(visit, cancelledBy, who.name).catch((error: unknown) => {
      console.error(`[payments] Could not refund ${visit.reference}: ${error instanceof Error ? error.message : "unknown error"}`);
      return "error" as const;
    });
    if (real === null) {
      await settleCancelledVisit(visit, who).catch((error: unknown) => {
        console.error(`[billing] Could not refund ${visit.reference}: ${error instanceof Error ? error.message : "unknown error"}`);
      });
    }
    const refund = real && real !== "error" ? real : null;
    const refunding = refund?.refund && refund.refund.status !== "failed" ? refund.refund.amountMinor : refund ? 0 : undefined;
    await queueNotice("appointment_cancelled", visit, {
      dedupe: `appointment_cancelled:${visit.id}`,
      extra: {
        cancelledBy,
        ...(refunding !== undefined ? { refundMinor: refunding, refundPercent: refund?.decision.percent, detail: refund?.decision.explanation } : {}),
        ...(real === "error" ? { detail: "Any refund due is being looked at by the practice and you will hear from us." } : {}),
      },
    });
    await dispatchSoon();
  }
  return "ok";
}

/** The moves made to the visits `user` can see, oldest first, grouped by visit. */
export async function reschedulesFor(user: PublicUser): Promise<Record<string, RescheduleRecord[]>> {
  const store = await getStore();
  let moves: RescheduleRecord[];
  if (seesWholeBook(user)) moves = await store.listReschedules();
  else if (user.role === "doctor") moves = user.doctorId ? await store.listReschedules({ doctorId: user.doctorId }) : [];
  else moves = await store.listReschedules({ patientUserId: user.id });
  const grouped: Record<string, RescheduleRecord[]> = {};
  for (const move of moves) (grouped[move.appointmentId] ??= []).push(move);
  return grouped;
}
