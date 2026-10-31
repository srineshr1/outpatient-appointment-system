import { BlobPreconditionFailedError, del, get, list, put } from "@vercel/blob";
import {
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
  type Placement,
  type ProfileKind,
  type ProfileRecord,
  type RescheduleRecord,
  type SessionRecord,
  type StoredUser,
  type UserAccount,
  type UserPatch,
} from "./clinic-types";
import { hashToken } from "./passwords";

const ACCESS = "private" as const;
/** Parallel reads when a page needs every object under a prefix. */
const READ_CONCURRENCY = 16;
/** Retries when another request changed a record between our read and write. */
const WRITE_RETRIES = 5;

function userEmailPath(email: string): string {
  return `hsp/users/email/${hashToken(email)}.json`;
}

function userIdPath(id: string): string {
  return `hsp/users/id/${id}.json`;
}

function sessionPath(tokenHash: string): string {
  return `hsp/sessions/${tokenHash}.json`;
}

function appointmentPath(id: string): string {
  return `hsp/appointments/${id}.json`;
}

function loginCodePath(email: string): string {
  return `hsp/login-codes/${hashToken(email)}.json`;
}

/** A wave booking's slot id is "<wave>#<token>"; "#" is not safe in a pathname, so it is stored as "~". */
function slotPath(slotId: string): string {
  return `hsp/slots/${slotId.replace(/#/g, "~")}.json`;
}

function profilePath(userId: string): string {
  return `hsp/profiles/${userId}.json`;
}

function consultSessionPath(id: string): string {
  return `hsp/consult-sessions/${id}.json`;
}

function reschedulePath(move: RescheduleRecord): string {
  return `hsp/reschedules/${move.at.replace(/[^0-9]/g, "")}-${move.id}.json`;
}

function chargePath(appointmentId: string): string {
  return `hsp/charges/${appointmentId}.json`;
}

const LATEST = 9_999_999_999_999;

/** Newest first when pathnames are sorted, so the latest events can be read without reading them all. */
function eventPath(event: AuditEvent): string {
  const inverted = String(LATEST - new Date(event.at).getTime()).padStart(13, "0");
  return `hsp/audit/${inverted}-${event.id}.json`;
}

function isMissing(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /not found|404|does not exist|Blob not found/i.test(message);
}

function isConflict(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /already exists|conflict|409/i.test(message);
}

function isStale(error: unknown): boolean {
  if (error instanceof BlobPreconditionFailedError) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /precondition|412/i.test(message);
}

async function readTagged<T>(pathname: string): Promise<{ value: T; etag: string } | null> {
  try {
    const result = await get(pathname, { access: ACCESS, useCache: false });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    const text = await new Response(result.stream).text();
    if (!text) return null;
    return { value: JSON.parse(text) as T, etag: result.blob.etag };
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
}

async function readJson<T>(pathname: string): Promise<T | null> {
  return (await readTagged<T>(pathname))?.value ?? null;
}

async function writeNew(pathname: string, value: unknown): Promise<boolean> {
  try {
    await put(pathname, JSON.stringify(value), {
      access: ACCESS,
      addRandomSuffix: false,
      allowOverwrite: false,
      contentType: "application/json",
      cacheControlMaxAge: 60,
    });
    return true;
  } catch (error) {
    if (isConflict(error)) return false;
    throw error;
  }
}

async function writeOver(pathname: string, value: unknown, ifMatch?: string): Promise<void> {
  await put(pathname, JSON.stringify(value), {
    access: ACCESS,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 60,
    ...(ifMatch ? { ifMatch } : {}),
  });
}

async function remove(pathname: string): Promise<void> {
  try {
    await del(pathname);
  } catch (error) {
    if (!isMissing(error)) throw error;
  }
}

async function listPathnames(prefix: string): Promise<string[]> {
  const pathnames: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, cursor, limit: 1000 });
    for (const blob of page.blobs) pathnames.push(blob.pathname);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return pathnames;
}

async function mapLimit<T, R>(items: readonly T[], limit: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await work(items[index]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function readAll<T>(prefix: string): Promise<{ pathname: string; value: T }[]> {
  const pathnames = await listPathnames(prefix);
  const values = await mapLimit(pathnames, READ_CONCURRENCY, (pathname) => readJson<T>(pathname));
  const rows: { pathname: string; value: T }[] = [];
  for (let index = 0; index < pathnames.length; index += 1) {
    const value = values[index];
    const pathname = pathnames[index];
    if (value != null && pathname) rows.push({ pathname, value });
  }
  return rows;
}

/**
 * Read, change and write one record, retrying if someone else wrote it in between.
 * `change` returns the new value, or null to leave it alone.
 */
async function updateTagged<T>(pathname: string, change: (value: T) => T | null): Promise<{ value: T; changed: boolean } | null> {
  for (let attempt = 0; attempt < WRITE_RETRIES; attempt += 1) {
    const current = await readTagged<T>(pathname);
    if (!current) return null;
    const next = change(current.value);
    if (next === null) return { value: current.value, changed: false };
    try {
      await writeOver(pathname, next, current.etag);
      return { value: next, changed: true };
    } catch (error) {
      if (!isStale(error)) throw error;
    }
  }
  throw new Error("The record kept changing. Try again.");
}

/** Accounts written before these fields existed get defaults. */
function normaliseUser(stored: StoredUser): StoredUser {
  return {
    ...stored,
    createdAt: stored.createdAt ?? "",
    disabledAt: stored.disabledAt ?? null,
    sessionsRevokedAt: stored.sessionsRevokedAt ?? null,
  };
}

function withoutSecret(user: StoredUser): UserAccount {
  const { passwordHash: _secret, ...account } = normaliseUser(user);
  return account;
}

interface StoredSession {
  userId: string;
  expiresAt: string;
  id?: string;
  createdAt?: string;
  device?: string;
}

/** Sessions written before ids existed get a stable one derived from the hash. */
function sessionIdFor(tokenHash: string, stored: StoredSession): string {
  return stored.id ?? `legacy-${hashToken(`session:${tokenHash}`).slice(0, 22)}`;
}

function tokenHashFrom(pathname: string): string {
  return pathname.slice("hsp/sessions/".length).replace(/\.json$/, "");
}

export class BlobClinicStore implements ClinicStore {
  async ensureReady(): Promise<void> {
    // Objects are created on write. Nothing to migrate.
  }

  async getUserByEmail(email: string): Promise<StoredUser | null> {
    const stored = await readJson<StoredUser>(userEmailPath(email));
    return stored ? normaliseUser(stored) : null;
  }

  async getUserById(id: string): Promise<UserAccount | null> {
    const user = await readJson<StoredUser>(userIdPath(id));
    return user ? withoutSecret(user) : null;
  }

  async listUsers(): Promise<UserAccount[]> {
    const rows = await readAll<StoredUser>("hsp/users/id/");
    return rows
      .map((row) => withoutSecret(row.value))
      .sort((a, b) => (a.createdAt === b.createdAt ? a.id.localeCompare(b.id) : a.createdAt.localeCompare(b.createdAt)));
  }

  async createUser(user: NewUser): Promise<"ok" | "exists"> {
    const stored: StoredUser = {
      id: user.id,
      email: user.email,
      passwordHash: user.passwordHash,
      name: user.name,
      role: user.role,
      doctorId: user.doctorId,
      mobile: user.mobile,
      dob: user.dob,
      createdAt: new Date().toISOString(),
      disabledAt: null,
      sessionsRevokedAt: null,
      ...(user.doctorRoom ? { doctorRoom: user.doctorRoom } : {}),
      ...(user.doctorInterest ? { doctorInterest: user.doctorInterest } : {}),
    };
    const created = await writeNew(userEmailPath(user.email), stored);
    if (!created) return "exists";
    await writeOver(userIdPath(user.id), stored);
    return "ok";
  }

  async updateUser(id: string, patch: UserPatch): Promise<UserAccount | null> {
    const defined = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)) as UserPatch;
    const result = await updateTagged<StoredUser>(userIdPath(id), (stored) => ({ ...normaliseUser(stored), ...defined }));
    if (!result) return null;
    // The email copy is what sign-in reads. Keep it the same as the id copy.
    await writeOver(userEmailPath(result.value.email), result.value);
    return withoutSecret(result.value);
  }

  async createSession(tokenHash: string, userId: string, expiresAt: string, device = ""): Promise<void> {
    const stored: StoredSession = {
      userId,
      expiresAt,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      device: device.slice(0, 80),
    };
    await writeOver(sessionPath(tokenHash), stored);
  }

  async getSession(tokenHash: string): Promise<{ id: string; userId: string; expiresAt: string } | null> {
    const stored = await readJson<StoredSession>(sessionPath(tokenHash));
    return stored ? { id: sessionIdFor(tokenHash, stored), userId: stored.userId, expiresAt: stored.expiresAt } : null;
  }

  async deleteSession(tokenHash: string): Promise<void> {
    await remove(sessionPath(tokenHash));
  }

  private async readSessions(): Promise<{ tokenHash: string; record: SessionRecord }[]> {
    const rows = await readAll<StoredSession>("hsp/sessions/");
    return rows.map(({ pathname, value }) => {
      const tokenHash = tokenHashFrom(pathname);
      return {
        tokenHash,
        record: {
          id: sessionIdFor(tokenHash, value),
          userId: value.userId,
          createdAt: value.createdAt ?? "",
          expiresAt: value.expiresAt,
          device: value.device ?? "",
        },
      };
    });
  }

  async listSessions(): Promise<SessionRecord[]> {
    return (await this.readSessions())
      .map((row) => row.record)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async deleteSessionById(id: string): Promise<boolean> {
    const match = (await this.readSessions()).find((row) => row.record.id === id);
    if (!match) return false;
    await remove(sessionPath(match.tokenHash));
    return true;
  }

  async deleteSessionsForUser(userId: string, keepId: string | null = null): Promise<number> {
    const doomed = (await this.readSessions()).filter((row) => row.record.userId === userId && row.record.id !== keepId);
    await mapLimit(doomed, READ_CONCURRENCY, (row) => remove(sessionPath(row.tokenHash)));
    return doomed.length;
  }

  async listBlockedSlotIds(): Promise<string[]> {
    const pathnames = await listPathnames("hsp/slots/");
    return pathnames.map((pathname) => pathname.slice("hsp/slots/".length).replace(/\.json$/, "").replace(/~/g, "#"));
  }

  async createAppointment(appointment: AppointmentRecord): Promise<"ok" | "taken"> {
    const locked = await writeNew(slotPath(appointment.slotId), { appointmentId: appointment.id });
    if (!locked) return "taken";
    try {
      await writeNew(appointmentPath(appointment.id), appointment);
      return "ok";
    } catch (error) {
      await del(slotPath(appointment.slotId)).catch(() => undefined);
      throw error;
    }
  }

  async listAppointments(filter: AppointmentFilter = {}): Promise<AppointmentRecord[]> {
    return (await readAll<AppointmentRecord>("hsp/appointments/")).map((row) => row.value).filter((visit) => matchesFilter(visit, filter));
  }

  async referenceInUse(reference: string): Promise<boolean> {
    return (await this.listAppointments()).some((visit) => visit.reference === reference);
  }

  async getAppointment(id: string): Promise<AppointmentRecord | null> {
    return readJson<AppointmentRecord>(appointmentPath(id));
  }

  async updateStatus(id: string, status: AppointmentStatus): Promise<void> {
    const result = await updateTagged<AppointmentRecord>(appointmentPath(id), (existing) => ({ ...existing, status }));
    if (!result) return;
    if (status === "cancelled") await remove(slotPath(result.value.slotId));
  }

  /** Online payments need the Supabase store; this keeps the interface whole for the legacy blob store. */
  async transitionStatus(id: string, from: AppointmentStatus, to: AppointmentStatus): Promise<"ok" | "stale" | "taken"> {
    const result = await updateTagged<AppointmentRecord>(appointmentPath(id), (existing) => (existing.status === from ? { ...existing, status: to } : null));
    return result?.changed ? "ok" : "stale";
  }

  async putLoginCode(record: LoginCodeRecord): Promise<void> {
    await writeOver(loginCodePath(record.email), record);
  }

  async getLoginCode(email: string): Promise<LoginCodeRecord | null> {
    return readJson<LoginCodeRecord>(loginCodePath(email));
  }

  async deleteLoginCode(email: string): Promise<void> {
    await remove(loginCodePath(email));
  }

  async listLoginCodes(): Promise<LoginCodeRecord[]> {
    return (await readAll<LoginCodeRecord>("hsp/login-codes/"))
      .map((row) => row.value)
      .sort((a, b) => b.sentAt.localeCompare(a.sentAt));
  }

  async createCharge(charge: ChargeRecord): Promise<"ok" | "exists"> {
    return (await writeNew(chargePath(charge.appointmentId), charge)) ? "ok" : "exists";
  }

  async getCharge(appointmentId: string): Promise<ChargeRecord | null> {
    return readJson<ChargeRecord>(chargePath(appointmentId));
  }

  async listCharges(): Promise<ChargeRecord[]> {
    return (await readAll<ChargeRecord>("hsp/charges/")).map((row) => row.value);
  }

  async updateCharge(
    appointmentId: string,
    change: (charge: ChargeRecord) => ChargeRecord | null,
  ): Promise<ChargeRecord | null> {
    const result = await updateTagged<ChargeRecord>(chargePath(appointmentId), (current) => {
      const next = change(current);
      if (!next) return null;
      const kept = new Set(next.entries.map((entry) => entry.id));
      if (current.entries.some((entry) => !kept.has(entry.id))) throw new Error("Payments can’t be removed, only refunded.");
      return next;
    });
    return result?.value ?? null;
  }

  async appendEvent(event: AuditEvent): Promise<void> {
    // A fresh id per event, and writeNew never overwrites: an event can't be replaced.
    await writeNew(eventPath(event), event);
  }

  async listEvents(limit = 1000): Promise<AuditEvent[]> {
    const newest = (await listPathnames("hsp/audit/")).sort().slice(0, Math.max(1, Math.floor(limit)));
    const events = await mapLimit(newest, READ_CONCURRENCY, (pathname) => readJson<AuditEvent>(pathname));
    return events.filter((event): event is AuditEvent => event !== null);
  }

  async getProfile(userId: string): Promise<ProfileRecord | null> {
    return readJson<ProfileRecord>(profilePath(userId));
  }

  async putProfile(profile: ProfileRecord): Promise<void> {
    await writeOver(profilePath(profile.userId), profile);
  }

  async listProfiles(kind?: ProfileKind): Promise<ProfileRecord[]> {
    const rows = (await readAll<ProfileRecord>("hsp/profiles/")).map((row) => row.value);
    return kind ? rows.filter((row) => row.kind === kind) : rows;
  }

  async listConsultSessions(doctorId?: string): Promise<ConsultSession[]> {
    const rows = (await readAll<ConsultSession>("hsp/consult-sessions/")).map((row) => row.value);
    return rows
      .filter((row) => doctorId === undefined || row.doctorId === doctorId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  }

  async getConsultSession(id: string): Promise<ConsultSession | null> {
    return readJson<ConsultSession>(consultSessionPath(id));
  }

  async putConsultSession(session: ConsultSession): Promise<void> {
    await writeOver(consultSessionPath(session.id), session);
  }

  async createConsultSessionIfAbsent(session: ConsultSession): Promise<"ok" | "exists"> {
    return (await writeNew(consultSessionPath(session.id), session)) ? "ok" : "exists";
  }

  async rescheduleAppointment(
    id: string,
    fromSlotId: string,
    to: Placement,
    history: RescheduleRecord,
  ): Promise<"ok" | "taken" | "stale"> {
    const current = await readJson<AppointmentRecord>(appointmentPath(id));
    if (!current || current.status !== "booked" || current.slotId !== fromSlotId) return "stale";
    // Claim the new slot first: the claim file is what stops two people holding it.
    if (!(await writeNew(slotPath(to.slotId), { appointmentId: id }))) return "taken";
    const moved = await updateTagged<AppointmentRecord>(appointmentPath(id), (existing) =>
      existing.status === "booked" && existing.slotId === fromSlotId ? { ...existing, ...to } : null,
    );
    if (!moved?.changed) {
      await remove(slotPath(to.slotId));
      return "stale";
    }
    await remove(slotPath(fromSlotId));
    await writeNew(reschedulePath(history), history);
    return "ok";
  }

  async listReschedules(
    filter: { appointmentId?: string; doctorId?: string; patientUserId?: string } = {},
  ): Promise<RescheduleRecord[]> {
    const rows = (await readAll<RescheduleRecord>("hsp/reschedules/")).map((row) => row.value);
    return rows
      .filter(
        (move) =>
          (filter.appointmentId === undefined || move.appointmentId === filter.appointmentId) &&
          (filter.doctorId === undefined || move.doctorId === filter.doctorId) &&
          (filter.patientUserId === undefined || move.patientUserId === filter.patientUserId),
      )
      .sort((a, b) => a.at.localeCompare(b.at));
  }
}
