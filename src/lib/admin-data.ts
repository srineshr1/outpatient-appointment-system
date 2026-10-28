/**
 * Everything the admin console reads, loaded once per request and joined in memory.
 * The demo practice is small; a live one would push these filters into the database.
 */
import { actionLabel, inGroup } from "./audit-labels";
import { phoneSearchText } from "./phone";
import type {
  AppointmentRecord,
  AppointmentStatus,
  AuditEvent,
  ChargeRecord,
  LoginCodeRecord,
  SessionRecord,
  UserAccount,
} from "./clinic-types";
import { addDays, isIsoDate, mondayOf, now, todayIso } from "./clock";
import { generateSlots, bookWindow, reasons, findDoctor, allDoctors } from "./data";
import { londonDay, summarise, type ChargeSummary, type PaymentState } from "./payments";
import { getStore } from "./store";
import { sortVisits } from "./visits";

export interface VisitRow {
  visit: AppointmentRecord;
  charge: ChargeRecord | null;
  money: ChargeSummary;
  doctorName: string;
  reasonLabel: string;
  patient: UserAccount | null;
}

export interface AdminSnapshot {
  today: string;
  visits: VisitRow[];
  visitsById: Map<string, VisitRow>;
  charges: ChargeRecord[];
  users: UserAccount[];
  usersById: Map<string, UserAccount>;
  sessions: SessionRecord[];
  loginCodes: LoginCodeRecord[];
  events: AuditEvent[];
}

/** How many events the console reads. Older ones stay in the store. */
export const EVENT_WINDOW = 2000;

export async function loadSnapshot(): Promise<AdminSnapshot> {
  const store = await getStore();
  const [visits, charges, users, sessions, loginCodes, events] = await Promise.all([
    store.listAppointments(),
    store.listCharges(),
    store.listUsers(),
    store.listSessions(),
    store.listLoginCodes(),
    store.listEvents(EVENT_WINDOW),
  ]);
  const chargeByVisit = new Map(charges.map((charge) => [charge.appointmentId, charge]));
  const usersById = new Map(users.map((user) => [user.id, user]));
  const rows = sortVisits(visits).map((visit): VisitRow => {
    const charge = chargeByVisit.get(visit.id) ?? null;
    return {
      visit,
      charge,
      money: summarise(charge, visit.status),
      doctorName: findDoctor(visit.doctorId)?.name ?? "Unknown doctor",
      reasonLabel: reasons.find((reason) => reason.id === visit.reasonId)?.label ?? "Appointment",
      patient: visit.patientUserId ? (usersById.get(visit.patientUserId) ?? null) : null,
    };
  });
  const instant = now().toISOString();
  return {
    today: todayIso(now()),
    visits: rows,
    visitsById: new Map(rows.map((row) => [row.visit.id, row])),
    charges,
    users,
    usersById,
    sessions: sessions.filter((session) => session.expiresAt > instant),
    loginCodes,
    events,
  };
}

/* ---------- Query strings ---------- */

export type SearchParams = Record<string, string | string[] | undefined>;

export function param(query: SearchParams, key: string): string {
  const value = query[key];
  return typeof value === "string" ? value.trim().slice(0, 200) : "";
}

export function dateParam(query: SearchParams, key: string): string {
  const value = param(query, key);
  return isIsoDate(value) ? value : "";
}

/** A query string without empty values, for links that keep the current filters. */
export function queryString(values: Record<string, string | number | null | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== null && value !== undefined && value !== "") params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

/* ---------- Appointments ---------- */

export type WhenFilter = "today" | "upcoming" | "past" | "all";

export interface VisitFilters {
  q: string;
  doctor: string;
  status: AppointmentStatus | "";
  money: PaymentState | "owed" | "";
  when: WhenFilter;
  from: string;
  to: string;
}

const STATUSES: readonly AppointmentStatus[] = ["booked", "completed", "cancelled"];
const MONEY: readonly (PaymentState | "owed")[] = [
  "owed",
  "unpaid",
  "part_paid",
  "paid",
  "part_refunded",
  "refunded",
  "refund_due",
  "waived",
  "void",
  "none",
];

export function readVisitFilters(query: SearchParams, defaultWhen: WhenFilter = "upcoming"): VisitFilters {
  const status = param(query, "status");
  const money = param(query, "money");
  const when = param(query, "when");
  const doctor = param(query, "doctor");
  return {
    q: param(query, "q"),
    doctor: findDoctor(doctor) ? doctor : "",
    status: (STATUSES as readonly string[]).includes(status) ? (status as AppointmentStatus) : "",
    money: (MONEY as readonly string[]).includes(money) ? (money as VisitFilters["money"]) : "",
    when: when === "today" || when === "past" || when === "all" || when === "upcoming" ? when : defaultWhen,
    from: dateParam(query, "from"),
    to: dateParam(query, "to"),
  };
}

function digits(text: string): string {
  return text.replace(/\D/g, "");
}

/** The filters as query values, for links and exports that keep them. */
export function visitQuery(filters: VisitFilters): Record<string, string> {
  return {
    q: filters.q,
    doctor: filters.doctor,
    status: filters.status,
    money: filters.money,
    when: filters.when,
    from: filters.from,
    to: filters.to,
  };
}

/** Name, reference, CHI, mobile or email. */
export function matchesVisit(row: VisitRow, rawQuery: string): boolean {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return true;
  const { visit } = row;
  const text = [visit.patientName, visit.reference, row.patient?.email ?? "", row.doctorName].join(" ").toLowerCase();
  if (text.includes(query)) return true;
  const numbers = digits(query);
  return numbers.length >= 4 && (digits(visit.patientChi).includes(numbers) || phoneSearchText(visit.patientMobile).includes(numbers));
}

export function filterVisits(rows: readonly VisitRow[], filters: VisitFilters, today: string): VisitRow[] {
  return rows.filter((row) => {
    const { visit, money } = row;
    if (filters.doctor && visit.doctorId !== filters.doctor) return false;
    if (filters.status && visit.status !== filters.status) return false;
    if (filters.money === "owed" && money.duePence <= 0) return false;
    if (filters.money && filters.money !== "owed" && money.state !== filters.money) return false;
    if (filters.when === "today" && visit.date !== today) return false;
    if (filters.when === "upcoming" && visit.date < today) return false;
    if (filters.when === "past" && visit.date >= today) return false;
    if (filters.from && visit.date < filters.from) return false;
    if (filters.to && visit.date > filters.to) return false;
    return matchesVisit(row, filters.q);
  });
}

/* ---------- Overview ---------- */

export interface DoctorLoad {
  doctorId: string;
  name: string;
  short: string;
  /** Visits booked through this app this week, not cancelled. */
  online: number;
  /** Times taken, online or by phone. */
  taken: number;
  /** Bookable times this week. Teaching sessions are left out. */
  capacity: number;
}

/**
 * How full each doctor's diary is this week. The slot generator stands in for the practice
 * system, so its "taken" times are visits booked by phone; online bookings are added on top.
 */
export function weekLoad(rows: readonly VisitRow[], today: string): { weekStart: string; doctors: DoctorLoad[] } {
  const window = bookWindow(now());
  const weekStart = mondayOf(today) < window.firstWeek ? window.firstWeek : mondayOf(today);
  const weekEnd = addDays(weekStart, 6);
  const inWeek = rows.filter((row) => row.visit.status !== "cancelled" && row.visit.date >= weekStart && row.visit.date <= weekEnd);
  const held = new Set(inWeek.map((row) => row.visit.slotId));
  const slots = generateSlots(window).filter((slot) => slot.date >= weekStart && slot.date <= weekEnd && !slot.teaching);
  return {
    weekStart,
    doctors: allDoctors().map((doctor) => {
      const own = slots.filter((slot) => slot.doctorId === doctor.id);
      return {
        doctorId: doctor.id,
        name: doctor.name,
        short: doctor.short,
        online: inWeek.filter((row) => row.visit.doctorId === doctor.id).length,
        taken: own.filter((slot) => slot.taken || held.has(slot.id)).length,
        capacity: own.length,
      };
    }),
  };
}

export function createdOn(iso: string, day: string): boolean {
  return Boolean(iso) && londonDay(iso) === day;
}

export function createdBetween(iso: string, from: string, to: string): boolean {
  if (!iso) return false;
  const day = londonDay(iso);
  return day >= from && day <= to;
}

/* ---------- People ---------- */

export interface PersonRow {
  user: UserAccount;
  visits: number;
  upcoming: number;
  lastSeen: string | null;
  owedPence: number;
  sessions: number;
}

export function peopleRows(snapshot: AdminSnapshot): PersonRow[] {
  const lastSignIn = new Map<string, string>();
  for (const event of snapshot.events) {
    if (event.action === "signin.succeeded" && event.actorId && !lastSignIn.has(event.actorId)) lastSignIn.set(event.actorId, event.at);
  }
  return snapshot.users.map((user) => {
    const own = snapshot.visits.filter((row) => row.visit.patientUserId === user.id);
    const sessionTimes = snapshot.sessions.filter((session) => session.userId === user.id).map((session) => session.createdAt);
    const latestSession = sessionTimes.filter(Boolean).sort().at(-1) ?? null;
    const signIn = lastSignIn.get(user.id) ?? null;
    return {
      user,
      visits: own.length,
      upcoming: own.filter((row) => row.visit.status === "booked" && row.visit.date >= snapshot.today).length,
      lastSeen: [signIn, latestSession].filter((value): value is string => Boolean(value)).sort().at(-1) ?? null,
      owedPence: own.reduce((sum, row) => sum + row.money.duePence, 0),
      sessions: sessionTimes.length,
    };
  });
}

export function matchesPerson(row: PersonRow, rawQuery: string): boolean {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return true;
  const numbers = digits(query);
  return (
    row.user.name.toLowerCase().includes(query) ||
    row.user.email.includes(query) ||
    (numbers.length >= 4 && phoneSearchText(row.user.mobile).includes(numbers))
  );
}

/* ---------- Activity ---------- */

/** The numbers beside each section in the sidebar. */
export interface NavCounts {
  /** Visits today, not cancelled. */
  appointments: number;
  /** Visits with money owed to or by the practice. */
  payments: number;
  people: number;
  /** Emails with failed sign-ins in the last day. */
  security: number;
}

export function navCounts(snapshot: AdminSnapshot): NavCounts {
  return {
    appointments: snapshot.visits.filter((row) => row.visit.date === snapshot.today && row.visit.status !== "cancelled").length,
    payments: snapshot.visits.filter((row) => row.money.duePence > 0 || row.money.refundDuePence > 0).length,
    people: snapshot.users.length,
    security: failedSignIns(snapshot.events).length,
  };
}

export interface EventFilters {
  q: string;
  who: string;
  group: string;
  from: string;
  to: string;
  subject: string;
}

export function readEventFilters(query: SearchParams): EventFilters {
  return {
    q: param(query, "q"),
    who: param(query, "who"),
    group: param(query, "group"),
    from: dateParam(query, "from"),
    to: dateParam(query, "to"),
    subject: param(query, "subject"),
  };
}

/** The activity list and its CSV export both use this. */
export function matchesEvent(event: AuditEvent, filters: EventFilters): boolean {
  if (filters.group && !inGroup(event.action, filters.group)) return false;
  if (filters.who && (event.actorId ?? `name:${event.actorName}`) !== filters.who) return false;
  if (filters.subject && event.subjectId !== filters.subject) return false;
  const day = londonDay(event.at);
  if (filters.from && day < filters.from) return false;
  if (filters.to && day > filters.to) return false;
  if (filters.q) {
    const text = `${event.summary} ${event.reason} ${event.actorName} ${event.action} ${actionLabel(event.action)}`.toLowerCase();
    if (!text.includes(filters.q.toLowerCase())) return false;
  }
  return true;
}

/** Sign-in failures in the last `hours`, grouped by email. */
export function failedSignIns(events: readonly AuditEvent[], hours = 24): { email: string; failures: number; locked: boolean; last: string }[] {
  const since = now().getTime() - hours * 3600_000;
  const byEmail = new Map<string, { email: string; failures: number; locked: boolean; last: string }>();
  for (const event of events) {
    if (new Date(event.at).getTime() < since) continue;
    if (event.action !== "signin.code_failed" && event.action !== "signin.locked") continue;
    const email = event.subjectId ?? "unknown";
    const entry = byEmail.get(email) ?? { email, failures: 0, locked: false, last: event.at };
    entry.failures += 1;
    if (event.action === "signin.locked") entry.locked = true;
    if (event.at > entry.last) entry.last = event.at;
    byEmail.set(email, entry);
  }
  return [...byEmail.values()].sort((a, b) => b.failures - a.failures || b.last.localeCompare(a.last));
}
