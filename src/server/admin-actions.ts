"use server";

/**
 * Admin console actions. Every action checks the signed-in admin itself: a page guard is not
 * enough, because a server action can be called directly. A problem comes back as a message
 * beside the form (which keeps what was typed); success goes back to the page with `?done=…`.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  AdminError,
  changeRole,
  clearLoginCode,
  createStaff,
  currentAdmin,
  revokeOneSession,
  revokeSessions,
  setAccountDisabled,
} from "@/lib/admin";
import type { ActionResult } from "@/lib/action-result";
import { actorOf } from "@/lib/audit";
import { addMissingFee, BillingError, recordPayment, refundPayment, restoreFee, waiveFee } from "@/lib/billing";
import { isPaymentMethod, isRole, type SessionUser } from "@/lib/clinic-types";
import { parsePounds } from "@/lib/fees";
import { summarise } from "@/lib/payments";
import { safeNext } from "@/lib/session";
import { getStore } from "@/lib/store";
import { changeAppointmentStatus } from "@/lib/visits";

async function requireAdmin(): Promise<SessionUser> {
  const admin = await currentAdmin();
  if (!admin) redirect("/sign-in?as=staff&next=%2Fadmin");
  return admin;
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function failure(error: unknown): ActionResult {
  if (error instanceof AdminError || error instanceof BillingError) return { ok: false, message: error.message };
  console.error(`[admin] Action failed: ${error instanceof Error ? error.message : "unknown error"}`);
  return { ok: false, message: "That didn’t work. Reload the page to see the latest record, then try again." };
}

/** Back to the admin page the form was on, never anywhere else. */
function returnPath(formData: FormData, fallback: string): string {
  const path = safeNext(text(formData, "return"));
  const pathname = path.split(/[?#]/)[0] ?? "";
  return pathname === "/admin" || pathname.startsWith("/admin/") ? path : fallback;
}

function withDone(path: string, done: string): string {
  const [pathname, query = ""] = path.split("#")[0]!.split("?");
  const params = new URLSearchParams(query);
  params.delete("done");
  params.set("done", done);
  return `${pathname}?${params}`;
}

function finish(path: string, done: string): never {
  try {
    revalidatePath("/", "layout");
  } catch {
    // Unit tests run outside the Next.js cache.
  }
  redirect(withDone(path, done));
}

function amountFrom(formData: FormData): number {
  const pence = parsePounds(text(formData, "amount"));
  if (pence === null) throw new BillingError("Enter an amount in pounds, like 40 or 40.00.");
  return pence;
}

/* ---------- People ---------- */

export async function createStaffAction(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const role = text(formData, "role");
  let id: string;
  try {
    if (!isRole(role)) throw new AdminError("Choose a staff role.");
    const account = await createStaff(admin, {
      name: text(formData, "name"),
      email: text(formData, "email"),
      role,
      doctorId: role === "doctor" ? text(formData, "doctorId") || null : null,
    });
    id = account.id;
  } catch (error) {
    return failure(error);
  }
  finish(`/admin/people/${id}`, "staff-created");
}

export async function changeRoleAction(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const userId = text(formData, "userId");
  const role = text(formData, "role");
  try {
    if (!isRole(role)) throw new AdminError("Choose a role.");
    await changeRole(admin, userId, role, role === "doctor" ? text(formData, "doctorId") || null : null, text(formData, "reason"));
  } catch (error) {
    return failure(error);
  }
  finish(returnPath(formData, `/admin/people/${userId}`), "role-changed");
}

export async function setDisabledAction(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const userId = text(formData, "userId");
  const disable = text(formData, "disable") === "1";
  try {
    await setAccountDisabled(admin, userId, disable, text(formData, "reason"));
  } catch (error) {
    return failure(error);
  }
  finish(returnPath(formData, `/admin/people/${userId}`), disable ? "disabled" : "enabled");
}

export async function revokeSessionsAction(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const userId = text(formData, "userId");
  try {
    await revokeSessions(admin, userId);
  } catch (error) {
    return failure(error);
  }
  finish(returnPath(formData, `/admin/people/${userId}`), "sessions-ended");
}

export async function revokeSessionAction(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  try {
    await revokeOneSession(admin, text(formData, "sessionId"));
  } catch (error) {
    return failure(error);
  }
  finish(returnPath(formData, "/admin/security"), "session-ended");
}

export async function clearCodeAction(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  try {
    await clearLoginCode(admin, text(formData, "email"));
  } catch (error) {
    return failure(error);
  }
  finish(returnPath(formData, "/admin/security/attempts"), "code-cleared");
}

/* ---------- Visits ---------- */

export async function visitStatusAction(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const id = text(formData, "id");
  const status = text(formData, "status");
  const reason = text(formData, "reason").trim();
  let done = "completed";
  try {
    if (status !== "completed" && status !== "cancelled") throw new AdminError("Choose what to do with the visit.");
    if (status === "cancelled" && !reason) throw new AdminError("Give a reason for cancelling. It goes in the activity log.");
    if (reason.length > 200) throw new AdminError("Keep the reason to 200 characters.");
    const outcome = await changeAppointmentStatus(admin, id, status, reason);
    if (outcome === "missing") throw new AdminError("That visit is no longer on the book.");
    if (outcome !== "ok") throw new AdminError("That visit was already completed or cancelled.");
    if (status === "cancelled") {
      const money = summarise(await (await getStore()).getCharge(id), "cancelled");
      done = money.refundDuePence > 0 ? "cancelled-refund-due" : "cancelled";
    }
  } catch (error) {
    return failure(error);
  }
  finish(returnPath(formData, `/admin/appointments/${id}`), done);
}

/* ---------- Payments ---------- */

export async function recordPaymentAction(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const id = text(formData, "appointmentId");
  const method = text(formData, "method");
  try {
    if (!isPaymentMethod(method)) throw new BillingError("Choose card or cash.");
    await recordPayment(actorOf(admin), id, method, amountFrom(formData));
  } catch (error) {
    return failure(error);
  }
  finish(returnPath(formData, `/admin/appointments/${id}`), "payment-recorded");
}

export async function refundAction(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const id = text(formData, "appointmentId");
  const method = text(formData, "method");
  try {
    if (!isPaymentMethod(method)) throw new BillingError("Choose how the money goes back.");
    await refundPayment(actorOf(admin), id, method, amountFrom(formData), text(formData, "reason"));
  } catch (error) {
    return failure(error);
  }
  finish(returnPath(formData, `/admin/appointments/${id}`), "refunded");
}

export async function waiveFeeAction(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const id = text(formData, "appointmentId");
  try {
    await waiveFee(actorOf(admin), id, text(formData, "reason"));
  } catch (error) {
    return failure(error);
  }
  finish(returnPath(formData, `/admin/appointments/${id}`), "waived");
}

export async function restoreFeeAction(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const id = text(formData, "appointmentId");
  try {
    await restoreFee(actorOf(admin), id);
  } catch (error) {
    return failure(error);
  }
  finish(returnPath(formData, `/admin/appointments/${id}`), "restored");
}

export async function addFeeAction(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const id = text(formData, "appointmentId");
  try {
    await addMissingFee(actorOf(admin), id);
  } catch (error) {
    return failure(error);
  }
  finish(returnPath(formData, `/admin/appointments/${id}`), "fee-added");
}
