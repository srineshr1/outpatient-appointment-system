import type { PublicUser } from "./clinic-types";
import { hashPassword, normaliseEmail, verifyPassword } from "./passwords";
import { getStore } from "./store";
import { validateDob } from "./validate";

const DUMMY_HASH = hashPassword("not-a-real-password");

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  mobile: string;
  dob: string;
  today: string;
}

export async function authenticate(email: string, password: string): Promise<{ ok: true; user: PublicUser } | { ok: false }> {
  const store = await getStore();
  const user = await store.getUserByEmail(normaliseEmail(email));
  const matches = verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !matches) return { ok: false };
  return {
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      doctorId: user.doctorId,
      mobile: user.mobile,
      dob: user.dob,
    },
  };
}

export function registerErrors(input: RegisterInput): Partial<Record<keyof RegisterInput, string>> {
  const errors: Partial<Record<keyof RegisterInput, string>> = {};
  const name = input.name.trim();
  if (!name) errors.name = "Enter your name.";
  else if (name.length > 100) errors.name = "Keep your name to 100 characters.";

  const email = normaliseEmail(input.email);
  if (!email) errors.email = "Enter your email.";
  else if (email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email address.";

  if (input.password.length < 8) errors.password = "Use at least 8 characters.";
  else if (input.password.length > 200) errors.password = "Keep the password to 200 characters.";

  const mobile = input.mobile.replace(/[\s()-]/g, "");
  if (!input.mobile.trim()) errors.mobile = "Enter a UK mobile number.";
  else if (!/^(?:07\d{9}|\+447\d{9}|00447\d{9})$/.test(mobile)) errors.mobile = "Use a UK mobile, such as 07700 900123.";

  const dobError = validateDob(input.dob, input.today);
  if (dobError) errors.dob = dobError;

  return errors;
}

export async function registerPatient(input: RegisterInput): Promise<{ ok: true; user: PublicUser } | { ok: false; error: string }> {
  const errors = registerErrors(input);
  const first = Object.values(errors)[0];
  if (first) return { ok: false, error: first };

  const email = normaliseEmail(input.email);
  const store = await getStore();
  const created = await store.createUser({
    id: crypto.randomUUID(),
    email,
    passwordHash: hashPassword(input.password),
    name: input.name.trim(),
    role: "patient",
    doctorId: null,
    mobile: input.mobile.trim(),
    dob: input.dob,
  });
  if (created === "exists") return { ok: false, error: "An account with that email already exists. Sign in instead." };

  const user = await store.getUserByEmail(email);
  if (!user) return { ok: false, error: "We couldn’t create the account. Please try again." };
  return {
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      doctorId: user.doctorId,
      mobile: user.mobile,
      dob: user.dob,
    },
  };
}
