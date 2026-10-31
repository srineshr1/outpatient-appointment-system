export type Role = "patient" | "doctor" | "reception" | "admin";

export const ROLES: readonly Role[] = ["patient", "doctor", "reception", "admin"];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/**
 * "pending_payment": a place held while the patient pays online. It counts towards capacity like a
 * booking. "expired": the hold ran out unpaid. Neither one is an appointment the patient has yet.
 */
export type AppointmentStatus = "booked" | "completed" | "cancelled" | "pending_payment" | "expired";

/** A visit that is over without being attended: cancelled, or a payment hold that ran out. */
export function isClosedStatus(status: AppointmentStatus): boolean {
  return status === "cancelled" || status === "expired";
}

export const APPOINTMENT_STATUSES: readonly AppointmentStatus[] = ["booked", "completed", "cancelled", "pending_payment", "expired"];

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  doctorId: string | null;
  mobile: string;
  dob: string;
}

/** Everything the practice keeps about an account except the password hash. */
export interface UserAccount extends PublicUser {
  /** ISO timestamp. Empty for accounts made before this was recorded. */
  createdAt: string;
  /** Set while an admin has turned the account off. A turned-off account can't sign in. */
  disabledAt: string | null;
  /** Sessions that began before this instant are no longer accepted ("sign out everywhere"). */
  sessionsRevokedAt: string | null;
  /** Doctors with their own book: the room shown to patients. Empty or missing uses the default. */
  doctorRoom?: string;
  /** Doctors with their own book: the special interest shown to patients. */
  doctorInterest?: string;
}

export interface SessionUser extends UserAccount {
  /** ISO timestamp. */
  expiresAt: string;
  /** The practice session row in use, or null when Supabase holds the session. */
  sessionId: string | null;
}

export interface StoredUser extends UserAccount {
  passwordHash: string;
}

export interface NewUser {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: Role;
  doctorId: string | null;
  mobile: string;
  dob: string;
  doctorRoom?: string;
  doctorInterest?: string;
}

export type UserPatch = Partial<
  Pick<
    UserAccount,
    "name" | "role" | "doctorId" | "disabledAt" | "sessionsRevokedAt" | "doctorRoom" | "doctorInterest" | "mobile" | "dob"
  >
>;

/** A practice sign-in session. The cookie token itself is never stored, only its hash. */
export interface SessionRecord {
  /** Random id, safe to show and to use for ending this one session. */
  id: string;
  userId: string;
  /** ISO timestamp. Empty for sessions made before this was recorded. */
  createdAt: string;
  expiresAt: string;
  /** "Chrome on Android", from the user agent. Empty when unknown. */
  device: string;
}

export interface AppointmentRecord {
  id: string;
  reference: string;
  slotId: string;
  doctorId: string;
  date: string;
  time: string;
  reasonId: string;
  patientName: string;
  patientDob: string;
  patientMobile: string;
  patientChi: string;
  note: string;
  status: AppointmentStatus;
  patientUserId: string | null;
  createdAt: string;
  /** The consulting session this visit sits in. Absent on visits booked before sessions existed. */
  sessionId?: string | null;
  /** Wave visits only: the patient's token in the wave, 1 up to the wave's capacity. */
  token?: number | null;
  /** Wave visits only: how many patients the wave takes. A database check keeps the token within it. */
  waveCapacity?: number | null;
  /** Wave visits only: when the wave ends (HH:MM). `time` is when it starts. */
  endTime?: string | null;
}

/** What changes when a booked visit moves. The reference, patient, doctor and fee stay as they are. */
export interface Placement {
  slotId: string;
  date: string;
  time: string;
  sessionId: string | null;
  token: number | null;
  waveCapacity: number | null;
  endTime: string | null;
}

/** One move of a visit: who did it, from where, to where, and when. Append-only. */
export interface RescheduleRecord {
  id: string;
  appointmentId: string;
  reference: string;
  doctorId: string;
  patientUserId: string | null;
  byUserId: string | null;
  byName: string;
  byRole: string;
  fromSlotId: string;
  fromDate: string;
  fromTime: string;
  fromToken: number | null;
  toSlotId: string;
  toDate: string;
  toTime: string;
  toToken: number | null;
  reason: string;
  at: string;
}

export type SessionMode = "stream" | "wave";

/** A doctor's weekly consulting session. */
export interface ConsultSession {
  id: string;
  doctorId: string;
  label: string;
  /** 1 = Monday … 5 = Friday. */
  weekdays: number[];
  /** HH:MM, London time. */
  startTime: string;
  endTime: string;
  room: string;
  mode: SessionMode;
  /** Stream: minutes per slot, one patient each. */
  slotMinutes: number | null;
  /** Wave: minutes per wave. */
  waveMinutes: number | null;
  /** Wave: patients per wave. */
  waveCapacity: number | null;
  /** Set when the doctor removes the session. Kept so earlier visits still make sense. */
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ProfileKind = "patient" | "doctor";

/** A stored profile: the fields depend on `kind` (see profiles.ts). */
export interface ProfileRecord {
  userId: string;
  kind: ProfileKind;
  data: Record<string, unknown>;
  updatedAt: string;
}

/** A pending email sign-in. Only a hash of the code is kept. */
export interface LoginCodeRecord {
  email: string;
  codeHash: string;
  /** ISO timestamps. */
  expiresAt: string;
  sentAt: string;
  attempts: number;
  /** Set once the code is right but the person still has to give their name (new accounts). */
  signupTokenHash: string | null;
}

/* ---------- Simulated payments ---------- */

/** Demo practice: no money really moves. Online card payments are simulated. */
export type PaymentMethod = "online_card" | "desk_card" | "cash";

export const PAYMENT_METHODS: readonly PaymentMethod[] = ["online_card", "desk_card", "cash"];

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === "string" && (PAYMENT_METHODS as readonly string[]).includes(value);
}

/** One movement of money against a visit's fee. Amounts are positive pence; `kind` gives the direction. */
export interface PaymentEntry {
  id: string;
  kind: "payment" | "refund";
  method: PaymentMethod;
  amountPence: number;
  /** ISO timestamp. */
  at: string;
  /** Staff member who took or gave the money; null for online payments and automatic refunds. */
  byUserId: string | null;
  byName: string;
  /** Why a refund was made. Empty for payments. */
  note: string;
}

export interface FeeWaiver {
  at: string;
  byUserId: string | null;
  byName: string;
  reason: string;
}

/** The fee for one visit, keyed by the visit, with every payment and refund made against it. */
export interface ChargeRecord {
  appointmentId: string;
  /** The visit's booking reference, which doubles as the invoice reference. */
  reference: string;
  reasonId: string;
  /** The fee when the visit was booked. Later fee changes don't alter it. */
  amountPence: number;
  createdAt: string;
  entries: PaymentEntry[];
  waiver: FeeWaiver | null;
}

/* ---------- Activity log ---------- */

export type ActorRole = Role | "system" | "anonymous";

/** One line of the activity log. Append-only: nothing in the app edits or deletes events. */
export interface AuditEvent {
  id: string;
  /** ISO timestamp. */
  at: string;
  /** Dotted code such as "appointment.cancelled". */
  action: string;
  actorId: string | null;
  actorName: string;
  actorRole: ActorRole;
  subjectType: "appointment" | "user" | "session" | "email" | "report" | null;
  subjectId: string | null;
  /** Human-readable, for example "Ann Lee, Dr Cho, Thu 29 Oct 09:40 · HSP-482913". Never codes or tokens. */
  summary: string;
  /** The reason given, when the action asks for one. */
  reason: string;
}

export function matchesFilter(visit: Pick<AppointmentRecord, "patientUserId" | "doctorId">, filter: AppointmentFilter): boolean {
  if (filter.patientUserId !== undefined && visit.patientUserId !== filter.patientUserId) return false;
  if (filter.doctorId !== undefined && visit.doctorId !== filter.doctorId) return false;
  return true;
}

export interface AppointmentFilter {
  patientUserId?: string;
  doctorId?: string;
}

export interface ClinicStore {
  ensureReady(): Promise<void>;
  getUserByEmail(email: string): Promise<StoredUser | null>;
  getUserById(id: string): Promise<UserAccount | null>;
  listUsers(): Promise<UserAccount[]>;
  createUser(user: NewUser): Promise<"ok" | "exists">;
  /** Returns the updated account, or null when there is no such account. */
  updateUser(id: string, patch: UserPatch): Promise<UserAccount | null>;
  createSession(tokenHash: string, userId: string, expiresAt: string, device?: string): Promise<void>;
  getSession(tokenHash: string): Promise<{ id: string; userId: string; expiresAt: string } | null>;
  deleteSession(tokenHash: string): Promise<void>;
  listSessions(): Promise<SessionRecord[]>;
  /** True when a session was ended. */
  deleteSessionById(id: string): Promise<boolean>;
  /** Ends every session of a user, except `keepId`. Returns how many were ended. */
  deleteSessionsForUser(userId: string, keepId?: string | null): Promise<number>;
  listBlockedSlotIds(): Promise<string[]>;
  createAppointment(appointment: AppointmentRecord): Promise<"ok" | "taken">;
  /** Every visit, or only one patient's or one doctor's book when a filter is given. */
  listAppointments(filter?: AppointmentFilter): Promise<AppointmentRecord[]>;
  getAppointment(id: string): Promise<AppointmentRecord | null>;
  /** True when a visit already uses this booking reference. */
  referenceInUse(reference: string): Promise<boolean>;
  updateStatus(id: string, status: AppointmentStatus): Promise<void>;
  /**
   * Change a visit's status only if it is still `from`. "stale" when it has moved on; "taken" when
   * going back to a held status (booked, completed, pending_payment) finds the place held by someone else.
   */
  transitionStatus(id: string, from: AppointmentStatus, to: AppointmentStatus): Promise<"ok" | "stale" | "taken">;
  putLoginCode(record: LoginCodeRecord): Promise<void>;
  getLoginCode(email: string): Promise<LoginCodeRecord | null>;
  deleteLoginCode(email: string): Promise<void>;
  listLoginCodes(): Promise<LoginCodeRecord[]>;
  createCharge(charge: ChargeRecord): Promise<"ok" | "exists">;
  getCharge(appointmentId: string): Promise<ChargeRecord | null>;
  listCharges(): Promise<ChargeRecord[]>;
  /**
   * Change one charge without losing a concurrent change. `change` gets the latest record and
   * returns the new one (or null to leave it). It may throw to refuse the change.
   * Resolves to the stored record, or null when there is no charge for that visit.
   */
  updateCharge(appointmentId: string, change: (charge: ChargeRecord) => ChargeRecord | null): Promise<ChargeRecord | null>;
  appendEvent(event: AuditEvent): Promise<void>;
  /** Newest first, at most `limit`. */
  listEvents(limit?: number): Promise<AuditEvent[]>;
  getProfile(userId: string): Promise<ProfileRecord | null>;
  /** Create or replace one account's profile. */
  putProfile(profile: ProfileRecord): Promise<void>;
  listProfiles(kind?: ProfileKind): Promise<ProfileRecord[]>;
  /** Every consulting session, removed ones included, or one doctor's. */
  listConsultSessions(doctorId?: string): Promise<ConsultSession[]>;
  getConsultSession(id: string): Promise<ConsultSession | null>;
  /** Create or replace one session. */
  putConsultSession(session: ConsultSession): Promise<void>;
  /** Create a session only when its id is new: seeding must never undo a doctor's removal. */
  createConsultSessionIfAbsent(session: ConsultSession): Promise<"ok" | "exists">;
  /**
   * Move a booked visit. `fromSlotId` is the slot the caller read: "stale" when the visit has since
   * changed or been cancelled, "taken" when the new slot or token is already held. The history line
   * is stored together with the move, never without it.
   */
  rescheduleAppointment(
    id: string,
    fromSlotId: string,
    to: Placement,
    history: RescheduleRecord,
  ): Promise<"ok" | "taken" | "stale">;
  /** Oldest first. */
  listReschedules(filter?: { appointmentId?: string; doctorId?: string; patientUserId?: string }): Promise<RescheduleRecord[]>;
}
