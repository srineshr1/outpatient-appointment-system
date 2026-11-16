/**
 * The two one-click demo accounts on the sign-in page. They are their own accounts on every
 * store, live practice included: a patient and a doctor with their own clinic book. Neither is
 * a real person, an owner's account or an admin, and neither has a phone number, so nothing is
 * texted. The account is made (or put back) the first time its button is used.
 */
import type { ClinicStore, UserAccount } from "./clinic-types";
import { DEMO_PASSWORD } from "./demo-accounts";
import { giveStarterSchedule } from "./doctor-setup";
import { hashPassword, verifyPassword } from "./passwords";

export type DemoWho = "patient" | "doctor";

export interface DemoLogin {
  id: string;
  email: string;
  name: string;
  role: "patient" | "doctor";
}

export const DEMO_LOGINS: Record<DemoWho, DemoLogin> = {
  patient: { id: "user-patient-demo", email: "ann.lee@halden.example", name: "Ann Lee", role: "patient" },
  doctor: { id: "user-demo-doctor", email: "demo.doctor@halden.example", name: "Dr Demo", role: "doctor" },
};

/**
 * The demo account for a button, ready to sign in to. Only the demo account itself is created
 * or repaired. If someone else already holds the demo email, it is left alone and null comes back.
 */
export async function ensureDemoLogin(store: ClinicStore, who: DemoWho, at = new Date().toISOString()): Promise<UserAccount | null> {
  const demo = DEMO_LOGINS[who];
  const doctorId = demo.role === "doctor" ? demo.id : null;
  let account = await store.getUserByEmail(demo.email);
  if (account && account.id !== demo.id) return null;
  if (!account) {
    await store.createUser({
      id: demo.id,
      email: demo.email,
      passwordHash: hashPassword(DEMO_PASSWORD),
      name: demo.name,
      role: demo.role,
      doctorId,
      mobile: "",
      dob: "",
    });
    account = await store.getUserByEmail(demo.email);
    if (!account || account.id !== demo.id) return null;
  } else if (account.role !== demo.role || account.doctorId !== doctorId || !account.passwordHash || !verifyPassword(DEMO_PASSWORD, account.passwordHash)) {
    const updated = await store.updateUser(account.id, {
      role: demo.role,
      doctorId,
      ...(account.passwordHash && verifyPassword(DEMO_PASSWORD, account.passwordHash) ? {} : { passwordHash: hashPassword(DEMO_PASSWORD) }),
    });
    if (!updated) return null;
    // The demo doctor opens a working book: a profile and one weekday session, made once.
    if (demo.role === "doctor") await giveStarterSchedule(store, updated, at);
    return updated;
  }
  if (demo.role === "doctor") await giveStarterSchedule(store, account, at);
  return account;
}
