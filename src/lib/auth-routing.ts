import type { Role } from "./clinic-types";

export type AuthField = "name" | "email" | "password" | "mobile" | "dob";

export interface AuthFormState {
  error: string;
  fields: Partial<Record<AuthField, string>>;
  /** What the person typed, sent back so a failed attempt never empties the form. Never includes the password. */
  values: Partial<Record<Exclude<AuthField, "password">, string>>;
  /** Bumped on every failed attempt so the form can replay its shake. */
  attempt: number;
}

export const initialAuthState: AuthFormState = { error: "", fields: {}, values: {}, attempt: 0 };

const PATIENT_ONLY = ["/book", "/appointments"];
const STAFF_ONLY = ["/dashboard"];

function under(path: string, prefixes: readonly string[]): boolean {
  const pathname = path.split(/[?#]/)[0] ?? path;
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** Where to go after signing in. A page the role can't use sends them to their own home instead. */
export function destinationFor(role: Role, nextPath: string): string {
  const home = role === "patient" ? "/appointments" : "/dashboard";
  if (nextPath === "/") return home;
  if (role === "patient" && under(nextPath, STAFF_ONLY)) return home;
  if (role !== "patient" && under(nextPath, PATIENT_ONLY)) return home;
  return nextPath;
}
