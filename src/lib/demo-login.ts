/**
 * The one-click demo accounts on the sign-in page. They are their own accounts on every
 * store, live practice included: a patient, a doctor with their own clinic book, and a reception
 * desk. None is a real person, an owner's account or an admin. The demo patient has the details
 * booking needs: a date of birth and Ofcom's fictional UK drama number (07700 900123), which the
 * SMS provider (Indian mobiles only) never texts, and an .example email nothing is delivered to.
 * Each account is made (or put back) the first time its button is used.
 */
import type { ClinicStore, UserAccount } from "./clinic-types";
import { DEMO_PASSWORD } from "./demo-accounts";
import { giveStarterSchedule } from "./doctor-setup";
import { hashPassword, verifyPassword } from "./passwords";

export type DemoWho = "patient" | "doctor" | "reception";

export const DEMO_WHO: readonly DemoWho[] = ["patient", "doctor", "reception"];

export function isDemoWho(value: unknown): value is DemoWho {
  return typeof value === "string" && (DEMO_WHO as readonly string[]).includes(value);
}

export interface DemoLogin {
  id: string;
  email: string;
  name: string;
  role: DemoWho;
  mobile: string;
  dob: string;
}

export const DEMO_LOGINS: Record<DemoWho, DemoLogin> = {
  patient: { id: "user-patient-demo", email: "ann.lee@halden.example", name: "Ann Lee", role: "patient", mobile: "07700 900123", dob: "1980-03-14" },
  doctor: { id: "user-demo-doctor", email: "demo.doctor@halden.example", name: "Dr Demo", role: "doctor", mobile: "", dob: "" },
  // Reception sees every doctor's book on the Desk: check-in, no-shows, and the day's queue.
  reception: { id: "user-demo-reception", email: "demo.reception@halden.example", name: "Demo Reception", role: "reception", mobile: "", dob: "" },
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
      mobile: demo.mobile,
      dob: demo.dob,
    });
    account = await store.getUserByEmail(demo.email);
    if (!account || account.id !== demo.id) return null;
  } else if (
    account.role !== demo.role ||
    account.doctorId !== doctorId ||
    account.mobile !== demo.mobile ||
    account.dob !== demo.dob ||
    !account.passwordHash ||
    !verifyPassword(DEMO_PASSWORD, account.passwordHash)
  ) {
    const updated = await store.updateUser(account.id, {
      role: demo.role,
      doctorId,
      mobile: demo.mobile,
      dob: demo.dob,
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
