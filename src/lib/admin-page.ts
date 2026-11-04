import { redirect } from "next/navigation";
import { currentAdmin } from "./admin";
import { homeFor } from "./auth-routing";
import type { SessionUser } from "./clinic-types";
import { getCurrentUser } from "./session";

/**
 * Every admin page calls this first. Signed-out visitors go to staff sign-in and come back;
 * other roles go to their own home. Server actions check again on their own.
 */
export async function requireAdminPage(path: string): Promise<SessionUser> {
  const admin = await currentAdmin();
  if (admin) return admin;
  const user = await getCurrentUser();
  if (!user) redirect(signInPathFor(path));
  redirect(homeFor(user.role));
}

/** Staff sign-in that comes back to `path` (an /admin path) afterwards. */
export function signInPathFor(path: string): string {
  const safe = path.startsWith("/admin") ? path : "/admin";
  return `/sign-in?as=staff&next=${encodeURIComponent(safe)}`;
}
