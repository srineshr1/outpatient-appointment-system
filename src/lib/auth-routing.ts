import type { Role } from "./clinic-types";

const PATIENT_ONLY = ["/book", "/appointments"];
const STAFF_ONLY = ["/dashboard"];
const ADMIN_ONLY = ["/admin"];

function under(path: string, prefixes: readonly string[]): boolean {
  const pathname = path.split(/[?#]/)[0] ?? path;
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** Each role's own starting page. */
export function homeFor(role: Role): string {
  // Patients land on the booking page: the landing page is for people who are not signed in yet.
  if (role === "patient") return "/book";
  if (role === "admin") return "/admin";
  return "/dashboard";
}

/** Where to go after signing in. A page the role can't use sends them to their own home instead. */
export function destinationFor(role: Role, nextPath: string): string {
  const home = homeFor(role);
  if (nextPath === "/") return home;
  if (role === "patient" && under(nextPath, STAFF_ONLY)) return home;
  if (role !== "patient" && under(nextPath, PATIENT_ONLY)) return home;
  if (role !== "admin" && under(nextPath, ADMIN_ONLY)) return home;
  return nextPath;
}
