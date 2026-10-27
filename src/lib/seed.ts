import type { ClinicStore } from "./clinic-types";
import { DEMO_PASSWORD, demoAccounts } from "./demo-accounts";
import { hashPassword, normaliseEmail } from "./passwords";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function seedDemoUsers(store: ClinicStore): Promise<void> {
  for (const account of demoAccounts) {
    const existing = await store.getUserByEmail(account.email);
    if (existing) continue;
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
  }
  await bootstrapAdmins(store);
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
  for (const email of adminEmailsFromEnv()) {
    const existing = await store.getUserByEmail(email);
    if (existing?.role === "admin") continue;
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
