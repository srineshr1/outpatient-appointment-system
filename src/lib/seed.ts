import type { ClinicStore, UserAccount } from "./clinic-types";
import { doctors as practiceDoctors } from "./data";
import { DEMO_PASSWORD, demoAccounts } from "./demo-accounts";
import { hashPassword, normaliseEmail } from "./passwords";
import { giveStarterSchedule } from "./doctor-setup";
import { demoSessions } from "./sessions";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function seedDemoUsers(store: ClinicStore): Promise<void> {
  // One read of the accounts answers every check below (demo accounts, admins, the repair), so a
  // cold start makes one round trip to the store rather than one per account.
  const users = await store.listUsers();
  const byEmail = new Map(users.map((user) => [user.email, user]));
  await Promise.all(
    demoAccounts.map(async (account) => {
      const existing = byEmail.get(account.email);
      if (existing) {
        await moveToOwnBook(store, account, existing);
        return;
      }
      await store.createUser({
        id: account.id,
        email: account.email,
        // The sample admin signs in by email code only: no shared demo password for the console.
        passwordHash: account.role === "admin" ? "" : hashPassword(DEMO_PASSWORD),
        name: account.name,
        role: account.role,
        doctorId: account.doctorId,
        mobile: account.mobile,
        dob: account.dob,
      });
    }),
  );
  await Promise.all([bootstrapAdmins(store, byEmail), repairSharedBooks(store, users)]);
  await seedSchedules(store, users);
}

/**
 * Doctor accounts made before profiles and sessions existed (an admin added them, or they are
 * the owner's own doctor account) were already bookable. Give each a profile and one weekday
 * stream session so they stay that way. Accounts made after this date are never touched: a doctor
 * who signed up must finish their own profile and set up their own sessions.
 */
export const LEGACY_DOCTORS_BEFORE = "2026-10-28T14:00:00.000Z";

/** The practice's own doctors start with their weekly stream sessions, and older staff doctors get a default. */
export async function seedSchedules(store: ClinicStore, users: readonly UserAccount[]): Promise<void> {
  const [sessions, profiles] = await Promise.all([store.listConsultSessions(), store.listProfiles("doctor")]);
  const sessionIds = new Set(sessions.map((session) => session.id));
  const hasSessions = new Set(sessions.map((session) => session.doctorId));
  const hasProfile = new Set(profiles.map((profile) => profile.userId));
  const now = new Date().toISOString();
  const work: Promise<unknown>[] = [];
  // Only the sessions of a practice doctor with no rows at all: a doctor who removed one never gets it back.
  for (const session of demoSessions(practiceDoctors, now)) {
    if (!hasSessions.has(session.doctorId) && !sessionIds.has(session.id)) work.push(store.createConsultSessionIfAbsent(session));
  }
  for (const user of users) {
    if (user.role !== "doctor" || user.disabledAt || user.doctorId !== user.id) continue;
    if (user.createdAt && user.createdAt >= LEGACY_DOCTORS_BEFORE) continue;
    if (!hasProfile.has(user.id) || !hasSessions.has(user.id)) work.push(giveStarterSchedule(store, user, now));
  }
  await Promise.all(work);
}

/**
 * Doctor accounts an admin added that ended up opening a practice doctor's book by mistake, from
 * when the add-staff form didn't default to the doctor's own book. Matched by name and the book
 * they were wrongly given, so a deliberate share (a locum) is never touched. Only `doctorId`
 * changes: visits already booked stay on the practice doctor's book. Runs once per account,
 * because after the fix the account no longer matches.
 */
export const SHARED_BOOK_REPAIRS: readonly { name: RegExp; from: string }[] = [{ name: /^dr\.?\s+someone$/i, from: "cho" }];

export async function repairSharedBooks(store: ClinicStore, known?: readonly UserAccount[]): Promise<void> {
  const seeded = new Set(demoAccounts.map((account) => account.id));
  for (const user of known ?? (await store.listUsers())) {
    if (user.role !== "doctor" || seeded.has(user.id) || !user.doctorId || user.doctorId === user.id) continue;
    const repair = SHARED_BOOK_REPAIRS.find((item) => item.from === user.doctorId && item.name.test(user.name.trim()));
    if (!repair) continue;
    await store.updateUser(user.id, { doctorId: user.id });
    await store.appendEvent({
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      action: "role.changed",
      actorId: null,
      actorName: "Clinic setup",
      actorRole: "system",
      subjectType: "user",
      subjectId: user.id,
      summary: `${user.name} · doctor (${repair.from}'s book) → doctor (own book)`,
      reason: "Gave the account its own clinic book. It was linked to another doctor's book by mistake.",
    });
  }
}

/**
 * A seeded doctor whose stored account still points at the book an older seed gave it now gets
 * its own book. Only the `doctorId` link changes: the role, name and visits stay as they are,
 * and visits already booked with the other doctor stay on that doctor's book.
 */
async function moveToOwnBook(
  store: ClinicStore,
  account: (typeof demoAccounts)[number],
  existing: { id: string; role: string; doctorId: string | null },
): Promise<void> {
  if (!account.previousDoctorId || account.doctorId !== account.id) return;
  if (existing.role !== "doctor" || existing.doctorId !== account.previousDoctorId) return;
  await store.updateUser(existing.id, { doctorId: existing.id });
  await store.appendEvent({
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    action: "role.changed",
    actorId: null,
    actorName: "Clinic setup",
    actorRole: "system",
    subjectType: "user",
    subjectId: existing.id,
    summary: `${account.name} · doctor (${account.previousDoctorId}'s book) → doctor (own book)`,
    reason: "Gave the account its own clinic book.",
  });
}

/** Emails in ADMIN_EMAILS (comma-separated). The first admin of a live practice comes from here. */
export function adminEmailsFromEnv(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => normaliseEmail(email))
    .filter((email) => EMAIL.test(email));
}

/**
 * Make sure everyone in ADMIN_EMAILS has an admin account, creating it if needed. Runs while the
 * store opens, so it writes events straight to the store rather than through `recordEvent`.
 */
async function bootstrapAdmins(store: ClinicStore, byEmail: ReadonlyMap<string, UserAccount>): Promise<void> {
  await Promise.all(adminEmailsFromEnv().map((email) => bootstrapAdmin(store, email, byEmail)));
}

async function bootstrapAdmin(store: ClinicStore, email: string, byEmail: ReadonlyMap<string, UserAccount>): Promise<void> {
  {
    // Accounts seeded a moment ago aren't in the list that was read first, so ask for those.
    const listed = byEmail.get(email);
    const existing = listed ?? (demoAccounts.some((account) => account.email === email) ? await store.getUserByEmail(email) : null);
    if (existing?.role === "admin") return;
    let id = existing?.id;
    if (existing) {
      await store.updateUser(existing.id, { role: "admin", doctorId: null });
    } else {
      id = crypto.randomUUID();
      await store.createUser({
        id,
        email,
        passwordHash: "",
        name: email.split("@")[0] ?? "Admin",
        role: "admin",
        doctorId: null,
        mobile: "",
        dob: "",
      });
    }
    await store.appendEvent({
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      action: "admin.bootstrapped",
      actorId: null,
      actorName: "ADMIN_EMAILS setting",
      actorRole: "system",
      subjectType: "user",
      subjectId: id ?? null,
      summary: existing ? `${email} · was ${existing.role}` : `${email} · new account`,
      reason: "",
    });
  }
}
