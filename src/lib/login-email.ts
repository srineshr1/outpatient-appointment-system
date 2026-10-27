/**
 * The sign-in code email: a plain-text part and a simple, inline-styled HTML part that reads
 * well in Gmail, Outlook and Apple Mail. Nothing here is user-controlled except the code.
 */
export interface LoginEmail {
  subject: string;
  text: string;
  html: string;
}

export interface LoginEmailInput {
  code: string;
  /** Minutes the code works for. */
  minutes: number;
  practiceName: string;
  practiceShortName: string;
  address?: string;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}

export function loginEmail({ code, minutes, practiceName, practiceShortName, address }: LoginEmailInput): LoginEmail {
  const digits = code.replace(/\D/g, "");
  const name = escapeHtml(practiceName);
  const expiry = `${minutes} minute${minutes === 1 ? "" : "s"}`;

  const text = [
    `Your ${practiceShortName} sign-in code is:`,
    "",
    `    ${digits}`,
    "",
    `It expires in ${expiry}. Enter it on the sign-in page to continue.`,
    "",
    "If you didn’t ask for this code, you can ignore this email. Nobody can sign in without it.",
    "Never share this code. The practice will never ask you for it.",
    "",
    practiceName,
    ...(address ? [address] : []),
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Your sign-in code</title></head>
<body style="margin:0;padding:0;background:#f4f5f7;">
<span style="display:none;max-height:0;overflow:hidden;">Your sign-in code is ${digits}. It expires in ${expiry}.</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1d1d1f;">
<tr><td style="padding:28px 32px 0;font-size:15px;font-weight:600;">${name}</td></tr>
<tr><td style="padding:20px 32px 0;font-size:22px;font-weight:600;line-height:1.3;">Your sign-in code</td></tr>
<tr><td style="padding:12px 32px 0;font-size:15px;line-height:1.5;color:#424245;">Enter this code on the sign-in page to continue.</td></tr>
<tr><td style="padding:20px 32px;">
<div style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:32px;font-weight:700;letter-spacing:8px;text-align:center;background:#f4f5f7;border-radius:8px;padding:16px 8px;">${digits}</div>
</td></tr>
<tr><td style="padding:0 32px;font-size:15px;line-height:1.5;color:#424245;">It expires in <strong>${expiry}</strong>.</td></tr>
<tr><td style="padding:16px 32px 28px;font-size:13px;line-height:1.5;color:#6e6e73;">If you didn’t ask for this code, you can ignore this email. Nobody can sign in without it. Never share it: the practice will never ask you for it.</td></tr>
</table>
<p style="margin:16px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:#86868b;">${name}${address ? ` · ${escapeHtml(address)}` : ""}</p>
</td></tr>
</table>
</body>
</html>`;

  return { subject: `${digits} is your ${practiceShortName} sign-in code`, text, html };
}
