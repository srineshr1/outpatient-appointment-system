import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type {
  AppointmentRecord,
  AppointmentStatus,
  ClinicStore,
  LoginCodeRecord,
  NewUser,
  PublicUser,
  Role,
  StoredUser,
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

function isRole(value: string): value is Role {
  return value === "patient" || value === "doctor" || value === "reception";
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
  };
}

function toPublic(user: StoredUser): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    doctorId: user.doctorId,
    mobile: user.mobile,
    dob: user.dob,
  };
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

export class SqliteClinicStore implements ClinicStore {
  private readonly db: DatabaseSync;

  constructor(filename: string) {
    if (filename !== ":memory:") mkdirSync(path.dirname(filename), { recursive: true });
    this.db = new DatabaseSync(filename);
    this.db.exec("PRAGMA foreign_keys = ON");
    this.db.exec("PRAGMA busy_timeout = 5000");
    if (filename !== ":memory:") this.db.exec("PRAGMA journal_mode = WAL");
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
    `);
  }

  async getUserByEmail(email: string): Promise<StoredUser | null> {
    const row = this.db.prepare("SELECT * FROM users WHERE email = ?").get(email) as UserRow | undefined;
    return row ? toUser(row) : null;
  }

  async getUserById(id: string): Promise<PublicUser | null> {
    const row = this.db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
    return row ? toPublic(toUser(row)) : null;
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

  async createSession(tokenHash: string, userId: string, expiresAt: string): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)
         ON CONFLICT(token_hash) DO UPDATE SET user_id = excluded.user_id, expires_at = excluded.expires_at`,
      )
      .run(tokenHash, userId, expiresAt);
  }

  async getSession(tokenHash: string): Promise<{ userId: string; expiresAt: string } | null> {
    const row = this.db
      .prepare("SELECT user_id, expires_at FROM sessions WHERE token_hash = ?")
      .get(tokenHash) as { user_id: string; expires_at: string } | undefined;
    return row ? { userId: row.user_id, expiresAt: row.expires_at } : null;
  }

  async deleteSession(tokenHash: string): Promise<void> {
    this.db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
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
    const row = this.db.prepare("SELECT * FROM login_codes WHERE email = ?").get(email) as
      | {
          email: string;
          code_hash: string;
          expires_at: string;
          sent_at: string;
          attempts: number;
          signup_token_hash: string | null;
        }
      | undefined;
    if (!row) return null;
    return {
      email: row.email,
      codeHash: row.code_hash,
      expiresAt: row.expires_at,
      sentAt: row.sent_at,
      attempts: Number(row.attempts),
      signupTokenHash: row.signup_token_hash,
    };
  }

  async deleteLoginCode(email: string): Promise<void> {
    this.db.prepare("DELETE FROM login_codes WHERE email = ?").run(email);
  }
}
