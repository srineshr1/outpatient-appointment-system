import { del, get, list, put } from "@vercel/blob";
import type {
  AppointmentRecord,
  AppointmentStatus,
  ClinicStore,
  LoginCodeRecord,
  NewUser,
  PublicUser,
  StoredUser,
} from "./clinic-types";
import { hashToken } from "./passwords";

const ACCESS = "private" as const;

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

function slotPath(slotId: string): string {
  return `hsp/slots/${slotId}.json`;
}

function isMissing(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /not found|404|does not exist|Blob not found/i.test(message);
}

function isConflict(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /already exists|conflict|409/i.test(message);
}

async function readJson<T>(pathname: string): Promise<T | null> {
  try {
    const result = await get(pathname, { access: ACCESS, useCache: false });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    const text = await new Response(result.stream).text();
    if (!text) return null;
    return JSON.parse(text) as T;
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
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

async function writeOver(pathname: string, value: unknown): Promise<void> {
  await put(pathname, JSON.stringify(value), {
    access: ACCESS,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 60,
  });
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

function withoutSecret(user: StoredUser): PublicUser {
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

export class BlobClinicStore implements ClinicStore {
  async ensureReady(): Promise<void> {
    // Objects are created on write. Nothing to migrate.
  }

  async getUserByEmail(email: string): Promise<StoredUser | null> {
    return readJson<StoredUser>(userEmailPath(email));
  }

  async getUserById(id: string): Promise<PublicUser | null> {
    const user = await readJson<StoredUser>(userIdPath(id));
    return user ? withoutSecret(user) : null;
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
    };
    const created = await writeNew(userEmailPath(user.email), stored);
    if (!created) return "exists";
    await writeOver(userIdPath(user.id), stored);
    return "ok";
  }

  async createSession(tokenHash: string, userId: string, expiresAt: string): Promise<void> {
    await writeOver(sessionPath(tokenHash), { userId, expiresAt });
  }

  async getSession(tokenHash: string): Promise<{ userId: string; expiresAt: string } | null> {
    return readJson<{ userId: string; expiresAt: string }>(sessionPath(tokenHash));
  }

  async deleteSession(tokenHash: string): Promise<void> {
    try {
      await del(sessionPath(tokenHash));
    } catch (error) {
      if (!isMissing(error)) throw error;
    }
  }

  async listBlockedSlotIds(): Promise<string[]> {
    const pathnames = await listPathnames("hsp/slots/");
    return pathnames.map((pathname) => pathname.slice("hsp/slots/".length).replace(/\.json$/, ""));
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

  async listAppointments(): Promise<AppointmentRecord[]> {
    const pathnames = await listPathnames("hsp/appointments/");
    const rows = await Promise.all(pathnames.map((pathname) => readJson<AppointmentRecord>(pathname)));
    return rows.filter((row): row is AppointmentRecord => row !== null);
  }

  async getAppointment(id: string): Promise<AppointmentRecord | null> {
    return readJson<AppointmentRecord>(appointmentPath(id));
  }

  async updateStatus(id: string, status: AppointmentStatus): Promise<void> {
    const existing = await this.getAppointment(id);
    if (!existing) return;
    await writeOver(appointmentPath(id), { ...existing, status });
    if (status === "cancelled") {
      try {
        await del(slotPath(existing.slotId));
      } catch (error) {
        if (!isMissing(error)) throw error;
      }
    }
  }

  async putLoginCode(record: LoginCodeRecord): Promise<void> {
    await writeOver(loginCodePath(record.email), record);
  }

  async getLoginCode(email: string): Promise<LoginCodeRecord | null> {
    return readJson<LoginCodeRecord>(loginCodePath(email));
  }

  async deleteLoginCode(email: string): Promise<void> {
    try {
      await del(loginCodePath(email));
    } catch (error) {
      if (!isMissing(error)) throw error;
    }
  }
}
