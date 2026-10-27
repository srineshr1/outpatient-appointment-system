import type { Role } from "./clinic-types";

const PATIENT_ONLY = ["/book", "/appointments"];
const STAFF_ONLY = ["/dashboard"];

function under(path: string, prefixes: readonly string[]): boolean {
  const pathname = path.split(/[?#]/)[0] ?? path;
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** Where to go after signing in. A page the role can't use sends them to their own home instead. */
export function destinationFor(role: Role, nextPath: string): string {
  // Patients land on the booking page: the landing page is for people who are not signed in yet.
  const home = role === "patient" ? "/book" : "/dashboard";
  if (nextPath === "/") return home;
  if (role === "patient" && under(nextPath, STAFF_ONLY)) return home;
  if (role !== "patient" && under(nextPath, PATIENT_ONLY)) return home;
  return nextPath;
}
