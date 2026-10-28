/** Names for activity-log codes. Safe to import anywhere: no store access. */

export const ACTION_LABELS: Readonly<Record<string, string>> = {
  "signin.succeeded": "Signed in",
  "signin.code_failed": "Wrong sign-in code",
  "signin.locked": "Sign-in locked after too many tries",
  "signin.blocked": "Turned-off account tried to sign in",
  "signin.code_cleared": "Pending sign-in code cleared",
  signout: "Signed out",
  "account.created": "Account created",
  "staff.created": "Staff member added",
  "role.changed": "Role changed",
  "account.disabled": "Account turned off",
  "account.enabled": "Account turned back on",
  "sessions.revoked": "Signed out everywhere",
  "session.revoked": "One session ended",
  "appointment.booked": "Visit booked",
  "appointment.cancelled": "Visit cancelled",
  "appointment.completed": "Visit marked complete",
  "appointment.rescheduled": "Visit moved",
  "profile.updated": "Profile updated",
  "consult.created": "Session added",
  "consult.updated": "Session changed",
  "consult.removed": "Session removed",
  "payment.received": "Payment received",
  "payment.refunded": "Refund given",
  "fee.waived": "Fee waived",
  "fee.restored": "Fee waiver removed",
  "fee.added": "Fee added to an older visit",
  "report.exported": "Report exported",
  "admin.bootstrapped": "Made an admin by ADMIN_EMAILS",
};

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

export interface ActionGroup {
  id: string;
  label: string;
  prefixes: readonly string[];
}

export const ACTION_GROUPS: readonly ActionGroup[] = [
  { id: "signin", label: "Sign-in and sessions", prefixes: ["signin.", "signout", "session.", "sessions."] },
  { id: "appointment", label: "Visits", prefixes: ["appointment."] },
  { id: "payment", label: "Payments", prefixes: ["payment.", "fee."] },
  { id: "account", label: "Accounts and roles", prefixes: ["account.", "staff.", "role.", "admin."] },
  { id: "report", label: "Reports", prefixes: ["report."] },
];

export function inGroup(action: string, groupId: string): boolean {
  const group = ACTION_GROUPS.find((item) => item.id === groupId);
  return group ? group.prefixes.some((prefix) => action === prefix || action.startsWith(prefix)) : true;
}

/** Codes that matter for sign-in security. */
export const SECURITY_ACTIONS = new Set(["signin.code_failed", "signin.locked", "signin.blocked"]);

export const ROLE_LABELS: Readonly<Record<string, string>> = {
  patient: "Patient",
  doctor: "Doctor",
  reception: "Reception",
  admin: "Admin",
  system: "Automatic",
  anonymous: "Not signed in",
};
