/**
 * The password-reset email: a plain-text part and a simple, inline-styled HTML part that reads
 * well in Gmail, Outlook and Apple Mail. Nothing here is user-controlled except the link, which
 * the server builds from its own site address and a random token.
 */
export interface LoginEmail {
  subject: string;
  text: string;
  html: string;
}

export interface ResetEmailInput {
  link: string;
  /** Minutes the link works for. */
  minutes: number;
  practiceName: string;
  practiceShortName: string;
  address?: string;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}

export function resetEmail({ link, minutes, practiceName, practiceShortName, address }: ResetEmailInput): LoginEmail {
  const name = escapeHtml(practiceName);
  const href = escapeHtml(link);
  const expiry = `${minutes} minute${minutes === 1 ? "" : "s"}`;

  const text = [
    `Someone asked to reset the password for your ${practiceShortName} account.`,
    "",
    "Open this link to choose a new password:",
    link,
    "",
    `The link works once and expires in ${expiry}.`,
    "If you didn’t ask for this, you can ignore this email. Your password stays the same.",
    "",
    practiceName,
    ...(address ? [address] : []),
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reset your password</title></head>
<body style="margin:0;padding:0;background:#f4f5f7;">
<span style="display:none;max-height:0;overflow:hidden;">Choose a new password. The link expires in ${expiry}.</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1d1d1f;">
<tr><td style="padding:28px 32px 0;font-size:15px;font-weight:600;">${name}</td></tr>
<tr><td style="padding:20px 32px 0;font-size:22px;font-weight:600;line-height:1.3;">Reset your password</td></tr>
<tr><td style="padding:12px 32px 0;font-size:15px;line-height:1.5;color:#424245;">Someone asked to reset the password for your account. Choose a new one with the button below.</td></tr>
<tr><td style="padding:24px 32px;" align="center">
<a href="${href}" style="display:inline-block;background:#0071e3;color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;padding:14px 28px;border-radius:999px;">Choose a new password</a>
</td></tr>
<tr><td style="padding:0 32px;font-size:15px;line-height:1.5;color:#424245;">The link works once and expires in <strong>${expiry}</strong>.</td></tr>
<tr><td style="padding:16px 32px 28px;font-size:13px;line-height:1.5;color:#6e6e73;">If you didn’t ask for this, you can ignore this email. Your password stays the same.</td></tr>
</table>
<p style="margin:16px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:#86868b;">${name}${address ? ` · ${escapeHtml(address)}` : ""}</p>
</td></tr>
</table>
</body>
</html>`;

  return { subject: `Reset your ${practiceShortName} password`, text, html };
}
