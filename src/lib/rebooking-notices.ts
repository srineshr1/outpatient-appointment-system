/**
 * What a displaced patient (and their doctor) hears, queued in the outbox only after the change is
 * committed. Email always; a text too for an Indian mobile when SMS is on (the outbox and sendSms
 * decide that, exactly as for other visit notices). The offer email's links are added when it is sent,
 * so no link token is stored. Nothing here throws: the change has already happened.
 */
import type { AppointmentRecord, RebookingOffer, RescheduleRecord } from "./clinic-types";
import { practiceWallClock } from "./clock";
import { formatShortDate } from "./format";
import { dispatchSoon, queueDoctorNotice, queueNotice } from "./notifications/service";
import type { CancellationRefund } from "./payments/service";

const label = (place: { date: string; time: string; token?: number | null }) =>
  `${formatShortDate(place.date)}, ${place.time}${place.token ? ` (token ${place.token})` : ""}`;

function instantLabel(iso: string): string {
  const clock = practiceWallClock(new Date(iso));
  return `${formatShortDate(clock.date)}, ${clock.time}`;
}

/** Each displaced visit: an offer of the held times, or (an unpaid hold) word that it was released. */
export async function notifyDisplaced(displaced: readonly AppointmentRecord[], offers: readonly RebookingOffer[]): Promise<void> {
  for (const visit of displaced) {
    const offer = offers.find((item) => item.appointmentId === visit.id);
    if (offer) {
      await queueNotice("rebooking_offer", visit, {
        dedupe: `rebooking_offer:${offer.id}`,
        extra: {
          offerId: offer.id,
          offerSlots: offer.slots.map((slot) => ({ slotId: slot.slotId, when: label(slot) })),
          expiresWhen: instantLabel(offer.expiresAt),
          reason: offer.reason,
        },
      });
    } else {
      await queueNotice("appointment_cancelled", visit, {
        dedupe: `appointment_cancelled:${visit.id}`,
        extra: {
          cancelledBy: "clinic",
          detail: `The doctor removed this session. ${visit.displacedReason ? `${visit.displacedReason} ` : ""}Nothing was charged; if a payment still goes through it is refunded automatically. You can book another time.`,
        },
      });
    }
  }
  await dispatchSoon();
}

/** The patient picked a new time: confirm it to them and tell the doctor. */
export async function notifyRebooked(visit: AppointmentRecord, previous: AppointmentRecord, history: RescheduleRecord): Promise<void> {
  const previousWhen = label(previous);
  await queueNotice("rebooking_confirmed", visit, { dedupe: `rebooking_confirmed:${history.id}`, extra: { previousWhen } });
  await queueDoctorNotice("doctor_rescheduled", visit, {
    dedupe: `doctor_rebooked:${history.id}`,
    actorUserId: visit.patientUserId,
    extra: { actorName: visit.patientName, previousWhen, reason: "Picked a new time after you changed your hours" },
  });
  await dispatchSoon();
}

/** The offer closed (the patient cancelled, or it lapsed): the final email, and word to the doctor. */
export async function notifyOfferClosed(
  closed: { offer: RebookingOffer; visit: AppointmentRecord; refund: CancellationRefund | null; ledgerRefundMinor: number },
  outcome: "cancelled" | "expired",
): Promise<void> {
  const { offer, visit, refund, ledgerRefundMinor } = closed;
  const online = refund?.refund && refund.refund.status !== "failed" ? refund.refund.amountMinor : refund ? 0 : undefined;
  const refundMinor = online ?? (ledgerRefundMinor > 0 ? ledgerRefundMinor : undefined);
  await queueNotice("rebooking_closed", visit, {
    dedupe: `rebooking_closed:${offer.id}`,
    extra: {
      offerOutcome: outcome,
      previousWhen: label(visit),
      ...(refundMinor !== undefined ? { refundMinor, refundPercent: 100 } : {}),
    },
  });
  await queueDoctorNotice("doctor_cancelled", visit, {
    dedupe: `doctor_rebook_closed:${offer.id}`,
    extra: {
      cancelledBy: outcome === "cancelled" ? "patient" : "clinic",
      actorName: outcome === "cancelled" ? visit.patientName : "The system (no new time was chosen in time)",
      reason: outcome === "cancelled" ? "Chose a refund instead of a new time" : "The held times lapsed after 24 hours",
    },
  });
  await dispatchSoon();
}
