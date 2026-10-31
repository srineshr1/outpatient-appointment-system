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
  | "reminder";

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
}

export interface RenderedMessage {
  subject: string;
  text: string;
  html: string;
}

export type SendResult = "sent" | "skipped" | "failed";

/** One way of reaching a person. Email works today; SMS and WhatsApp are stubs ready for a provider. */
export interface NotificationChannel {
  readonly name: ChannelName;
  send(recipient: string, message: RenderedMessage): Promise<SendResult>;
}
