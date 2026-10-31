import { practice } from "../data";
import { formatMoney } from "../fees";
import type { NoticeData, NotificationKind, RenderedMessage } from "./types";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? "https://outpatient-appointment-system.vercel.app").replace(/\/+$/, "");
}

interface Layout {
  subject: string;
  heading: string;
  intro: string;
  rows: Array<[string, string]>;
  footnote?: string;
  cta?: { label: string; url: string };
  firstName: string;
}

function layout(input: Layout): RenderedMessage {
  const text = [
    `Hello ${input.firstName},`,
    "",
    input.intro,
    "",
    ...input.rows.map(([label, value]) => `${label}: ${value}`),
    ...(input.footnote ? ["", input.footnote] : []),
    ...(input.cta ? ["", `${input.cta.label}: ${input.cta.url}`] : []),
    "",
    practice.name,
    practice.address,
  ].join("\n");
  const row = ([label, value]: [string, string]) =>
    `<tr><td style="padding:4px 12px 4px 0;color:#6e6e73;">${escapeHtml(label)}</td><td style="padding:4px 0;font-weight:600;">${escapeHtml(value)}</td></tr>`;
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(input.subject)}</title></head>
<body style="margin:0;padding:24px 12px;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1d1d1f;">
<div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px 32px;">
<p style="margin:0 0 4px;font-size:15px;font-weight:600;">${escapeHtml(practice.name)}</p>
<h1 style="margin:16px 0 8px;font-size:20px;line-height:1.3;">${escapeHtml(input.heading)}</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:#424245;">Hello ${escapeHtml(input.firstName)}, ${escapeHtml(input.intro)}</p>
<table role="presentation" style="font-size:15px;">
${input.rows.map(row).join("")}
</table>
${input.footnote ? `<p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:#6e6e73;">${escapeHtml(input.footnote)}</p>` : ""}
${input.cta ? `<p style="margin:20px 0 0;"><a href="${escapeHtml(input.cta.url)}" style="display:inline-block;background:#0071e3;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:10px 18px;border-radius:8px;">${escapeHtml(input.cta.label)}</a></p>` : ""}
</div>
<p style="max-width:480px;margin:12px auto 0;font-size:12px;color:#86868b;">${escapeHtml(practice.name)} · ${escapeHtml(practice.address)}</p>
</body></html>`;
  return { subject: input.subject, text, html };
}

function offsetLabel(minutes: number): string {
  if (minutes >= 1440 && minutes % 1440 === 0) {
    const days = minutes / 1440;
    return days === 1 ? "tomorrow" : `in ${days} days`;
  }
  if (minutes >= 60 && minutes % 60 === 0) return `in ${minutes / 60} hour${minutes === 60 ? "" : "s"}`;
  return `in ${minutes} minutes`;
}

/** Render one notification. Pure: the same data always gives the same email. */
export function renderNotice(kind: NotificationKind, data: NoticeData): RenderedMessage {
  const money = (minor: number | undefined) => (minor === undefined ? "" : formatMoney(minor));
  const visitRows: Array<[string, string]> = [
    ["Reference", data.reference],
    ["Patient", data.patientName],
    ["Doctor", data.doctorName],
    ["When", data.token ? `${data.when} (token ${data.token})` : data.when],
  ];
  const link = (path: string) => `${siteUrl()}${path}`;
  const base = { firstName: data.firstName };

  switch (kind) {
    case "booking_confirmed":
      return layout({
        ...base,
        subject: `Appointment ${data.reference} confirmed`,
        heading: "Your appointment is booked",
        intro: `your appointment with ${data.doctorName} is confirmed.`,
        rows: [...visitRows, ...(data.amountMinor ? [["Paid", money(data.amountMinor)] as [string, string]] : [])],
        footnote: "Please arrive about ten minutes early. You can move or cancel the visit from your appointments.",
        cta: { label: "View appointments", url: link("/appointments") },
      });
    case "payment_confirmed":
      return layout({
        ...base,
        subject: `Payment received for ${data.reference}`,
        heading: "Payment received",
        intro: `we received your payment of ${money(data.amountMinor)} and your appointment is confirmed.`,
        rows: [...visitRows, ["Amount paid", money(data.amountMinor)]],
        footnote: "Keep this email as your receipt, or open it any time from your payment history.",
        cta: { label: "Open receipt", url: link(data.path ?? "/payments") },
      });
    case "payment_failed":
      return layout({
        ...base,
        subject: `Payment for ${data.reference} did not go through`,
        heading: "Payment not completed",
        intro: "your payment did not go through, so nothing has been charged. Your place is held for a short time while you try again.",
        rows: [...visitRows, ...(data.detail ? [["What happened", data.detail] as [string, string]] : [])],
        footnote: "If the hold runs out, the place is released and you can book again.",
        cta: { label: "Try again", url: link(data.path ?? "/appointments") },
      });
    case "hold_expired":
      return layout({
        ...base,
        subject: `Your held place for ${data.reference} was released`,
        heading: "Held place released",
        intro: "we did not receive payment in time, so the place we were holding has been released. Nothing was charged.",
        rows: visitRows,
        footnote: "If you paid and the money left your account, it is refunded automatically. You can book again at any time.",
        cta: { label: "Book again", url: link("/book") },
      });
    case "appointment_cancelled": {
      const rows: Array<[string, string]> = [...visitRows];
      if (data.refundMinor !== undefined) rows.push(["Refund", data.refundMinor > 0 ? `${money(data.refundMinor)} initiated` : "None due"]);
      return layout({
        ...base,
        subject: `Appointment ${data.reference} cancelled`,
        heading: "Appointment cancelled",
        intro: data.cancelledBy === "clinic" ? "your appointment has been cancelled by the practice." : "your appointment has been cancelled.",
        rows,
        footnote:
          data.refundMinor && data.refundMinor > 0
            ? `${data.detail ? `${data.detail} ` : ""}We have started a refund of ${money(data.refundMinor)}. We will email you when the bank confirms it; this usually takes 5 to 7 working days.`
            : (data.detail ?? "You can book another visit at any time."),
        cta: { label: "Book again", url: link("/book") },
      });
    }
    case "refund_initiated":
      return layout({
        ...base,
        subject: `Refund started for ${data.reference}`,
        heading: "Refund initiated",
        intro: `we have started a refund of ${money(data.refundMinor)}.`,
        rows: [...visitRows, ["Refund", `${money(data.refundMinor)} (pending)`]],
        footnote: `${data.detail ? `${data.detail} ` : ""}It is not complete until the bank confirms it. We will email you then; this usually takes 5 to 7 working days.`,
        cta: { label: "See payment history", url: link("/payments") },
      });
    case "refund_completed":
      return layout({
        ...base,
        subject: `Refund of ${money(data.refundMinor)} completed`,
        heading: "Refund completed",
        intro: `your refund of ${money(data.refundMinor)} has been completed. It should appear in your account within a few days.`,
        rows: [...visitRows, ["Refund", `${money(data.refundMinor)} (completed)`]],
        cta: { label: "See payment history", url: link("/payments") },
      });
    case "refund_failed":
      return layout({
        ...base,
        subject: `Refund for ${data.reference} needs attention`,
        heading: "Refund could not be completed",
        intro: "we could not complete your refund. We will try again, and the practice has been told.",
        rows: [...visitRows, ["Refund", `${money(data.refundMinor)} (failed)`], ...(data.detail ? [["What happened", data.detail] as [string, string]] : [])],
        footnote: `If you do not hear from us soon, call the desk on ${practice.phoneDisplay}.`,
      });
    case "reminder":
      return layout({
        ...base,
        subject: `Reminder: appointment ${data.reference} ${offsetLabel(data.offsetMinutes ?? 0)}`,
        heading: "Appointment reminder",
        intro: `this is a reminder of your appointment with ${data.doctorName}, ${data.when}.`,
        rows: visitRows,
        footnote: "If you can no longer come, please cancel or move the visit so someone else can have the time.",
        cta: { label: "Manage appointment", url: link("/appointments") },
      });
  }
}
