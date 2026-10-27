export const SEND_FAILED = "We couldn’t send your sign-in code. Try again in a minute.";

/**
 * Turn a Supabase Auth error into something the person can act on. The full error is logged on the
 * server (code and status only, never the address) so a failing deployment shows why in the logs.
 */
export function sendCodeErrorMessage(error: { code?: string; status?: number; message?: string }): string {
  const code = error.code ?? "";
  // Supabase's message can contain the email address, so only the code and status are logged.
  console.error(`[sign-in] Supabase could not send a code: status=${error.status ?? "?"} code=${code || "unknown"}`);
  if (code === "email_address_invalid") {
    return "We can’t send a code to that address. Check it, or use a different email you can open.";
  }
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit" || error.status === 429) {
    return "Too many sign-in codes have been sent just now. Wait a few minutes, then try again.";
  }
  if (code === "email_address_not_authorized") {
    return "Sign-in by email isn’t available for that address yet. Sign in with Google, or try again later.";
  }
  if (code === "signup_disabled" || code === "otp_disabled" || code === "email_provider_disabled") {
    return "Sign-in by email is turned off on this site. Sign in with Google instead.";
  }
  return SEND_FAILED;
}
