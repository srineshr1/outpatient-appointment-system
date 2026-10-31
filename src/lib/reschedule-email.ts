/** The email telling someone their visit moved. Plain text plus a simple inline-styled HTML part. */
export interface RescheduleEmailInput {
  /** Who the email is for, e.g. "Ann". */
  recipientName: string;
  /** Who moved it, e.g. "Dr Cho" or "Ann Lee". */
  byName: string;
  reference: string;
  patientName: string;
  doctorName: string;
  from: string;
  to: string;
  /** "Token 3" for a wave booking. */
  token?: string;
  reason?: string;
  practiceName: string;
  address?: string;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}

export function rescheduleEmail(input: RescheduleEmailInput): { subject: string; text: string; html: string } {
  const subject = `Appointment ${input.reference} moved to ${input.to}`;
  const lines = [
    `Hello ${input.recipientName},`,
    "",
    `${input.byName} moved the appointment ${input.reference} for ${input.patientName} with ${input.doctorName}.`,
    "",
    `Was: ${input.from}`,
    `Now: ${input.to}${input.token ? ` (${input.token})` : ""}`,
    ...(input.reason ? ["", `Reason: ${input.reason}`] : []),
    "",
    "The reference stays the same. Sign in to see the visit or move it again.",
    "",
    input.practiceName,
    ...(input.address ? [input.address] : []),
  ];
  const row = (label: string, value: string) =>
    `<tr><td style="padding:4px 12px 4px 0;color:#6e6e73;">${label}</td><td style="padding:4px 0;font-weight:600;">${escapeHtml(value)}</td></tr>`;
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:24px 12px;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1d1d1f;">
<div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px 32px;">
<p style="margin:0 0 4px;font-size:15px;font-weight:600;">${escapeHtml(input.practiceName)}</p>
<h1 style="margin:16px 0 8px;font-size:20px;line-height:1.3;">Appointment moved</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:#424245;">Hello ${escapeHtml(input.recipientName)}, ${escapeHtml(input.byName)} moved the appointment ${escapeHtml(input.reference)} for ${escapeHtml(input.patientName)} with ${escapeHtml(input.doctorName)}.</p>
<table role="presentation" style="font-size:15px;">
${row("Was", input.from)}${row("Now", input.token ? `${input.to} (${input.token})` : input.to)}${input.reason ? row("Reason", input.reason) : ""}
</table>
<p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:#6e6e73;">The reference stays the same. Sign in to see the visit or move it again.</p>
</div>
<p style="max-width:480px;margin:12px auto 0;font-size:12px;color:#86868b;">${escapeHtml(input.practiceName)}${input.address ? ` · ${escapeHtml(input.address)}` : ""}</p>
</body></html>`;
  return { subject, text: lines.join("\n"), html };
}
