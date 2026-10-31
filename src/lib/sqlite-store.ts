import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  isPaymentMethod,
  isRole,
  matchesFilter,
  type AppointmentFilter,
  type AppointmentRecord,
  type AppointmentStatus,
  APPOINTMENT_STATUSES,
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
  type SessionMode,
  type SessionRecord,
  type StoredUser,
  type UserAccount,
  type UserPatch,
} from "./clinic-types";

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
  doctor_room?: string | null;
  doctor_interest?: string | null;
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
  session_id?: string | null;
  token?: number | null;
  wave_capacity?: number | null;
  end_time?: string | null;
}

interface ProfileRow {
  user_id: string;
  kind: string;
  data: string;
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
}

interface EntryRow {
  id: string;
  appointment_id: string;
  kind: string;
  method: string;
  amount_pence: number;
  at: string;
  by_user_id: string | null;
  by_name: string;
  note: string;
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

function isStatus(value: string): value is AppointmentStatus {
  return (APPOINTMENT_STATUSES as readonly string[]).includes(value);
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
  let data: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(row.data);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) data = parsed as Record<string, unknown>;
  } catch {
    // A damaged profile reads as empty, so the person is asked to fill it in again.
  }
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
    mode: (row.mode === "wave" ? "wave" : "stream") satisfies SessionMode,
    slotMinutes: row.slot_minutes,
    waveMinutes: row.wave_minutes,
    waveCapacity: row.wave_capacity,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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

function toCharge(row: ChargeRow, entries: PaymentEntry[]): ChargeRecord {
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

function byEntryTime(a: PaymentEntry, b: PaymentEntry): number {
  return a.at === b.at ? a.id.localeCompare(b.id) : a.at.localeCompare(b.at);
}

export class SqliteClinicStore implements ClinicStore {
  private readonly db: DatabaseSync;

  constructor(filename: string) {
    if (filename !== ":memory:") mkdirSync(path.dirname(filename), { recursive: true });
    this.db = new DatabaseSync(filename);
    this.db.exec("PRAGMA foreign_keys = ON");
    this.db.exec("PRAGMA busy_timeout = 5000");
    if (filename !== ":memory:") this.db.exec("PRAGMA journal_mode = WAL");
  }

  private columns(table: string): Set<string> {
    const rows = this.db.prepare(`PRAGMA table_info(${table})`).all() as unknown as { name: string }[];
    return new Set(rows.map((row) => row.name));
  }

  /** ALTER TABLE has no IF NOT EXISTS for columns, so check first. */
  private addColumn(table: string, column: string, definition: string): void {
    if (!this.columns(table).has(column)) this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }

  async ensureReady(): Promise<void> {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        doctor_id TEXT,
        mobile TEXT NOT NULL DEFAULT '',
        dob TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS appointments (
        id TEXT PRIMARY KEY,
        reference TEXT NOT NULL,
        slot_id TEXT NOT NULL,
        doctor_id TEXT NOT NULL,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        reason_id TEXT NOT NULL,
        patient_name TEXT NOT NULL,
        patient_dob TEXT NOT NULL DEFAULT '',
        patient_mobile TEXT NOT NULL DEFAULT '',
        patient_chi TEXT NOT NULL DEFAULT '',
        note TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL,
        patient_user_id TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS login_codes (
        email TEXT PRIMARY KEY,
        code_hash TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        sent_at TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        signup_token_hash TEXT
      );

      DROP INDEX IF EXISTS appointments_one_held_slot;
      CREATE UNIQUE INDEX IF NOT EXISTS appointments_one_held_slot_v2
        ON appointments(slot_id) WHERE status IN ('booked', 'completed', 'pending_payment');

      CREATE TABLE IF NOT EXISTS charges (
        appointment_id TEXT PRIMARY KEY,
        reference TEXT NOT NULL,
        reason_id TEXT NOT NULL,
        amount_pence INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        waived_at TEXT,
        waived_by_user_id TEXT,
        waived_by_name TEXT NOT NULL DEFAULT '',
        waived_reason TEXT NOT NULL DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS payment_entries (
        id TEXT PRIMARY KEY,
        appointment_id TEXT NOT NULL REFERENCES charges(appointment_id),
        kind TEXT NOT NULL CHECK (kind IN ('payment', 'refund')),
        method TEXT NOT NULL,
        amount_pence INTEGER NOT NULL CHECK (amount_pence > 0),
        at TEXT NOT NULL,
        by_user_id TEXT,
        by_name TEXT NOT NULL DEFAULT '',
        note TEXT NOT NULL DEFAULT ''
      );

      CREATE INDEX IF NOT EXISTS payment_entries_by_visit ON payment_entries(appointment_id);

      CREATE TABLE IF NOT EXISTS audit_events (
        id TEXT PRIMARY KEY,
        at TEXT NOT NULL,
        action TEXT NOT NULL,
        actor_id TEXT,
        actor_name TEXT NOT NULL,
        actor_role TEXT NOT NULL,
        subject_type TEXT,
        subject_id TEXT,
        summary TEXT NOT NULL,
        reason TEXT NOT NULL DEFAULT ''
      );

      CREATE INDEX IF NOT EXISTS audit_events_by_time ON audit_events(at);

      CREATE TABLE IF NOT EXISTS profiles (
        user_id TEXT PRIMARY KEY,
        kind TEXT NOT NULL CHECK (kind IN ('patient', 'doctor')),
        data TEXT NOT NULL DEFAULT '{}',
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS consult_sessions (
        id TEXT PRIMARY KEY,
        doctor_id TEXT NOT NULL,
        label TEXT NOT NULL DEFAULT '',
        weekdays TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        room TEXT NOT NULL DEFAULT '',
        mode TEXT NOT NULL CHECK (mode IN ('stream', 'wave')),
        slot_minutes INTEGER,
        wave_minutes INTEGER,
        wave_capacity INTEGER,
        archived_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        CHECK (start_time < end_time)
      );
      CREATE INDEX IF NOT EXISTS consult_sessions_by_doctor ON consult_sessions(doctor_id);

      CREATE TABLE IF NOT EXISTS reschedules (
        id TEXT PRIMARY KEY,
        appointment_id TEXT NOT NULL,
        reference TEXT NOT NULL,
        doctor_id TEXT NOT NULL,
        patient_user_id TEXT,
        by_user_id TEXT,
        by_name TEXT NOT NULL DEFAULT '',
        by_role TEXT NOT NULL DEFAULT '',
        from_slot_id TEXT NOT NULL,
        from_date TEXT NOT NULL,
        from_time TEXT NOT NULL,
        from_token INTEGER,
        to_slot_id TEXT NOT NULL,
        to_date TEXT NOT NULL,
        to_time TEXT NOT NULL,
        to_token INTEGER,
        reason TEXT NOT NULL DEFAULT '',
        at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS reschedules_by_appointment ON reschedules(appointment_id, at);
      CREATE TRIGGER IF NOT EXISTS reschedules_no_update BEFORE UPDATE ON reschedules
        BEGIN SELECT RAISE(ABORT, 'Reschedule history is append-only.'); END;
      CREATE TRIGGER IF NOT EXISTS reschedules_no_delete BEFORE DELETE ON reschedules
        BEGIN SELECT RAISE(ABORT, 'Reschedule history is append-only.'); END;

      -- The activity log and the money trail are append-only.
      CREATE TRIGGER IF NOT EXISTS audit_events_no_update BEFORE UPDATE ON audit_events
        BEGIN SELECT RAISE(ABORT, 'The activity log is append-only.'); END;
      CREATE TRIGGER IF NOT EXISTS audit_events_no_delete BEFORE DELETE ON audit_events
        BEGIN SELECT RAISE(ABORT, 'The activity log is append-only.'); END;
      CREATE TRIGGER IF NOT EXISTS payment_entries_no_update BEFORE UPDATE ON payment_entries
        BEGIN SELECT RAISE(ABORT, 'Payments are append-only.'); END;
      CREATE TRIGGER IF NOT EXISTS payment_entries_no_delete BEFORE DELETE ON payment_entries
        BEGIN SELECT RAISE(ABORT, 'Payments are append-only.'); END;
    `);

    // Columns added after the first release. Older databases get them here.
    this.addColumn("users", "disabled_at", "TEXT");
    this.addColumn("users", "sessions_revoked_at", "TEXT");
    this.addColumn("users", "doctor_room", "TEXT");
    this.addColumn("users", "doctor_interest", "TEXT");
    this.addColumn("appointments", "session_id", "TEXT");
    this.addColumn("appointments", "token", "INTEGER");
    this.addColumn("appointments", "wave_capacity", "INTEGER");
    this.addColumn("appointments", "end_time", "TEXT");
    this.addColumn("sessions", "id", "TEXT");
    this.addColumn("sessions", "created_at", "TEXT");
    this.addColumn("sessions", "device", "TEXT NOT NULL DEFAULT ''");
    this.db.exec("UPDATE sessions SET id = lower(hex(randomblob(16))) WHERE id IS NULL");
    this.db.exec("CREATE UNIQUE INDEX IF NOT EXISTS sessions_by_id ON sessions(id)");
    this.db.exec("CREATE INDEX IF NOT EXISTS sessions_by_user ON sessions(user_id)");
  }

  async getUserByEmail(email: string): Promise<StoredUser | null> {
    const row = this.db.prepare("SELECT * FROM users WHERE email = ?").get(email) as UserRow | undefined;
    return row ? toUser(row) : null;
  }

  async getUserById(id: string): Promise<UserAccount | null> {
    const row = this.db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
    return row ? withoutSecret(toUser(row)) : null;
  }

  async listUsers(): Promise<UserAccount[]> {
    const rows = this.db.prepare("SELECT * FROM users ORDER BY created_at, id").all() as unknown as UserRow[];
    return rows.map((row) => withoutSecret(toUser(row)));
  }

  async createUser(user: NewUser): Promise<"ok" | "exists"> {
    const result = this.db
      .prepare(
        `INSERT OR IGNORE INTO users
          (id, email, password_hash, name, role, doctor_id, mobile, dob, created_at, doctor_room, doctor_interest)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        user.id,
        user.email,
        user.passwordHash,
        user.name,
        user.role,
        user.doctorId,
        user.mobile,
        user.dob,
        new Date().toISOString(),
        user.doctorRoom || null,
        user.doctorInterest || null,
      );
    return Number(result.changes) === 1 ? "ok" : "exists";
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
    const keys = (Object.keys(patch) as (keyof UserPatch)[]).filter((key) => patch[key] !== undefined);
    if (patch.role !== undefined && !isRole(patch.role)) throw new Error("Unknown role.");
    if (keys.length > 0) {
      const assignments = keys.map((key) => `${columns[key]} = ?`).join(", ");
      const values = keys.map((key) => patch[key] ?? null);
      this.db.prepare(`UPDATE users SET ${assignments} WHERE id = ?`).run(...values, id);
    }
    return this.getUserById(id);
  }

  async createSession(tokenHash: string, userId: string, expiresAt: string, device = ""): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO sessions (token_hash, user_id, expires_at, id, created_at, device) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(token_hash) DO UPDATE SET user_id = excluded.user_id, expires_at = excluded.expires_at`,
      )
      .run(tokenHash, userId, expiresAt, crypto.randomUUID(), new Date().toISOString(), device.slice(0, 80));
  }

  async getSession(tokenHash: string): Promise<{ id: string; userId: string; expiresAt: string } | null> {
    const row = this.db
      .prepare("SELECT id, user_id, expires_at FROM sessions WHERE token_hash = ?")
      .get(tokenHash) as { id: string; user_id: string; expires_at: string } | undefined;
    return row ? { id: row.id, userId: row.user_id, expiresAt: row.expires_at } : null;
  }

  async deleteSession(tokenHash: string): Promise<void> {
    this.db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
  }

  async listSessions(): Promise<SessionRecord[]> {
    const rows = this.db
      .prepare("SELECT id, user_id, created_at, expires_at, device FROM sessions ORDER BY created_at DESC")
      .all() as unknown as SessionRow[];
    return rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      createdAt: row.created_at ?? "",
      expiresAt: row.expires_at,
      device: row.device ?? "",
    }));
  }

  async deleteSessionById(id: string): Promise<boolean> {
    return Number(this.db.prepare("DELETE FROM sessions WHERE id = ?").run(id).changes) > 0;
  }

  async deleteSessionsForUser(userId: string, keepId: string | null = null): Promise<number> {
    const result = keepId
      ? this.db.prepare("DELETE FROM sessions WHERE user_id = ? AND id <> ?").run(userId, keepId)
      : this.db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
    return Number(result.changes);
  }

  async listBlockedSlotIds(): Promise<string[]> {
    const rows = this.db
      .prepare("SELECT slot_id FROM appointments WHERE status IN ('booked', 'completed', 'pending_payment')")
      .all() as unknown as { slot_id: string }[];
    return rows.map((row) => row.slot_id);
  }

  async createAppointment(appointment: AppointmentRecord): Promise<"ok" | "taken"> {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const held = this.db
        .prepare("SELECT 1 AS held FROM appointments WHERE slot_id = ? AND status IN ('booked', 'completed', 'pending_payment')")
        .get(appointment.slotId) as { held: number } | undefined;
      if (held) {
        this.db.exec("ROLLBACK");
        return "taken";
      }
      this.db
        .prepare(
          `INSERT INTO appointments (
            id, reference, slot_id, doctor_id, date, time, reason_id,
            patient_name, patient_dob, patient_mobile, patient_chi, note,
            status, patient_user_id, created_at, session_id, token, wave_capacity, end_time
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          appointment.id,
          appointment.reference,
          appointment.slotId,
          appointment.doctorId,
          appointment.date,
          appointment.time,
          appointment.reasonId,
          appointment.patientName,
          appointment.patientDob,
          appointment.patientMobile,
          appointment.patientChi,
          appointment.note,
          appointment.status,
          appointment.patientUserId,
          appointment.createdAt,
          appointment.sessionId ?? null,
          appointment.token ?? null,
          appointment.waveCapacity ?? null,
          appointment.endTime ?? null,
        );
      this.db.exec("COMMIT");
      return "ok";
    } catch (error) {
      this.db.exec("ROLLBACK");
      const message = error instanceof Error ? error.message : "";
      if (/UNIQUE/i.test(message)) return "taken";
      throw error;
    }
  }

  async listAppointments(filter: AppointmentFilter = {}): Promise<AppointmentRecord[]> {
    const rows = this.db.prepare("SELECT * FROM appointments").all() as unknown as AppointmentRow[];
    return rows.map(toAppointment).filter((visit) => matchesFilter(visit, filter));
  }

  async referenceInUse(reference: string): Promise<boolean> {
    return this.db.prepare("SELECT 1 AS found FROM appointments WHERE reference = ? LIMIT 1").get(reference) !== undefined;
  }

  async getAppointment(id: string): Promise<AppointmentRecord | null> {
    const row = this.db.prepare("SELECT * FROM appointments WHERE id = ?").get(id) as AppointmentRow | undefined;
    return row ? toAppointment(row) : null;
  }

  async updateStatus(id: string, status: AppointmentStatus): Promise<void> {
    this.db.prepare("UPDATE appointments SET status = ? WHERE id = ?").run(status, id);
  }

  async transitionStatus(id: string, from: AppointmentStatus, to: AppointmentStatus): Promise<"ok" | "stale" | "taken"> {
    try {
      const result = this.db.prepare("UPDATE appointments SET status = ? WHERE id = ? AND status = ?").run(to, id, from);
      return Number(result.changes) > 0 ? "ok" : "stale";
    } catch (error) {
      if (error instanceof Error && /UNIQUE constraint/i.test(error.message)) return "taken";
      throw error;
    }
  }

  async putLoginCode(record: LoginCodeRecord): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO login_codes (email, code_hash, expires_at, sent_at, attempts, signup_token_hash)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(email) DO UPDATE SET
           code_hash = excluded.code_hash, expires_at = excluded.expires_at, sent_at = excluded.sent_at,
           attempts = excluded.attempts, signup_token_hash = excluded.signup_token_hash`,
      )
      .run(record.email, record.codeHash, record.expiresAt, record.sentAt, record.attempts, record.signupTokenHash);
  }

  async getLoginCode(email: string): Promise<LoginCodeRecord | null> {
    const row = this.db.prepare("SELECT * FROM login_codes WHERE email = ?").get(email) as LoginCodeRow | undefined;
    return row ? toLoginCode(row) : null;
  }

  async deleteLoginCode(email: string): Promise<void> {
    this.db.prepare("DELETE FROM login_codes WHERE email = ?").run(email);
  }

  async listLoginCodes(): Promise<LoginCodeRecord[]> {
    const rows = this.db.prepare("SELECT * FROM login_codes ORDER BY sent_at DESC").all() as unknown as LoginCodeRow[];
    return rows.map(toLoginCode);
  }

  private entriesFor(appointmentId: string): PaymentEntry[] {
    const rows = this.db
      .prepare("SELECT * FROM payment_entries WHERE appointment_id = ? ORDER BY at, id")
      .all(appointmentId) as unknown as EntryRow[];
    return rows.map(toEntry);
  }

  private insertEntry(appointmentId: string, entry: PaymentEntry): void {
    this.db
      .prepare(
        `INSERT INTO payment_entries (id, appointment_id, kind, method, amount_pence, at, by_user_id, by_name, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        entry.id,
        appointmentId,
        entry.kind,
        entry.method,
        entry.amountPence,
        entry.at,
        entry.byUserId,
        entry.byName,
        entry.note,
      );
  }

  /** Run `work` in one write transaction. It commits unless `work` throws or asks to roll back. */
  private transaction<T>(work: () => { commit: boolean; value: T }): T {
    this.db.exec("BEGIN IMMEDIATE");
    let open = true;
    try {
      const { commit, value } = work();
      open = false;
      this.db.exec(commit ? "COMMIT" : "ROLLBACK");
      return value;
    } catch (error) {
      if (open) this.db.exec("ROLLBACK");
      throw error;
    }
  }

  private readCharge(appointmentId: string): ChargeRecord | null {
    const row = this.db.prepare("SELECT * FROM charges WHERE appointment_id = ?").get(appointmentId) as
      | ChargeRow
      | undefined;
    return row ? toCharge(row, this.entriesFor(appointmentId)) : null;
  }

  async createCharge(charge: ChargeRecord): Promise<"ok" | "exists"> {
    return this.transaction(() => {
      const result = this.db
        .prepare(
          `INSERT OR IGNORE INTO charges (appointment_id, reference, reason_id, amount_pence, created_at,
             waived_at, waived_by_user_id, waived_by_name, waived_reason)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          charge.appointmentId,
          charge.reference,
          charge.reasonId,
          charge.amountPence,
          charge.createdAt,
          charge.waiver?.at ?? null,
          charge.waiver?.byUserId ?? null,
          charge.waiver?.byName ?? "",
          charge.waiver?.reason ?? "",
        );
      if (Number(result.changes) !== 1) return { commit: false, value: "exists" as const };
      for (const entry of charge.entries) this.insertEntry(charge.appointmentId, entry);
      return { commit: true, value: "ok" as const };
    });
  }

  async getCharge(appointmentId: string): Promise<ChargeRecord | null> {
    return this.readCharge(appointmentId);
  }

  async listCharges(): Promise<ChargeRecord[]> {
    const rows = this.db.prepare("SELECT * FROM charges").all() as unknown as ChargeRow[];
    const entries = (this.db.prepare("SELECT * FROM payment_entries ORDER BY at, id").all() as unknown as EntryRow[]).map(
      (row) => [row.appointment_id, toEntry(row)] as const,
    );
    const byVisit = new Map<string, PaymentEntry[]>();
    for (const [appointmentId, entry] of entries) {
      const list = byVisit.get(appointmentId) ?? [];
      list.push(entry);
      byVisit.set(appointmentId, list);
    }
    return rows.map((row) => toCharge(row, byVisit.get(row.appointment_id) ?? []));
  }

  async updateCharge(
    appointmentId: string,
    change: (charge: ChargeRecord) => ChargeRecord | null,
  ): Promise<ChargeRecord | null> {
    return this.transaction(() => {
      const current = this.readCharge(appointmentId);
      if (!current) return { commit: false, value: null };
      const next = change(current);
      if (!next) return { commit: false, value: current };
      const known = new Set(current.entries.map((entry) => entry.id));
      const kept = new Set(next.entries.map((entry) => entry.id));
      if ([...known].some((id) => !kept.has(id))) throw new Error("Payments can’t be removed, only refunded.");
      for (const entry of [...next.entries].sort(byEntryTime)) {
        if (!known.has(entry.id)) this.insertEntry(appointmentId, entry);
      }
      this.db
        .prepare(
          `UPDATE charges SET waived_at = ?, waived_by_user_id = ?, waived_by_name = ?, waived_reason = ?
           WHERE appointment_id = ?`,
        )
        .run(
          next.waiver?.at ?? null,
          next.waiver?.byUserId ?? null,
          next.waiver?.byName ?? "",
          next.waiver?.reason ?? "",
          appointmentId,
        );
      return { commit: true, value: this.readCharge(appointmentId) };
    });
  }

  async appendEvent(event: AuditEvent): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO audit_events (id, at, action, actor_id, actor_name, actor_role, subject_type, subject_id, summary, reason)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        event.id,
        event.at,
        event.action,
        event.actorId,
        event.actorName,
        event.actorRole,
        event.subjectType,
        event.subjectId,
        event.summary,
        event.reason,
      );
  }

  async listEvents(limit = 1000): Promise<AuditEvent[]> {
    const rows = this.db
      .prepare("SELECT * FROM audit_events ORDER BY at DESC, rowid DESC LIMIT ?")
      .all(Math.max(1, Math.floor(limit))) as unknown as EventRow[];
    return rows.map(toEvent);
  }

  async getProfile(userId: string): Promise<ProfileRecord | null> {
    const row = this.db.prepare("SELECT * FROM profiles WHERE user_id = ?").get(userId) as ProfileRow | undefined;
    return row ? toProfile(row) : null;
  }

  async putProfile(profile: ProfileRecord): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO profiles (user_id, kind, data, updated_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET kind = excluded.kind, data = excluded.data, updated_at = excluded.updated_at`,
      )
      .run(profile.userId, profile.kind, JSON.stringify(profile.data), profile.updatedAt);
  }

  async listProfiles(kind?: ProfileKind): Promise<ProfileRecord[]> {
    const rows = (
      kind
        ? this.db.prepare("SELECT * FROM profiles WHERE kind = ?").all(kind)
        : this.db.prepare("SELECT * FROM profiles").all()
    ) as unknown as ProfileRow[];
    return rows.map(toProfile);
  }

  async listConsultSessions(doctorId?: string): Promise<ConsultSession[]> {
    const rows = (
      doctorId
        ? this.db.prepare("SELECT * FROM consult_sessions WHERE doctor_id = ? ORDER BY created_at, id").all(doctorId)
        : this.db.prepare("SELECT * FROM consult_sessions ORDER BY created_at, id").all()
    ) as unknown as ConsultSessionRow[];
    return rows.map(toConsultSession);
  }

  async getConsultSession(id: string): Promise<ConsultSession | null> {
    const row = this.db.prepare("SELECT * FROM consult_sessions WHERE id = ?").get(id) as ConsultSessionRow | undefined;
    return row ? toConsultSession(row) : null;
  }

  private writeConsultSession(session: ConsultSession, replace: boolean): void {
    this.db
      .prepare(
        `INSERT INTO consult_sessions (id, doctor_id, label, weekdays, start_time, end_time, room, mode,
           slot_minutes, wave_minutes, wave_capacity, archived_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ${
           replace
             ? `ON CONFLICT(id) DO UPDATE SET label = excluded.label, weekdays = excluded.weekdays,
                  start_time = excluded.start_time, end_time = excluded.end_time, room = excluded.room, mode = excluded.mode,
                  slot_minutes = excluded.slot_minutes, wave_minutes = excluded.wave_minutes,
                  wave_capacity = excluded.wave_capacity, archived_at = excluded.archived_at, updated_at = excluded.updated_at`
             : ""
         }`,
      )
      .run(
        session.id,
        session.doctorId,
        session.label,
        session.weekdays.join(","),
        session.startTime,
        session.endTime,
        session.room,
        session.mode,
        session.slotMinutes,
        session.waveMinutes,
        session.waveCapacity,
        session.archivedAt,
        session.createdAt,
        session.updatedAt,
      );
  }

  async putConsultSession(session: ConsultSession): Promise<void> {
    this.writeConsultSession(session, true);
  }

  async createConsultSessionIfAbsent(session: ConsultSession): Promise<"ok" | "exists"> {
    if (await this.getConsultSession(session.id)) return "exists";
    try {
      this.writeConsultSession(session, false);
      return "ok";
    } catch (error) {
      if (/UNIQUE|constraint/i.test(error instanceof Error ? error.message : "")) return "exists";
      throw error;
    }
  }

  async rescheduleAppointment(
    id: string,
    fromSlotId: string,
    to: Placement,
    history: RescheduleRecord,
  ): Promise<"ok" | "taken" | "stale"> {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const current = this.db.prepare("SELECT status, slot_id FROM appointments WHERE id = ?").get(id) as
        | { status: string; slot_id: string }
        | undefined;
      if (!current || current.status !== "booked" || current.slot_id !== fromSlotId) {
        this.db.exec("ROLLBACK");
        return "stale";
      }
      const held = this.db
        .prepare("SELECT 1 AS held FROM appointments WHERE slot_id = ? AND status IN ('booked', 'completed', 'pending_payment')")
        .get(to.slotId);
      if (held) {
        this.db.exec("ROLLBACK");
        return "taken";
      }
      this.db
        .prepare(
          `UPDATE appointments SET slot_id = ?, date = ?, time = ?, end_time = ?, session_id = ?, token = ?, wave_capacity = ?
           WHERE id = ?`,
        )
        .run(to.slotId, to.date, to.time, to.endTime, to.sessionId, to.token, to.waveCapacity, id);
      this.db
        .prepare(
          `INSERT INTO reschedules (id, appointment_id, reference, doctor_id, patient_user_id, by_user_id, by_name, by_role,
             from_slot_id, from_date, from_time, from_token, to_slot_id, to_date, to_time, to_token, reason, at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          history.id,
          id,
          history.reference,
          history.doctorId,
          history.patientUserId,
          history.byUserId,
          history.byName,
          history.byRole,
          history.fromSlotId,
          history.fromDate,
          history.fromTime,
          history.fromToken,
          history.toSlotId,
          history.toDate,
          history.toTime,
          history.toToken,
          history.reason,
          history.at,
        );
      this.db.exec("COMMIT");
      return "ok";
    } catch (error) {
      this.db.exec("ROLLBACK");
      if (/UNIQUE/i.test(error instanceof Error ? error.message : "")) return "taken";
      throw error;
    }
  }

  async listReschedules(
    filter: { appointmentId?: string; doctorId?: string; patientUserId?: string } = {},
  ): Promise<RescheduleRecord[]> {
    const rows = this.db.prepare("SELECT * FROM reschedules ORDER BY at, rowid").all() as unknown as RescheduleRow[];
    return rows
      .map(toReschedule)
      .filter(
        (move) =>
          (filter.appointmentId === undefined || move.appointmentId === filter.appointmentId) &&
          (filter.doctorId === undefined || move.doctorId === filter.doctorId) &&
          (filter.patientUserId === undefined || move.patientUserId === filter.patientUserId),
      );
  }
}
