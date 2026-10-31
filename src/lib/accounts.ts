import type { StoredUser, UserAccount } from "./clinic-types";
import { doctorProfileRecord, EMPTY_DOCTOR_PROFILE } from "./profiles";
import { hashPassword, normaliseEmail, verifyPassword } from "./passwords";
import { getStore } from "./store";

const DUMMY_HASH = hashPassword("not-a-real-password");

/** Everything but the password hash, including whether the account is turned off. */
function toPublic(user: StoredUser): UserAccount {
  const { passwordHash: _secret, ...account } = user;
  return account;
}

/** Password check, used only by the one-tap sample staff accounts. */
export async function authenticate(email: string, password: string): Promise<{ ok: true; user: UserAccount } | { ok: false }> {
  const store = await getStore();
  const user = await store.getUserByEmail(normaliseEmail(email));
  const matches = verifyPassword(password, user?.passwordHash || DUMMY_HASH);
  if (!user || !matches) return { ok: false };
  return { ok: true, user: toPublic(user) };
}

export async function findUserByEmail(email: string): Promise<UserAccount | null> {
  const user = await (await getStore()).getUserByEmail(normaliseEmail(email));
  return user ? toPublic(user) : null;
}

export function nameError(raw: string): string | undefined {
  const name = raw.trim();
  if (!name) return "Enter your full name.";
  if (name.length > 100) return "Keep your name to 100 characters.";
  return undefined;
}

/**
 * Create a patient who signs in by email code or Google. There is no password: the stored
 * hash is empty, which never verifies. Mobile and date of birth are asked for at booking.
 */
export async function createPatient(rawEmail: string, rawName: string): Promise<UserAccount> {
  const email = normaliseEmail(rawEmail);
  const store = await getStore();
  const created = await store.createUser({
    id: crypto.randomUUID(),
    email,
    passwordHash: "",
    name: rawName.trim().slice(0, 100),
    role: "patient",
    doctorId: null,
    mobile: "",
    dob: "",
  });
  const user = await store.getUserByEmail(email);
  if (!user) throw new Error(created === "exists" ? "Account vanished." : "Could not create the account.");
  return toPublic(user);
}

/**
 * Create a doctor who signed up themselves. They get their own clinic book and an empty profile,
 * and stay out of the patient directory until they have filled the profile in and set up at least
 * one consulting session. No password: they sign in with an emailed code.
 */
export async function createDoctorSelfSignup(rawEmail: string, rawName: string): Promise<UserAccount> {
  const email = normaliseEmail(rawEmail);
  const store = await getStore();
  const id = crypto.randomUUID();
  const created = await store.createUser({
    id,
    email,
    passwordHash: "",
    name: rawName.trim().slice(0, 100),
    role: "doctor",
    doctorId: id,
    mobile: "",
    dob: "",
  });
  const user = await store.getUserByEmail(email);
  if (!user) throw new Error(created === "exists" ? "Account vanished." : "Could not create the account.");
  await store.putProfile(doctorProfileRecord(user.id, { ...EMPTY_DOCTOR_PROFILE }, new Date().toISOString()));
  return toPublic(user);
}
