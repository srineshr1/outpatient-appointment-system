import type { PublicUser, StoredUser } from "./clinic-types";
import { hashPassword, normaliseEmail, verifyPassword } from "./passwords";
import { getStore } from "./store";

const DUMMY_HASH = hashPassword("not-a-real-password");

function toPublic(user: StoredUser): PublicUser {
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

/** Password check, used only by the one-tap sample staff accounts. */
export async function authenticate(email: string, password: string): Promise<{ ok: true; user: PublicUser } | { ok: false }> {
  const store = await getStore();
  const user = await store.getUserByEmail(normaliseEmail(email));
  const matches = verifyPassword(password, user?.passwordHash || DUMMY_HASH);
  if (!user || !matches) return { ok: false };
  return { ok: true, user: toPublic(user) };
}

export async function findUserByEmail(email: string): Promise<PublicUser | null> {
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
export async function createPatient(rawEmail: string, rawName: string): Promise<PublicUser> {
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
