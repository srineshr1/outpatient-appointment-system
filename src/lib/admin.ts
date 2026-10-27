/**
 * What an admin can do to accounts, and the rules that keep the practice from locking
 * itself out. Every change is written to the activity log.
 */
import { actorOf, recordEvent } from "./audit";
import { ROLE_LABELS } from "./audit-labels";
import { isRole, type Role, type SessionUser, type UserAccount } from "./clinic-types";
import { now } from "./clock";
import { findDoctor, isPracticeDoctor } from "./data";
import { loadDoctors } from "./doctors";
import { isEmail } from "./login-codes";
import { normaliseEmail } from "./passwords";
import { getCurrentUser } from "./session";
import { getStore } from "./store";

/** A rule stopped the change. The message is safe to show the admin. */
export class AdminError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminError";
  }
}

/**
 * TESTING ONLY. With OPEN_ADMIN=1 the console needs no sign-in: anyone who isn't an admin acts as
 * the sample practice manager. Remove the setting to put the sign-in back.
 */
export function adminOpen(): boolean {
  return process.env.OPEN_ADMIN === "1";
}

const OPEN_ADMIN_ID = "user-admin";

async function openAdmin(): Promise<SessionUser | null> {
  const account = await (await getStore()).getUserById(OPEN_ADMIN_ID);
  if (!account || account.role !== "admin" || account.disabledAt) return null;
  return { ...account, expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), sessionId: null };
}

/** The signed-in admin, or null. Pages redirect on null; actions refuse. */
export async function currentAdmin(): Promise<SessionUser | null> {
  const user = await getCurrentUser();
  if (user?.role === "admin") return user;
  return adminOpen() ? openAdmin() : null;
}

export function isActiveAdmin(account: Pick<UserAccount, "role" | "disabledAt">): boolean {
  return account.role === "admin" && !account.disabledAt;
}

function describe(account: Pick<UserAccount, "role" | "doctorId">): string {
  const doctor = account.doctorId ? findDoctor(account.doctorId) : null;
  return doctor ? `${ROLE_LABELS[account.role]} (${doctor.short})` : (ROLE_LABELS[account.role] ?? account.role);
}

function cleanReason(reason: string, required: boolean): string {
  const clean = reason.replace(/\s+/g, " ").trim();
  if (required && !clean) throw new AdminError("Give a reason. It goes in the activity log.");
  if (clean.length > 200) throw new AdminError("Keep the reason to 200 characters.");
  return clean;
}

async function load(id: string): Promise<UserAccount> {
  const account = await (await getStore()).getUserById(id);
  if (!account) throw new AdminError("That account no longer exists.");
  return account;
}

/** Doctors need a clinic book. Several accounts may open the same one, for example a locum. */
/** Chosen in the clinic book menu: the doctor gets their own book and a listing patients can book. */
export const OWN_BOOK = "own";

function checkDoctorLink(role: Role, doctorId: string | null, accountId: string): string | null {
  if (role !== "doctor") return null;
  if (doctorId === OWN_BOOK || doctorId === accountId) return accountId;
  if (!doctorId || !isPracticeDoctor(doctorId)) throw new AdminError("Choose whose clinic book this doctor opens.");
  return doctorId;
}

/** Another admin must stay able to sign in. */
async function checkNotLastAdmin(target: UserAccount): Promise<void> {
  if (!isActiveAdmin(target)) return;
  const others = (await (await getStore()).listUsers()).filter((user) => user.id !== target.id && isActiveAdmin(user));
  if (others.length === 0) throw new AdminError("This is the only admin who can sign in. Make someone else an admin first.");
}

export interface NewStaff {
  name: string;
  email: string;
  role: Role;
  doctorId: string | null;
}

export async function createStaff(admin: SessionUser, input: NewStaff): Promise<UserAccount> {
  const name = input.name.replace(/\s+/g, " ").trim();
  const email = normaliseEmail(input.email);
  if (!name) throw new AdminError("Enter their full name.");
  if (name.length > 100) throw new AdminError("Keep the name to 100 characters.");
  if (!isEmail(email)) throw new AdminError("Enter a valid email address, like name@example.com.");
  if (!isRole(input.role) || input.role === "patient") throw new AdminError("Choose a staff role.");
  const id = crypto.randomUUID();
  const doctorId = checkDoctorLink(input.role, input.doctorId, id);

  const store = await getStore();
  if (await store.getUserByEmail(email)) throw new AdminError("That email already has an account. Change its role from People instead.");
  // No password: staff sign in with a code sent to this email (or Google, when that's on).
  const created = await store.createUser({ id, email, passwordHash: "", name, role: input.role, doctorId, mobile: "", dob: "" });
  if (created === "exists") throw new AdminError("That email already has an account.");
  await loadDoctors(true);
  const account = await load(id);
  await recordEvent({
    actor: actorOf(admin),
    action: "staff.created",
    subjectType: "user",
    subjectId: id,
    summary: `${name} · ${email} · ${describe(account)}`,
  });
  return account;
}

export async function changeRole(
  admin: SessionUser,
  userId: string,
  role: Role,
  doctorId: string | null,
  reason: string,
): Promise<UserAccount> {
  if (!isRole(role)) throw new AdminError("Choose a role.");
  const why = cleanReason(reason, true);
  const target = await load(userId);
  if (target.id === admin.id && role !== "admin") throw new AdminError("You can’t remove your own admin role. Ask another admin.");
  const nextDoctor = checkDoctorLink(role, doctorId, target.id);
  if (target.role === role && target.doctorId === nextDoctor) throw new AdminError("That’s already their role.");
  if (role !== "admin") await checkNotLastAdmin(target);

  const store = await getStore();
  const updated = await store.updateUser(target.id, { role, doctorId: nextDoctor });
  if (!updated) throw new AdminError("That account no longer exists.");
  await loadDoctors(true);
  // Their pages change with the role, so make them sign in again.
  const ended = await store.deleteSessionsForUser(target.id);
  await store.updateUser(target.id, { sessionsRevokedAt: now().toISOString() });
  await recordEvent({
    actor: actorOf(admin),
    action: "role.changed",
    subjectType: "user",
    subjectId: target.id,
    summary: `${target.name} · ${describe(target)} → ${describe(updated)}${ended ? ` · ${ended} signed-in ${ended === 1 ? "session" : "sessions"} ended` : ""}`,
    reason: why,
  });
  return updated;
}

export async function setAccountDisabled(
  admin: SessionUser,
  userId: string,
  disabled: boolean,
  reason: string,
): Promise<UserAccount> {
  const why = cleanReason(reason, disabled);
  const target = await load(userId);
  if (target.id === admin.id && disabled) throw new AdminError("You can’t turn off your own account.");
  if (disabled === Boolean(target.disabledAt)) throw new AdminError(disabled ? "That account is already off." : "That account is already on.");
  if (disabled) await checkNotLastAdmin(target);

  const store = await getStore();
  const at = now().toISOString();
  const updated = await store.updateUser(
    target.id,
    disabled ? { disabledAt: at, sessionsRevokedAt: at } : { disabledAt: null },
  );
  if (!updated) throw new AdminError("That account no longer exists.");
  const ended = disabled ? await store.deleteSessionsForUser(target.id) : 0;
  await recordEvent({
    actor: actorOf(admin),
    action: disabled ? "account.disabled" : "account.enabled",
    subjectType: "user",
    subjectId: target.id,
    summary: `${target.name} · ${target.email}${ended ? ` · ${ended} signed-in ${ended === 1 ? "session" : "sessions"} ended` : ""}`,
    reason: why,
  });
  return updated;
}

/** Sign someone out on every device. For yourself, the session you're using is kept. */
export async function revokeSessions(admin: SessionUser, userId: string): Promise<number> {
  const target = await load(userId);
  const store = await getStore();
  const self = target.id === admin.id;
  const ended = await store.deleteSessionsForUser(target.id, self ? admin.sessionId : null);
  // Supabase sessions can't be listed from here; this stamp makes the app refuse older ones.
  if (!self) await store.updateUser(target.id, { sessionsRevokedAt: now().toISOString() });
  await recordEvent({
    actor: actorOf(admin),
    action: "sessions.revoked",
    subjectType: "user",
    subjectId: target.id,
    summary: `${target.name} · ${ended} ${ended === 1 ? "session" : "sessions"} ended${self ? " (kept this one)" : ""}`,
  });
  return ended;
}

export async function revokeOneSession(admin: SessionUser, sessionId: string): Promise<void> {
  if (sessionId === admin.sessionId) throw new AdminError("That’s the session you’re using. Sign out instead.");
  const store = await getStore();
  const session = (await store.listSessions()).find((item) => item.id === sessionId);
  if (!session) throw new AdminError("That session has already ended.");
  const owner = await store.getUserById(session.userId);
  await store.deleteSessionById(sessionId);
  await recordEvent({
    actor: actorOf(admin),
    action: "session.revoked",
    subjectType: "session",
    subjectId: session.userId,
    summary: `${owner?.name ?? "Unknown account"}${session.device ? ` · ${session.device}` : ""}`,
  });
}

/** Clear a pending code, for example after a lockout, so the person can ask for a fresh one straight away. */
export async function clearLoginCode(admin: SessionUser, rawEmail: string): Promise<void> {
  const email = normaliseEmail(rawEmail);
  const store = await getStore();
  if (!(await store.getLoginCode(email))) throw new AdminError("There’s no pending code for that email.");
  await store.deleteLoginCode(email);
  await recordEvent({ actor: actorOf(admin), action: "signin.code_cleared", subjectType: "email", subjectId: email, summary: email });
}
