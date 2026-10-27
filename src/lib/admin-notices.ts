/**
 * Messages shown after an admin action succeeds. The URL only carries the key (`?done=…`),
 * so a link can't make the console display text of someone else's choosing.
 */
export const NOTICES: Readonly<Record<string, string>> = {
  "staff-created": "Added. They sign in with a code sent to their email, so there’s no password to share.",
  "role-changed": "Role changed. They’ve been signed out and see their new pages the next time they sign in.",
  disabled: "Account turned off. They’ve been signed out everywhere and can’t sign in.",
  enabled: "Account turned back on. They can sign in again.",
  "sessions-ended": "Signed out everywhere.",
  "session-ended": "Session ended.",
  "code-cleared": "Code cleared. They can ask for a new one straight away.",
  completed: "Visit marked complete.",
  cancelled: "Visit cancelled. The time is free again, and any demo card payment went back automatically.",
  "cancelled-refund-due": "Visit cancelled. Money taken at the desk still has to go back: record the refund under Payment.",
  "payment-recorded": "Payment recorded.",
  refunded: "Refund recorded.",
  waived: "Fee waived. Nothing is owed for this visit.",
  restored: "Waiver removed. The fee is owed again.",
  "fee-added": "Fee added. It’s owed until someone records a payment, or you waive it.",
};

export function noticeText(key: string | null | undefined): string | null {
  return key ? (NOTICES[key] ?? null) : null;
}
