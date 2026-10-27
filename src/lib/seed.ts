import type { ClinicStore } from "./clinic-types";
import { DEMO_PASSWORD, demoAccounts } from "./demo-accounts";
import { hashPassword } from "./passwords";

export async function seedDemoUsers(store: ClinicStore): Promise<void> {
  for (const account of demoAccounts) {
    const existing = await store.getUserByEmail(account.email);
    if (existing) continue;
    await store.createUser({
      id: account.id,
      email: account.email,
      passwordHash: hashPassword(DEMO_PASSWORD),
      name: account.name,
      role: account.role,
      doctorId: account.doctorId,
      mobile: account.mobile,
      dob: account.dob,
    });
  }
}
