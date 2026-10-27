export type Role = "patient" | "doctor" | "reception";

export type AppointmentStatus = "booked" | "completed" | "cancelled";

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  doctorId: string | null;
  mobile: string;
  dob: string;
}

export interface SessionUser extends PublicUser {
  /** ISO timestamp. */
  expiresAt: string;
}

export interface StoredUser extends PublicUser {
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

export interface ClinicStore {
  ensureReady(): Promise<void>;
  getUserByEmail(email: string): Promise<StoredUser | null>;
  getUserById(id: string): Promise<PublicUser | null>;
  createUser(user: NewUser): Promise<"ok" | "exists">;
  createSession(tokenHash: string, userId: string, expiresAt: string): Promise<void>;
  getSession(tokenHash: string): Promise<{ userId: string; expiresAt: string } | null>;
  deleteSession(tokenHash: string): Promise<void>;
  listBlockedSlotIds(): Promise<string[]>;
  createAppointment(appointment: AppointmentRecord): Promise<"ok" | "taken">;
  listAppointments(): Promise<AppointmentRecord[]>;
  getAppointment(id: string): Promise<AppointmentRecord | null>;
  updateStatus(id: string, status: AppointmentStatus): Promise<void>;
  putLoginCode(record: LoginCodeRecord): Promise<void>;
  getLoginCode(email: string): Promise<LoginCodeRecord | null>;
  deleteLoginCode(email: string): Promise<void>;
}
