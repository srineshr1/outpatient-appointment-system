import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  isPaymentMethod,
  isRole,
  matchesFilter,
  type AppointmentFilter,
  type AppointmentRecord,
  type AppointmentStatus,
  type AuditEvent,
  type ChargeRecord,
  type ClinicStore,
  type ConsultSession,
  type LoginCodeRecord,
  type NewUser,
  type PaymentEntry,
  type Placement,
  type ProfileKind,
  type ProfileRecord,
  type RescheduleRecord,
  type SessionRecord,
  type StoredUser,
  type UserAccount,
  type UserPatch,
} from "./clinic-types";

/**
 * The clinic's data in the practice's Supabase Postgres. Server only: it uses the service role key,
 * and the tables have row level security on with no public policies, so nothing else can read them.
 * Tables, constraints and the two charge functions are in supabase/migrations.
 */

const PAGE = 1000;

type Row = Record<string, unknown>;

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  role: string;
  doctor_id: string | null;
  mobile: string;
  dob: string;
  created_at: string | null;
  disabled_at: string | null;
  sessions_revoked_at: string | null;
  doctor_room: string | null;
  doctor_interest: string | null;
}

interface SessionRow {
  id: string;
  user_id: string;
  created_at: string | null;
  expires_at: string;
  device: string | null;
}

interface AppointmentRow {
  id: string;
  reference: string;
  slot_id: string;
  doctor_id: string;
  date: string;
  time: string;
  reason_id: string;
  patient_name: string;
  patient_dob: string;
  patient_mobile: string;
  patient_chi: string;
  note: string;
  status: string;
  patient_user_id: string | null;
  created_at: string;
  session_id: string | null;
  token: number | null;
  wave_capacity: number | null;
  end_time: string | null;
}

interface ProfileRow {
  user_id: string;
  kind: string;
  data: unknown;
  updated_at: string;
}

interface ConsultSessionRow {
  id: string;
  doctor_id: string;
  label: string;
  weekdays: string;
  start_time: string;
  end_time: string;
  room: string;
  mode: string;
  slot_minutes: number | null;
  wave_minutes: number | null;
  wave_capacity: number | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

interface RescheduleRow {
  id: string;
  appointment_id: string;
  reference: string;
  doctor_id: string;
  patient_user_id: string | null;
  by_user_id: string | null;
  by_name: string;
  by_role: string;
  from_slot_id: string;
  from_date: string;
  from_time: string;
  from_token: number | null;
  to_slot_id: string;
  to_date: string;
  to_time: string;
  to_token: number | null;
  reason: string;
  at: string;
}

interface LoginCodeRow {
  email: string;
  code_hash: string;
  expires_at: string;
  sent_at: string;
  attempts: number;
  signup_token_hash: string | null;
}

interface EntryRow {
  id: string;
  kind: string;
  method: string;
  amount_pence: number;
  at: string;
  by_user_id: string | null;
  by_name: string;
  note: string;
}

interface ChargeRow {
  appointment_id: string;
  reference: string;
  reason_id: string;
  amount_pence: number;
  created_at: string;
  waived_at: string | null;
  waived_by_user_id: string | null;
  waived_by_name: string;
  waived_reason: string;
  version: number;
  clinic_payment_entries?: EntryRow[] | null;
}

interface EventRow {
  id: string;
  at: string;
  action: string;
  actor_id: string | null;
  actor_name: string;
  actor_role: string;
  subject_type: string | null;
  subject_id: string | null;
  summary: string;
  reason: string;
}

interface DbError {
  code?: string;
  message: string;
}

function fail(error: DbError | null): void {
  // The message comes from Postgres or PostgREST and never carries a key or a password hash.
  if (error) throw new Error(`Clinic database: ${error.message}`);
}

const UNIQUE_VIOLATION = "23505";

function isStatus(value: string): value is AppointmentStatus {
  return value === "booked" || value === "completed" || value === "cancelled";
}

function toUser(row: UserRow): StoredUser {
  if (!isRole(row.role)) throw new Error("Stored user has an unknown role.");
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    name: row.name,
    role: row.role,
    doctorId: row.doctor_id,
    mobile: row.mobile,
    dob: row.dob,
    createdAt: row.created_at ?? "",
    disabledAt: row.disabled_at,
    sessionsRevokedAt: row.sessions_revoked_at,
    ...(row.doctor_room ? { doctorRoom: row.doctor_room } : {}),
    ...(row.doctor_interest ? { doctorInterest: row.doctor_interest } : {}),
  };
}

function withoutSecret(user: StoredUser): UserAccount {
  const { passwordHash: _secret, ...account } = user;
  return account;
}

function toAppointment(row: AppointmentRow): AppointmentRecord {
  if (!isStatus(row.status)) throw new Error("Stored visit has an unknown status.");
  return {
    id: row.id,
    reference: row.reference,
    slotId: row.slot_id,
    doctorId: row.doctor_id,
    date: row.date,
    time: row.time,
    reasonId: row.reason_id,
    patientName: row.patient_name,
    patientDob: row.patient_dob,
    patientMobile: row.patient_mobile,
    patientChi: row.patient_chi,
    note: row.note,
    status: row.status,
    patientUserId: row.patient_user_id,
    createdAt: row.created_at,
    sessionId: row.session_id ?? null,
    token: row.token ?? null,
    waveCapacity: row.wave_capacity ?? null,
    endTime: row.end_time ?? null,
  };
}

function toProfile(row: ProfileRow): ProfileRecord {
  const data = row.data && typeof row.data === "object" && !Array.isArray(row.data) ? (row.data as Record<string, unknown>) : {};
  return { userId: row.user_id, kind: row.kind === "doctor" ? "doctor" : "patient", data, updatedAt: row.updated_at };
}

function toConsultSession(row: ConsultSessionRow): ConsultSession {
  return {
    id: row.id,
    doctorId: row.doctor_id,
    label: row.label,
    weekdays: row.weekdays
      .split(",")
      .map((day) => Number(day))
      .filter((day) => Number.isInteger(day)),
    startTime: row.start_time,
    endTime: row.end_time,
    room: row.room,
    mode: row.mode === "wave" ? "wave" : "stream",
    slotMinutes: row.slot_minutes,
    waveMinutes: row.wave_minutes,
    waveCapacity: row.wave_capacity,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function sessionPayload(session: ConsultSession): Row {
  return {
    id: session.id,
    doctor_id: session.doctorId,
    label: session.label,
    weekdays: session.weekdays.join(","),
    start_time: session.startTime,
    end_time: session.endTime,
    room: session.room,
    mode: session.mode,
    slot_minutes: session.slotMinutes,
    wave_minutes: session.waveMinutes,
    wave_capacity: session.waveCapacity,
    archived_at: session.archivedAt,
    created_at: session.createdAt,
    updated_at: session.updatedAt,
  };
}

function toReschedule(row: RescheduleRow): RescheduleRecord {
  return {
    id: row.id,
    appointmentId: row.appointment_id,
    reference: row.reference,
    doctorId: row.doctor_id,
    patientUserId: row.patient_user_id,
    byUserId: row.by_user_id,
    byName: row.by_name,
    byRole: row.by_role,
    fromSlotId: row.from_slot_id,
    fromDate: row.from_date,
    fromTime: row.from_time,
    fromToken: row.from_token,
    toSlotId: row.to_slot_id,
    toDate: row.to_date,
    toTime: row.to_time,
    toToken: row.to_token,
    reason: row.reason,
    at: row.at,
  };
}

function toLoginCode(row: LoginCodeRow): LoginCodeRecord {
  return {
    email: row.email,
    codeHash: row.code_hash,
    expiresAt: row.expires_at,
    sentAt: row.sent_at,
    attempts: Number(row.attempts),
    signupTokenHash: row.signup_token_hash,
  };
}

function toEntry(row: EntryRow): PaymentEntry {
  if (!isPaymentMethod(row.method) || (row.kind !== "payment" && row.kind !== "refund")) {
    throw new Error("Stored payment has an unknown kind or method.");
  }
  return {
    id: row.id,
    kind: row.kind,
    method: row.method,
    amountPence: Number(row.amount_pence),
    at: row.at,
    byUserId: row.by_user_id,
    byName: row.by_name,
    note: row.note,
  };
}

function byEntryTime(a: PaymentEntry, b: PaymentEntry): number {
  return a.at === b.at ? a.id.localeCompare(b.id) : a.at.localeCompare(b.at);
}

function toCharge(row: ChargeRow): ChargeRecord {
  const entries = (row.clinic_payment_entries ?? []).map(toEntry).sort(byEntryTime);
  return {
    appointmentId: row.appointment_id,
    reference: row.reference,
    reasonId: row.reason_id,
    amountPence: Number(row.amount_pence),
    createdAt: row.created_at,
    entries,
    waiver: row.waived_at
      ? { at: row.waived_at, byUserId: row.waived_by_user_id, byName: row.waived_by_name, reason: row.waived_reason }
      : null,
  };
}

function toEvent(row: EventRow): AuditEvent {
  const actorRole = row.actor_role === "system" || row.actor_role === "anonymous" || isRole(row.actor_role) ? row.actor_role : "system";
  const subjectTypes = ["appointment", "user", "session", "email", "report"] as const;
  const subjectType = subjectTypes.find((type) => type === row.subject_type) ?? null;
  return {
    id: row.id,
    at: row.at,
    action: row.action,
    actorId: row.actor_id,
    actorName: row.actor_name,
    actorRole,
    subjectType,
    subjectId: row.subject_id,
    summary: row.summary,
    reason: row.reason,
  };
}

function entryPayload(entry: PaymentEntry): Row {
  return {
    id: entry.id,
    kind: entry.kind,
    method: entry.method,
    amount_pence: entry.amountPence,
    at: entry.at,
    by_user_id: entry.byUserId,
    by_name: entry.byName,
    note: entry.note,
  };
}

function waiverPayload(charge: ChargeRecord): Row {
  return {
    waived_at: charge.waiver?.at ?? null,
    waived_by_user_id: charge.waiver?.byUserId ?? null,
    waived_by_name: charge.waiver?.byName ?? "",
    waived_reason: charge.waiver?.reason ?? "",
  };
}

/** The service role key name Supabase's own docs and its Vercel integration use. */
export function supabaseServiceKey(): string | undefined {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || undefined;
}

export function supabaseStoreConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && supabaseServiceKey());
}

export class SupabaseClinicStore implements ClinicStore {
  private readonly db: SupabaseClient;

  constructor(url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = supabaseServiceKey()) {
    if (!url || !key) {
      throw new Error("DATA_STORE=supabase needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    }
    this.db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  /** Tables come from the migration in supabase/migrations, so there is nothing to create here. */
  async ensureReady(): Promise<void> {}

  /** Reads every row, a page at a time, because the API returns at most 1000 rows per request. */
  private async readAll<T>(
    build: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: DbError | null }>,
    limit = Number.POSITIVE_INFINITY,
  ): Promise<T[]> {
    const rows: T[] = [];
    for (let from = 0; rows.length < limit; from += PAGE) {
      const to = from + Math.min(PAGE, limit - rows.length) - 1;
      const { data, error } = await build(from, to);
      fail(error);
      const page = (data ?? []) as T[];
      rows.push(...page);
      if (page.length < to - from + 1) break;
    }
    return rows;
  }

  async getUserByEmail(email: string): Promise<StoredUser | null> {
    const { data, error } = await this.db.from("clinic_users").select("*").eq("email", email).maybeSingle();
    fail(error);
    return data ? toUser(data as UserRow) : null;
  }

  async getUserById(id: string): Promise<UserAccount | null> {
    const { data, error } = await this.db.from("clinic_users").select("*").eq("id", id).maybeSingle();
    fail(error);
    return data ? withoutSecret(toUser(data as UserRow)) : null;
  }

  async listUsers(): Promise<UserAccount[]> {
    const rows = await this.readAll<UserRow>((from, to) =>
      this.db.from("clinic_users").select("*").order("created_at").order("id").range(from, to),
    );
    return rows.map((row) => withoutSecret(toUser(row)));
  }

  async createUser(user: NewUser): Promise<"ok" | "exists"> {
    const { error } = await this.db.from("clinic_users").insert({
      id: user.id,
      email: user.email,
      password_hash: user.passwordHash,
      name: user.name,
      role: user.role,
      doctor_id: user.doctorId,
      mobile: user.mobile,
      dob: user.dob,
      created_at: new Date().toISOString(),
      doctor_room: user.doctorRoom || null,
      doctor_interest: user.doctorInterest || null,
    });
    // A second cold start seeding the same demo account lands here: the first insert won.
    if (error?.code === UNIQUE_VIOLATION) return "exists";
    fail(error);
    return "ok";
  }

  async updateUser(id: string, patch: UserPatch): Promise<UserAccount | null> {
    const columns: Record<keyof UserPatch, string> = {
      name: "name",
      role: "role",
      doctorId: "doctor_id",
      disabledAt: "disabled_at",
      sessionsRevokedAt: "sessions_revoked_at",
      doctorRoom: "doctor_room",
      doctorInterest: "doctor_interest",
      mobile: "mobile",
      dob: "dob",
    };
    if (patch.role !== undefined && !isRole(patch.role)) throw new Error("Unknown role.");
    const changes: Row = {};
    for (const key of Object.keys(patch) as (keyof UserPatch)[]) {
      if (patch[key] !== undefined) changes[columns[key]] = patch[key] ?? null;
    }
    if (Object.keys(changes).length === 0) return this.getUserById(id);
    const { data, error } = await this.db.from("clinic_users").update(changes).eq("id", id).select("*").maybeSingle();
    fail(error);
    return data ? withoutSecret(toUser(data as UserRow)) : null;
  }

  async createSession(tokenHash: string, userId: string, expiresAt: string, device = ""): Promise<void> {
    // One request in the normal case. A repeat of the same token (a unique violation) only changes
    // the owner and expiry; its id and start stay.
    const { error } = await this.db.from("clinic_sessions").insert({
      token_hash: tokenHash,
      id: crypto.randomUUID(),
      user_id: userId,
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
      device: device.slice(0, 80),
    });
    if (error?.code === UNIQUE_VIOLATION) {
      const { error: updateError } = await this.db
        .from("clinic_sessions")
        .update({ user_id: userId, expires_at: expiresAt })
        .eq("token_hash", tokenHash);
      fail(updateError);
      return;
    }
    fail(error);
  }

  async getSession(tokenHash: string): Promise<{ id: string; userId: string; expiresAt: string } | null> {
    const { data, error } = await this.db
      .from("clinic_sessions")
      .select("id, user_id, expires_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    fail(error);
    const row = data as Pick<SessionRow, "id" | "user_id" | "expires_at"> | null;
    return row ? { id: row.id, userId: row.user_id, expiresAt: row.expires_at } : null;
  }

  async deleteSession(tokenHash: string): Promise<void> {
    const { error } = await this.db.from("clinic_sessions").delete().eq("token_hash", tokenHash);
    fail(error);
  }

  async listSessions(): Promise<SessionRecord[]> {
    const rows = await this.readAll<SessionRow>((from, to) =>
      this.db
        .from("clinic_sessions")
        .select("id, user_id, created_at, expires_at, device")
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, to),
    );
    return rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      createdAt: row.created_at ?? "",
      expiresAt: row.expires_at,
      device: row.device ?? "",
    }));
  }

  async deleteSessionById(id: string): Promise<boolean> {
    const { data, error } = await this.db.from("clinic_sessions").delete().eq("id", id).select("id");
    fail(error);
    return (data?.length ?? 0) > 0;
  }

  async deleteSessionsForUser(userId: string, keepId: string | null = null): Promise<number> {
    let query = this.db.from("clinic_sessions").delete().eq("user_id", userId);
    if (keepId) query = query.neq("id", keepId);
    const { data, error } = await query.select("id");
    fail(error);
    return data?.length ?? 0;
  }

  async listBlockedSlotIds(): Promise<string[]> {
    const rows = await this.readAll<{ slot_id: string }>((from, to) =>
      this.db
        .from("clinic_appointments")
        .select("slot_id")
        .in("status", ["booked", "completed"])
        .order("slot_id")
        .range(from, to),
    );
    return rows.map((row) => row.slot_id);
  }

  async createAppointment(appointment: AppointmentRecord): Promise<"ok" | "taken"> {
    // The partial unique index on held slots decides a race: exactly one insert wins.
    const { error } = await this.db.from("clinic_appointments").insert({
      id: appointment.id,
      reference: appointment.reference,
      slot_id: appointment.slotId,
      doctor_id: appointment.doctorId,
      date: appointment.date,
      time: appointment.time,
      reason_id: appointment.reasonId,
      patient_name: appointment.patientName,
      patient_dob: appointment.patientDob,
      patient_mobile: appointment.patientMobile,
      patient_chi: appointment.patientChi,
      note: appointment.note,
      status: appointment.status,
      patient_user_id: appointment.patientUserId,
      created_at: appointment.createdAt,
      session_id: appointment.sessionId ?? null,
      token: appointment.token ?? null,
      wave_capacity: appointment.waveCapacity ?? null,
      end_time: appointment.endTime ?? null,
    });
    if (error?.code === UNIQUE_VIOLATION) return "taken";
    fail(error);
    return "ok";
  }

  async listAppointments(filter: AppointmentFilter = {}): Promise<AppointmentRecord[]> {
    const rows = await this.readAll<AppointmentRow>((from, to) => {
      let query = this.db.from("clinic_appointments").select("*");
      if (filter.patientUserId !== undefined) query = query.eq("patient_user_id", filter.patientUserId);
      if (filter.doctorId !== undefined) query = query.eq("doctor_id", filter.doctorId);
      return query.order("created_at").order("id").range(from, to);
    });
    return rows.map(toAppointment);
  }

  async referenceInUse(reference: string): Promise<boolean> {
    const { data, error } = await this.db.from("clinic_appointments").select("id").eq("reference", reference).limit(1);
    fail(error);
    return (data?.length ?? 0) > 0;
  }

  async getAppointment(id: string): Promise<AppointmentRecord | null> {
    const { data, error } = await this.db.from("clinic_appointments").select("*").eq("id", id).maybeSingle();
    fail(error);
    return data ? toAppointment(data as AppointmentRow) : null;
  }

  async updateStatus(id: string, status: AppointmentStatus): Promise<void> {
    const { error } = await this.db.from("clinic_appointments").update({ status }).eq("id", id);
    fail(error);
  }

  async putLoginCode(record: LoginCodeRecord): Promise<void> {
    const { error } = await this.db.from("clinic_login_codes").upsert(
      {
        email: record.email,
        code_hash: record.codeHash,
        expires_at: record.expiresAt,
        sent_at: record.sentAt,
        attempts: record.attempts,
        signup_token_hash: record.signupTokenHash,
      },
      { onConflict: "email" },
    );
    fail(error);
  }

  async getLoginCode(email: string): Promise<LoginCodeRecord | null> {
    const { data, error } = await this.db.from("clinic_login_codes").select("*").eq("email", email).maybeSingle();
    fail(error);
    return data ? toLoginCode(data as LoginCodeRow) : null;
  }

  async deleteLoginCode(email: string): Promise<void> {
    const { error } = await this.db.from("clinic_login_codes").delete().eq("email", email);
    fail(error);
  }

  async listLoginCodes(): Promise<LoginCodeRecord[]> {
    const rows = await this.readAll<LoginCodeRow>((from, to) =>
      this.db.from("clinic_login_codes").select("*").order("sent_at", { ascending: false }).order("email").range(from, to),
    );
    return rows.map(toLoginCode);
  }

  private async readCharge(appointmentId: string): Promise<{ charge: ChargeRecord; version: number } | null> {
    // One request returns the charge with its payment lines.
    const { data, error } = await this.db
      .from("clinic_charges")
      .select("*, clinic_payment_entries(*)")
      .eq("appointment_id", appointmentId)
      .maybeSingle();
    fail(error);
    const row = data as ChargeRow | null;
    return row ? { charge: toCharge(row), version: Number(row.version) } : null;
  }

  async createCharge(charge: ChargeRecord): Promise<"ok" | "exists"> {
    const { data, error } = await this.db.rpc("clinic_create_charge", {
      p_charge: {
        appointment_id: charge.appointmentId,
        reference: charge.reference,
        reason_id: charge.reasonId,
        amount_pence: charge.amountPence,
        created_at: charge.createdAt,
        ...waiverPayload(charge),
      },
      p_entries: charge.entries.map(entryPayload),
    });
    fail(error);
    return data === "ok" ? "ok" : "exists";
  }

  async getCharge(appointmentId: string): Promise<ChargeRecord | null> {
    return (await this.readCharge(appointmentId))?.charge ?? null;
  }

  async listCharges(): Promise<ChargeRecord[]> {
    const rows = await this.readAll<ChargeRow>((from, to) =>
      this.db.from("clinic_charges").select("*, clinic_payment_entries(*)").order("appointment_id").range(from, to),
    );
    return rows.map(toCharge);
  }

  async updateCharge(
    appointmentId: string,
    change: (charge: ChargeRecord) => ChargeRecord | null,
  ): Promise<ChargeRecord | null> {
    // Optimistic: apply against the version we read, and read again if someone else changed it first.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const current = await this.readCharge(appointmentId);
      if (!current) return null;
      const next = change(current.charge);
      if (!next) return current.charge;
      const known = new Set(current.charge.entries.map((entry) => entry.id));
      const kept = new Set(next.entries.map((entry) => entry.id));
      if ([...known].some((id) => !kept.has(id))) throw new Error("Payments can’t be removed, only refunded.");
      const added = next.entries.filter((entry) => !known.has(entry.id)).sort(byEntryTime);
      const { data, error } = await this.db.rpc("clinic_apply_charge", {
        p_appointment_id: appointmentId,
        p_version: current.version,
        p_waiver: waiverPayload(next),
        p_entries: added.map(entryPayload),
      });
      fail(error);
      if (data === "ok") return (await this.readCharge(appointmentId))?.charge ?? null;
    }
    throw new Error("This visit’s payments were changed at the same time. Try again.");
  }

  async appendEvent(event: AuditEvent): Promise<void> {
    const { error } = await this.db.from("clinic_audit_events").insert({
      id: event.id,
      at: event.at,
      action: event.action,
      actor_id: event.actorId,
      actor_name: event.actorName,
      actor_role: event.actorRole,
      subject_type: event.subjectType,
      subject_id: event.subjectId,
      summary: event.summary,
      reason: event.reason,
    });
    fail(error);
  }

  async listEvents(limit = 1000): Promise<AuditEvent[]> {
    const rows = await this.readAll<EventRow>(
      (from, to) =>
        this.db
          .from("clinic_audit_events")
          .select("id, at, action, actor_id, actor_name, actor_role, subject_type, subject_id, summary, reason")
          .order("at", { ascending: false })
          .order("seq", { ascending: false })
          .range(from, to),
      Math.max(1, Math.floor(limit)),
    );
    return rows.map(toEvent);
  }

  async getProfile(userId: string): Promise<ProfileRecord | null> {
    const { data, error } = await this.db.from("clinic_profiles").select("*").eq("user_id", userId).maybeSingle();
    fail(error);
    return data ? toProfile(data as ProfileRow) : null;
  }

  async putProfile(profile: ProfileRecord): Promise<void> {
    const { error } = await this.db
      .from("clinic_profiles")
      .upsert({ user_id: profile.userId, kind: profile.kind, data: profile.data, updated_at: profile.updatedAt });
    fail(error);
  }

  async listProfiles(kind?: ProfileKind): Promise<ProfileRecord[]> {
    const rows = await this.readAll<ProfileRow>((from, to) => {
      let query = this.db.from("clinic_profiles").select("*");
      if (kind) query = query.eq("kind", kind);
      return query.order("user_id").range(from, to);
    });
    return rows.map(toProfile);
  }

  async listConsultSessions(doctorId?: string): Promise<ConsultSession[]> {
    const rows = await this.readAll<ConsultSessionRow>((from, to) => {
      let query = this.db.from("clinic_consult_sessions").select("*");
      if (doctorId !== undefined) query = query.eq("doctor_id", doctorId);
      return query.order("created_at").order("id").range(from, to);
    });
    return rows.map(toConsultSession);
  }

  async getConsultSession(id: string): Promise<ConsultSession | null> {
    const { data, error } = await this.db.from("clinic_consult_sessions").select("*").eq("id", id).maybeSingle();
    fail(error);
    return data ? toConsultSession(data as ConsultSessionRow) : null;
  }

  async putConsultSession(session: ConsultSession): Promise<void> {
    const { error } = await this.db.from("clinic_consult_sessions").upsert(sessionPayload(session));
    fail(error);
  }

  async createConsultSessionIfAbsent(session: ConsultSession): Promise<"ok" | "exists"> {
    const { error } = await this.db.from("clinic_consult_sessions").insert(sessionPayload(session));
    if (error?.code === UNIQUE_VIOLATION) return "exists";
    fail(error);
    return "ok";
  }

  async rescheduleAppointment(
    id: string,
    fromSlotId: string,
    to: Placement,
    history: RescheduleRecord,
  ): Promise<"ok" | "taken" | "stale"> {
    // One database function moves the visit and writes the history line in a single transaction.
    const { data, error } = await this.db.rpc("clinic_reschedule", {
      p_id: id,
      p_from_slot: fromSlotId,
      p_to: {
        slot_id: to.slotId,
        date: to.date,
        time: to.time,
        end_time: to.endTime,
        session_id: to.sessionId,
        token: to.token,
        wave_capacity: to.waveCapacity,
      },
      p_history: {
        id: history.id,
        reference: history.reference,
        doctor_id: history.doctorId,
        patient_user_id: history.patientUserId,
        by_user_id: history.byUserId,
        by_name: history.byName,
        by_role: history.byRole,
        from_slot_id: history.fromSlotId,
        from_date: history.fromDate,
        from_time: history.fromTime,
        from_token: history.fromToken,
        to_slot_id: history.toSlotId,
        to_date: history.toDate,
        to_time: history.toTime,
        to_token: history.toToken,
        reason: history.reason,
        at: history.at,
      },
    });
    fail(error);
    return data === "ok" ? "ok" : data === "taken" ? "taken" : "stale";
  }

  async listReschedules(
    filter: { appointmentId?: string; doctorId?: string; patientUserId?: string } = {},
  ): Promise<RescheduleRecord[]> {
    const rows = await this.readAll<RescheduleRow>((from, to) => {
      let query = this.db.from("clinic_reschedules").select("*");
      if (filter.appointmentId !== undefined) query = query.eq("appointment_id", filter.appointmentId);
      if (filter.doctorId !== undefined) query = query.eq("doctor_id", filter.doctorId);
      if (filter.patientUserId !== undefined) query = query.eq("patient_user_id", filter.patientUserId);
      return query.order("at").order("id").range(from, to);
    });
    return rows.map(toReschedule);
  }
}
