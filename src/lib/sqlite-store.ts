import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  isPaymentMethod,
  isRole,
  type AppointmentRecord,
  type AppointmentStatus,
  type AuditEvent,
  type ChargeRecord,
  type ClinicStore,
  type LoginCodeRecord,
  type NewUser,
  type PaymentEntry,
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

      CREATE UNIQUE INDEX IF NOT EXISTS appointments_one_held_slot
        ON appointments(slot_id) WHERE status IN ('booked', 'completed');

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
          (id, email, password_hash, name, role, doctor_id, mobile, dob, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      .prepare("SELECT slot_id FROM appointments WHERE status IN ('booked', 'completed')")
      .all() as unknown as { slot_id: string }[];
    return rows.map((row) => row.slot_id);
  }

  async createAppointment(appointment: AppointmentRecord): Promise<"ok" | "taken"> {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const held = this.db
        .prepare("SELECT 1 AS held FROM appointments WHERE slot_id = ? AND status IN ('booked', 'completed')")
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
            status, patient_user_id, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

  async listAppointments(): Promise<AppointmentRecord[]> {
    const rows = this.db.prepare("SELECT * FROM appointments").all() as unknown as AppointmentRow[];
    return rows.map(toAppointment);
  }

  async getAppointment(id: string): Promise<AppointmentRecord | null> {
    const row = this.db.prepare("SELECT * FROM appointments WHERE id = ?").get(id) as AppointmentRow | undefined;
    return row ? toAppointment(row) : null;
  }

  async updateStatus(id: string, status: AppointmentStatus): Promise<void> {
    this.db.prepare("UPDATE appointments SET status = ? WHERE id = ?").run(status, id);
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
}
