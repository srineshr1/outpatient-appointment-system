import type { ClinicStore } from "./clinic-types";
import { DEMO_PASSWORD, demoAccounts } from "./demo-accounts";
import { hashPassword, normaliseEmail } from "./passwords";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function seedDemoUsers(store: ClinicStore): Promise<void> {
  // Each account is independent, so check them together: a cold start reads the store once, not once per account.
  await Promise.all(
    demoAccounts.map(async (account) => {
      const existing = await store.getUserByEmail(account.email);
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
  await Promise.all([bootstrapAdmins(store), repairSharedBooks(store)]);
}

/**
 * Doctor accounts an admin added that ended up opening a practice doctor's book by mistake, from
 * when the add-staff form didn't default to the doctor's own book. Matched by name and the book
 * they were wrongly given, so a deliberate share (a locum) is never touched. Only `doctorId`
 * changes: visits already booked stay on the practice doctor's book. Runs once per account,
 * because after the fix the account no longer matches.
 */
export const SHARED_BOOK_REPAIRS: readonly { name: RegExp; from: string }[] = [{ name: /^dr\.?\s+someone$/i, from: "cho" }];

export async function repairSharedBooks(store: ClinicStore): Promise<void> {
  const seeded = new Set(demoAccounts.map((account) => account.id));
  for (const user of await store.listUsers()) {
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
async function bootstrapAdmins(store: ClinicStore): Promise<void> {
  await Promise.all(adminEmailsFromEnv().map((email) => bootstrapAdmin(store, email)));
}

async function bootstrapAdmin(store: ClinicStore, email: string): Promise<void> {
  {
    const existing = await store.getUserByEmail(email);
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
