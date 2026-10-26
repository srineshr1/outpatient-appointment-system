/** Fixed desk clock: Monday 26 October 2026, 13:40. Clocks went back on 25 October, so the practice is on GMT. */
export const NOW = new Date(2026, 9, 26, 13, 40, 0);

export const practice = {
  name: "Halden Street Practice",
  street: "Halden Street",
  address: "14 Halden Street, Edinburgh EH8 9RL",
  phoneDisplay: "0131 496 0280",
  phoneHref: "tel:+441314960280",
  sameDayClose: "16:00",
  hours: "Desk open 08:00–18:00, Monday to Friday.",
};

export const reasons = [
  { id: "new", label: "A new concern", minutes: 15 },
  { id: "follow", label: "A follow-up", minutes: 10 },
  { id: "meds", label: "A medication review", minutes: 15 },
  { id: "bp", label: "A blood-pressure check", minutes: 10 },
];

export const doctors = [
  {
    id: "adeyemi",
    name: "Dr Amara Adeyemi",
    short: "Dr Adeyemi",
    qualification: "MRCGP",
    interest: "General practice",
    years: 16,
    note: "She sees the full list, and supervises Dr MacLeod.",
    room: "Room 2",
  },
  {
    id: "reid",
    name: "Dr Callum Reid",
    short: "Dr Reid",
    qualification: "MRCGP",
    interest: "Diabetes",
    years: 12,
    note: "General practice. Friday mornings are his diabetes clinic.",
    room: "Room 1",
  },
  {
    id: "cho",
    name: "Dr Helen Cho",
    short: "Dr Cho",
    qualification: "MRCGP",
    interest: "Women’s health",
    years: 14,
    note: "General practice, with longer visits for a first women’s health concern.",
    room: "Room 3",
  },
  {
    id: "rahman",
    name: "Dr Yusuf Rahman",
    short: "Dr Rahman",
    qualification: "MRCGP",
    interest: "Joint injections",
    years: 21,
    note: "General practice. Joint injections are on Tuesday afternoons in the treatment room.",
    room: "Room 4",
  },
  {
    id: "macleod",
    name: "Dr Iona MacLeod",
    short: "Dr MacLeod",
    qualification: "MBChB",
    interest: "GP registrar",
    years: 2,
    note: "Registrar, supervised by Dr Adeyemi. Sessions marked Teaching cannot be booked.",
    room: "Room 5",
  },
];

/**
 * Reid’s Friday 09:10 is still on the list, but the desk has already promised it.
 * Confirming that one time fails once and strikes it through.
 */
export const FRAGILE_SLOT_ID = "reid-2026-10-30-0910";

function slot(doctorId, date, time, flags = {}) {
  return {
    id: `${doctorId}-${date}-${time.replace(":", "")}`,
    doctorId,
    date,
    time,
    ...flags,
  };
}

export const slots = [
  slot("adeyemi", "2026-10-26", "09:00"),
  slot("adeyemi", "2026-10-26", "09:20"),
  slot("adeyemi", "2026-10-26", "11:00"),
  slot("adeyemi", "2026-10-26", "15:00", { taken: true }),
  slot("adeyemi", "2026-10-26", "15:40", { taken: true }),
  slot("adeyemi", "2026-10-27", "09:10", { taken: true }),
  slot("adeyemi", "2026-10-27", "10:30", { taken: true }),
  slot("adeyemi", "2026-10-27", "14:00", { taken: true }),
  slot("adeyemi", "2026-10-28", "11:20", { taken: true }),
  slot("adeyemi", "2026-10-28", "15:10", { taken: true }),
  slot("adeyemi", "2026-10-29", "09:40", { taken: true }),
  slot("adeyemi", "2026-10-29", "14:20"),
  slot("adeyemi", "2026-10-29", "16:10"),
  slot("adeyemi", "2026-10-30", "10:00"),
  slot("adeyemi", "2026-10-30", "14:40", { taken: true }),

  slot("reid", "2026-10-26", "14:50", { taken: true }),
  slot("reid", "2026-10-26", "16:20", { taken: true }),
  slot("reid", "2026-10-27", "09:00", { taken: true }),
  slot("reid", "2026-10-27", "11:40", { taken: true }),
  slot("reid", "2026-10-28", "10:20", { taken: true }),
  slot("reid", "2026-10-28", "15:30", { taken: true }),
  slot("reid", "2026-10-29", "09:10", { taken: true }),
  slot("reid", "2026-10-29", "14:00", { taken: true }),
  slot("reid", "2026-10-30", "09:10"),
  slot("reid", "2026-10-30", "11:30"),
  slot("reid", "2026-10-30", "15:00", { taken: true }),

  slot("cho", "2026-10-26", "11:40"),
  slot("cho", "2026-10-26", "15:10"),
  slot("cho", "2026-10-27", "09:40"),
  slot("cho", "2026-10-27", "14:20", { taken: true }),
  slot("cho", "2026-10-28", "10:00"),
  slot("cho", "2026-10-28", "11:30", { taken: true }),
  slot("cho", "2026-10-28", "16:00"),
  slot("cho", "2026-10-29", "09:20", { taken: true }),
  slot("cho", "2026-10-30", "14:10"),

  slot("rahman", "2026-11-03", "16:00"),
  slot("rahman", "2026-11-05", "10:40"),

  slot("macleod", "2026-10-26", "15:50"),
  slot("macleod", "2026-10-27", "09:30", { unsupervised: true }),
  slot("macleod", "2026-10-27", "11:00"),
  slot("macleod", "2026-10-27", "14:40", { unsupervised: true }),
  slot("macleod", "2026-10-28", "10:40"),
  slot("macleod", "2026-10-30", "09:50"),
  slot("macleod", "2026-10-30", "15:20", { unsupervised: true }),
];

export const FIRST_WEEK = "2026-10-26";
export const LAST_WEEK = "2026-11-16";
export const TODAY = "2026-10-26";
