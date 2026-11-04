import { practice } from "./data";
import { slotStart } from "./schedule";

export interface IcsEvent {
  reference: string;
  doctorName: string;
  room: string;
  date: string;
  time: string;
  minutes: number;
  reasonLabel: string;
}

function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

/** UTC timestamp in iCalendar basic form: 20261029T142000Z. */
export function icsUtc(instant: Date): string {
  return `${instant.toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`;
}

/** Fold to 75 octets per RFC 5545 §3.1 (ASCII-safe approximation by characters). */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts = [line.slice(0, 75)];
  for (let index = 75; index < line.length; index += 74) parts.push(` ${line.slice(index, index + 74)}`);
  return parts.join("\r\n");
}

export function buildIcs(event: IcsEvent, stamp: Date): string {
  const start = slotStart(event);
  const end = new Date(start.getTime() + event.minutes * 60_000);
  const description = [
    `Reference ${event.reference}.`,
    `${event.room}.`,
    `${event.reasonLabel}, ${event.minutes} minutes.`,
    "Arrive five minutes early.",
    `To cancel, call ${practice.phoneDisplay} with two hours’ notice.`,
  ].join(" ");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${practice.name}//Patient booking//EN`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.reference}-${event.date}@haldenstreet.example`,
    `DTSTAMP:${icsUtc(stamp)}`,
    `DTSTART:${icsUtc(start)}`,
    `DTEND:${icsUtc(end)}`,
    `SUMMARY:${escapeText(`GP visit with ${event.doctorName}`)}`,
    `LOCATION:${escapeText(`${practice.name}, ${practice.address}`)}`,
    `DESCRIPTION:${escapeText(description)}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "TRIGGER:-PT1H",
    `DESCRIPTION:${escapeText(`GP visit with ${event.doctorName} in one hour`)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `${lines.map(fold).join("\r\n")}\r\n`;
}

export function downloadIcs(event: IcsEvent, stamp: Date): void {
  const blob = new Blob([buildIcs(event, stamp)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${event.reference}.ics`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
