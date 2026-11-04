/** Notification kinds, the data each one carries, and the channel abstraction. */
export type NotificationKind =
  | "booking_confirmed"
  | "appointment_cancelled"
  | "payment_confirmed"
  | "payment_failed"
  | "hold_expired"
  | "refund_initiated"
  | "refund_completed"
  | "refund_failed"
  | "reminder"
  | "appointment_rescheduled"
  | "doctor_booking"
  | "doctor_cancelled"
  | "doctor_rescheduled"
  | "doctor_daily_summary";

/** The notices that go to a doctor rather than a patient. */
export const DOCTOR_KINDS: readonly NotificationKind[] = ["doctor_booking", "doctor_cancelled", "doctor_rescheduled", "doctor_daily_summary"];

export type ChannelName = "email" | "sms" | "whatsapp";

/** Everything a template needs. Stored in the outbox row's payload, so a notice reads the same when it is sent later. */
export interface NoticeData {
  firstName: string;
  patientName: string;
  reference: string;
  doctorName: string;
  /** "Thu 29 Oct, 09:40" */
  when: string;
  token?: number | null;
  /** ISO instant the visit starts. Reminders compare it with the visit to notice a move. */
  startsAt?: string;
  amountMinor?: number;
  refundMinor?: number;
  refundPercent?: number;
  /** Cancelled by whom, for the cancellation wording. */
  cancelledBy?: "patient" | "clinic";
  /** One sentence explaining a refund amount or a failure. */
  detail?: string;
  /** Minutes before the visit this reminder is for. */
  offsetMinutes?: number;
  /** Where the patient can act on it, e.g. /pay/<id> or /appointments. */
  path?: string;
  /** Payment id, for receipt links. */
  paymentId?: string;
  /** Why the visit is booked, e.g. "A follow-up". */
  reasonLabel?: string;
  /** The patient's mobile number, for the doctor's notices. */
  patientMobile?: string;
  /** Who cancelled or moved the visit, by name. */
  actorName?: string;
  /** The time the visit had before it moved. */
  previousWhen?: string;
  /** The reason given for a move or cancellation. */
  reason?: string;
  /** Daily summary: the calendar date ("Mon 2 Nov") and the day's visits. */
  dateLabel?: string;
  items?: Array<{ time: string; patientName: string; reasonLabel: string; reference: string; token?: number | null }>;
}

export interface RenderedMessage {
  subject: string;
  text: string;
  html: string;
  /** Plain short text for SMS channels. */
  sms?: string;
}

export type SendResult = "sent" | "skipped" | "failed";

/** One way of reaching a person. Email works today; SMS and WhatsApp are stubs ready for a provider. */
export interface NotificationChannel {
  readonly name: ChannelName;
  send(recipient: string, message: RenderedMessage): Promise<SendResult>;
}
