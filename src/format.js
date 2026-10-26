import { FIRST_WEEK, LAST_WEEK, NOW, slots } from "./data";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function parseDate(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function isoDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function addDays(iso, count) {
  const date = parseDate(iso);
  date.setDate(date.getDate() + count);
  return isoDate(date);
}

export function mondayOf(iso) {
  const date = parseDate(iso);
  const weekday = date.getDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  return addDays(iso, diff);
}

export function weekDays(weekStart) {
  return [0, 1, 2, 3, 4].map((offset) => addDays(weekStart, offset));
}

export function canShiftWeek(weekStart, direction) {
  const next = addDays(weekStart, direction * 7);
  return next >= FIRST_WEEK && next <= LAST_WEEK;
}

export function slotWhen(slot) {
  const [hours, minutes] = slot.time.split(":").map(Number);
  const date = parseDate(slot.date);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

export function addMinutes(time, minutes) {
  const [hours, mins] = time.split(":").map(Number);
  const total = hours * 60 + mins + minutes;
  const nextHours = String(Math.floor(total / 60)).padStart(2, "0");
  const nextMins = String(total % 60).padStart(2, "0");
  return `${nextHours}:${nextMins}`;
}

export function slotStatus(slot, takenIds) {
  if (slotWhen(slot).getTime() <= NOW.getTime()) return "past";
  if (slot.taken || takenIds.includes(slot.id)) return "taken";
  if (slot.unsupervised) return "unsupervised";
  return "open";
}

function byWhen(a, b) {
  return slotWhen(a) - slotWhen(b);
}

export function openingsFor(doctorId, takenIds) {
  return slots
    .filter((slot) => slot.doctorId === doctorId && slotStatus(slot, takenIds) === "open")
    .sort(byWhen);
}

export function nextOpening(doctorId, takenIds) {
  return openingsFor(doctorId, takenIds)[0] ?? null;
}

export function nextOpeningAfter(doctorId, takenIds, iso) {
  return (
    openingsFor(doctorId, takenIds).find((slot) => slot.date > iso) ??
    openingsFor(doctorId, takenIds)[0] ??
    null
  );
}

export function weekdayLong(iso) {
  return WEEKDAYS[parseDate(iso).getDay()];
}

export function weekdayShort(iso) {
  return WEEKDAYS_SHORT[parseDate(iso).getDay()];
}

export function monthLong(iso) {
  return MONTHS[parseDate(iso).getMonth()];
}

export function dayNumber(iso) {
  return String(parseDate(iso).getDate());
}

export function formatFull(iso) {
  const date = parseDate(iso);
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatWeekTitle(weekStart) {
  const start = parseDate(weekStart);
  const end = parseDate(addDays(weekStart, 4));
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${MONTHS[start.getMonth()]} ${start.getFullYear()}`;
  }
  return `${MONTHS_SHORT[start.getMonth()]} – ${MONTHS[end.getMonth()]} ${end.getFullYear()}`;
}

export function formatNext(slot) {
  if (!slot) return "None open";
  const date = parseDate(slot.date);
  if (slot.date >= FIRST_WEEK && slot.date <= "2026-10-30") {
    return `${WEEKDAYS_SHORT[date.getDay()]} ${slot.time}`;
  }
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}, ${slot.time}`;
}

export function formatWhen(slot) {
  const date = parseDate(slot.date);
  return `${WEEKDAYS_SHORT[date.getDay()]} ${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}, ${slot.time}`;
}

export function formatHold(slot, doctor) {
  return `${formatWhen(slot)} · ${doctor.short}`;
}

export function clockLabel() {
  const hours = String(NOW.getHours()).padStart(2, "0");
  const minutes = String(NOW.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function referenceFor(slotId, name) {
  if (slotId === "adeyemi-2026-10-29-1420") return "HSP-4821";
  let hash = 0;
  const source = `${slotId}|${name.trim().toLowerCase()}`;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 33 + source.charCodeAt(index)) % 9000;
  }
  return `HSP-${1000 + hash}`;
}

export function ageOn(dobIso) {
  const dob = parseDate(dobIso);
  let age = NOW.getFullYear() - dob.getFullYear();
  const beforeBirthday =
    NOW.getMonth() < dob.getMonth() ||
    (NOW.getMonth() === dob.getMonth() && NOW.getDate() < dob.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export function ageLabel(dobIso) {
  const age = ageOn(dobIso);
  if (age < 1) return "Under 1 year old";
  if (age === 1) return "1 year old";
  return `${age} years old`;
}

export function formatPhone(input) {
  const digits = input.replace(/\D/g, "");
  let local = digits;
  if (local.startsWith("0044")) local = `0${local.slice(4)}`;
  else if (local.startsWith("44")) local = `0${local.slice(2)}`;
  if (local.length === 11 && local.startsWith("07")) {
    return `${local.slice(0, 5)} ${local.slice(5, 8)} ${local.slice(8)}`;
  }
  return input.trim();
}

export function validatePatient(values) {
  const errors = {};
  if (!values.name.trim()) errors.name = "Enter the name of the person attending.";

  if (!values.dob) {
    errors.dob = "Enter a date of birth.";
  } else {
    const dob = parseDate(values.dob);
    if (Number.isNaN(dob.getTime()) || dob > NOW) {
      errors.dob = "That date is in the future.";
    } else if (dob < new Date(1900, 0, 1)) {
      errors.dob = "Check the year. We need a date after 1900.";
    }
  }

  const mobile = values.mobile.replace(/[\s()-]/g, "");
  if (!values.mobile.trim()) errors.mobile = "Enter a UK mobile number.";
  else if (!/^(?:07\d{9}|\+447\d{9}|00447\d{9})$/.test(mobile)) {
    errors.mobile = "Use a UK mobile, such as 07700 900123.";
  }

  const chi = values.chi.replace(/\s/g, "");
  if (chi) {
    if (!/^\d{10}$/.test(chi)) {
      errors.chi = "A CHI number is 10 digits.";
    } else if (values.dob && !errors.dob) {
      const dob = parseDate(values.dob);
      const day = String(dob.getDate()).padStart(2, "0");
      const month = String(dob.getMonth() + 1).padStart(2, "0");
      const year = String(dob.getFullYear()).slice(2);
      if (!chi.startsWith(`${day}${month}${year}`)) {
        errors.chi = "Those digits don’t match the date of birth.";
      }
    }
  }

  if (!values.reasonId) errors.reasonId = "Choose what the visit is for.";
  if (values.note.length > 200) errors.note = "Keep the note to 200 characters.";

  return errors;
}

function icsEscape(value) {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function icsStamp(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00Z`;
}

function foldLine(line) {
  if (line.length <= 73) return line;
  const parts = [line.slice(0, 73)];
  for (let index = 73; index < line.length; index += 72) {
    parts.push(` ${line.slice(index, index + 72)}`);
  }
  return parts.join("\r\n");
}

export function buildIcs(booking) {
  const start = slotWhen(booking.slot);
  const end = new Date(start.getTime() + booking.reason.minutes * 60000);
  const description = [
    `Reference ${booking.reference}.`,
    `${booking.doctor.room}.`,
    `${booking.reason.label}, ${booking.reason.minutes} minutes.`,
    "Arrive five minutes early.",
  ].join(" ");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Halden Street Practice//Patient booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${booking.reference}@halden.street`,
    `DTSTAMP:${icsStamp(NOW)}`,
    `DTSTART:${icsStamp(start)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:${icsEscape(`Visit with ${booking.doctor.name}`)}`,
    `LOCATION:${icsEscape("14 Halden Street, Edinburgh EH8 9RL")}`,
    `DESCRIPTION:${icsEscape(description)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}

export function downloadIcs(booking) {
  const blob = new Blob([buildIcs(booking)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${booking.reference}.ics`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
