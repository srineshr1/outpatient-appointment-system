/**
 * Read-only answers for the assistant. Every list is already limited to the signed-in
 * account. Phone numbers, dates of birth, CHI numbers and booking notes are left out
 * before anything is handed to the model.
 */
import type { AppointmentRecord, AppointmentStatus, ConsultSession, PublicUser } from "../clinic-types";
import { addDays, todayIso, now } from "../clock";
import { allDoctors, findDoctor, isListed, reasons, type Slot } from "../data";
import { formatMoney } from "../fees";
import { paymentHistory, refundStatusLabel } from "../payments/summary";
import { paymentLine, summarise } from "../payments";
import { getSlots } from "../repository";
import { nextOpening, openSlots, slotStart } from "../schedule";
import { daysLabel, fromMinutes, isIsoDate, overriddenDates, sessionShownOn, toMinutes } from "../sessions";
import { getStore } from "../store";
import { visitsFor } from "../visits";

const LIST_CAP = 30;

export function doctorOnly(user: PublicUser): { ok: true; doctorId: string } | { ok: false; error: string } {
  if (user.role !== "doctor") return { ok: false, error: "Only a doctor can look at the clinic book." };
  if (!user.doctorId) return { ok: false, error: "This doctor account is not linked to a clinic book." };
  return { ok: true, doctorId: user.doctorId };
}

export function patientOnly(user: PublicUser): { ok: true } | { ok: false; error: string } {
  if (user.role !== "patient") return { ok: false, error: "Only a patient can do that." };
  return { ok: true };
}

export function resolveDay(value: string | undefined, fallback = todayIso(now())): string | { error: string } {
  const text = value?.trim() ?? "";
  const lower = text.toLowerCase();
  if (!lower || lower === "today") return fallback;
  if (lower === "tomorrow") return addDays(fallback, 1);
  if (!isIsoDate(text)) return { error: "Use a date as YYYY-MM-DD." };
  return text;
}

export function reasonLabel(id: string): string {
  return reasons.find((reason) => reason.id === id)?.label ?? id;
}

/** What the model is allowed to see about a visit. */
export function publicVisit(visit: AppointmentRecord, audience: "doctor" | "patient") {
  const doctor = findDoctor(visit.doctorId);
  return {
    id: visit.id,
    reference: visit.reference,
    date: visit.date,
    time: visit.time,
    endTime: visit.endTime ?? null,
    status: visit.status,
    reason: reasonLabel(visit.reasonId),
    doctor: doctor?.name ?? "Doctor",
    doctorId: visit.doctorId,
    token: visit.token ?? null,
    ...(audience === "doctor" ? { patientName: visit.patientName } : {}),
  };
}

function statusCounts(visits: readonly AppointmentRecord[]): Record<AppointmentStatus, number> & { total: number } {
  const counts: Record<AppointmentStatus, number> = { booked: 0, completed: 0, cancelled: 0, pending_payment: 0, expired: 0 };
  for (const visit of visits) counts[visit.status] += 1;
  return { ...counts, total: visits.length };
}

export async function doctorAppointments(user: PublicUser, dateInput?: string) {
  const doctor = doctorOnly(user);
  if (!doctor.ok) return doctor;
  const date = resolveDay(dateInput);
  if (typeof date !== "string") return date;
  const visits = (await visitsFor(user)).filter((visit) => visit.date === date);
  const shown = visits.slice(0, LIST_CAP).map((visit) => publicVisit(visit, "doctor"));
  return {
    date,
    doctor: findDoctor(doctor.doctorId)?.name ?? "You",
    count: visits.length,
    truncated: visits.length > shown.length,
    appointments: shown,
  };
}

export async function doctorStats(user: PublicUser, fromInput?: string, toInput?: string) {
  const doctor = doctorOnly(user);
  if (!doctor.ok) return doctor;
  const from = resolveDay(fromInput);
  if (typeof from !== "string") return from;
  const to = resolveDay(toInput, from);
  if (typeof to !== "string") return to;
  if (to < from) return { error: "The end date is before the start date." };
  if (addDays(from, 31) < to) return { error: "Ask for 31 days at a time." };
  const visits = (await visitsFor(user)).filter((visit) => visit.date >= from && visit.date <= to);
  const counts = statusCounts(visits);
  return {
    from,
    to,
    confirmed: counts.booked,
    completed: counts.completed,
    cancelled: counts.cancelled,
    awaitingPayment: counts.pending_payment,
    expiredHolds: counts.expired,
    total: counts.total,
    note: "Confirmed means a booked visit. Awaiting payment is a time held while the patient pays online.",
  };
}

export async function workingHours(user: PublicUser, dateInput?: string) {
  const doctor = doctorOnly(user);
  if (!doctor.ok) return doctor;
  const store = await getStore();
  const sessions = (await store.listConsultSessions(doctor.doctorId)).filter((session) => !session.archivedAt);
  const pattern = sessions.map(describeSession);
  if (!dateInput) {
    return {
      leavesStored: false,
      note: "The practice does not keep a separate leave book. A day with no consulting session is a day you are not in clinic.",
      sessions: pattern,
    };
  }
  const date = resolveDay(dateInput);
  if (typeof date !== "string") return date;
  const overridden = overriddenDates(sessions);
  const onDay = sessions.filter((session) => sessionShownOn(session, date, overridden));
  return {
    date,
    leavesStored: false,
    inClinic: onDay.length > 0,
    note:
      onDay.length > 0
        ? "These are the sessions saved for that day. Bookable times can be shorter where another session has taken a free edge."
        : "No consulting session runs that day. Leave is not stored separately: this is a day out of clinic.",
    sessions: onDay.map(describeSession),
  };
}

function describeSession(session: ConsultSession) {
  return {
    id: session.id,
    label: session.label,
    when: daysLabel(session),
    startTime: session.startTime,
    endTime: session.endTime,
    room: session.room,
    mode: session.mode,
    slotMinutes: session.slotMinutes,
    waveMinutes: session.waveMinutes,
    waveCapacity: session.waveCapacity,
  };
}

export interface IntervalClash {
  referenceA: string;
  referenceB: string;
  patientA: string;
  patientB: string;
  timeA: string;
  timeB: string;
}

/** Booked, held or completed visits whose times overlap. Cancelled and expired visits are ignored. */
export function visitConflicts(visits: readonly AppointmentRecord[]): IntervalClash[] {
  const live = visits.filter((visit) => visit.status === "booked" || visit.status === "pending_payment" || visit.status === "completed");
  const clashes: IntervalClash[] = [];
  for (let i = 0; i < live.length; i += 1) {
    for (let j = i + 1; j < live.length; j += 1) {
      const a = live[i]!;
      const b = live[j]!;
      if (a.date !== b.date || a.doctorId !== b.doctorId) continue;
      if (!overlaps(a.time, endOf(a), b.time, endOf(b))) continue;
      clashes.push({
        referenceA: a.reference,
        referenceB: b.reference,
        patientA: a.patientName,
        patientB: b.patientName,
        timeA: `${a.time}–${endOf(a)}`,
        timeB: `${b.time}–${endOf(b)}`,
      });
    }
  }
  return clashes;
}

function endOf(visit: Pick<AppointmentRecord, "time" | "endTime">): string {
  if (visit.endTime) return visit.endTime;
  return fromMinutes(toMinutes(visit.time) + 10);
}

function overlaps(startA: string, endA: string, startB: string, endB: string): boolean {
  return toMinutes(startA) < toMinutes(endB) && toMinutes(startB) < toMinutes(endA);
}

export async function schedulingConflicts(user: PublicUser, dateInput?: string) {
  const doctor = doctorOnly(user);
  if (!doctor.ok) return doctor;
  const date = resolveDay(dateInput);
  if (typeof date !== "string") return date;
  const store = await getStore();
  const sessions = (await store.listConsultSessions(doctor.doctorId)).filter((session) => !session.archivedAt);
  const overridden = overriddenDates(sessions);
  const onDay = sessions.filter((session) => sessionShownOn(session, date, overridden));
  const sessionClashes: { a: string; b: string }[] = [];
  for (let i = 0; i < onDay.length; i += 1) {
    for (let j = i + 1; j < onDay.length; j += 1) {
      const a = onDay[i]!;
      const b = onDay[j]!;
      if (overlaps(a.startTime, a.endTime, b.startTime, b.endTime)) {
        sessionClashes.push({ a: `${a.label} ${a.startTime}–${a.endTime}`, b: `${b.label} ${b.startTime}–${b.endTime}` });
      }
    }
  }
  const visits = (await visitsFor(user)).filter((visit) => visit.date === date);
  const appointmentClashes = visitConflicts(visits).map((clash) => ({
    references: [clash.referenceA, clash.referenceB],
    patients: [clash.patientA, clash.patientB],
    times: [clash.timeA, clash.timeB],
  }));
  return {
    date,
    sessionClashes,
    appointmentClashes,
    clear: sessionClashes.length === 0 && appointmentClashes.length === 0,
  };
}

function briefSlot(slot: Slot) {
  const doctor = findDoctor(slot.doctorId);
  return {
    id: slot.id,
    doctorId: slot.doctorId,
    doctor: doctor?.name ?? "Doctor",
    date: slot.date,
    time: slot.time,
    endTime: slot.endTime ?? null,
    mode: slot.mode ?? "stream",
    room: slot.room ?? doctor?.room ?? "",
  };
}

export async function openTimes(user: PublicUser, doctorId: string | undefined, dateInput?: string) {
  const target = await doctorTarget(user, doctorId);
  if ("error" in target) return target;
  const slots = openSlots(await getSlots(target.doctorId), [], now());
  const date = dateInput ? resolveDay(dateInput) : null;
  if (date && typeof date !== "string") return date;
  const chosen = (date ? slots.filter((slot) => slot.date === date) : slots).slice(0, 12);
  return {
    doctorId: target.doctorId,
    doctor: findDoctor(target.doctorId)?.name ?? "Doctor",
    date: date ?? null,
    count: date ? slots.filter((slot) => slot.date === date).length : slots.length,
    slots: chosen.map(briefSlot),
    truncated: (date ? slots.filter((slot) => slot.date === date).length : slots.length) > chosen.length,
  };
}

export async function nextFree(user: PublicUser, doctorId?: string) {
  const target = await doctorTarget(user, doctorId);
  if ("error" in target) return target;
  const slots = await getSlots(target.doctorId);
  const next = nextOpening(slots, target.doctorId, [], now());
  if (!next) return { doctorId: target.doctorId, slot: null, note: "No open time in the bookable window." };
  return { slot: briefSlot(next) };
}

export async function suggestTimes(user: PublicUser, doctorId: string | undefined, dateInput: string, time: string) {
  const target = await doctorTarget(user, doctorId);
  if ("error" in target) return target;
  const date = resolveDay(dateInput);
  if (typeof date !== "string") return date;
  if (!/^\d{2}:\d{2}$/.test(time)) return { error: "Use a time as HH:MM." };
  const slots = openSlots(await getSlots(target.doctorId), [], now());
  const exact = slots.find((slot) => slot.date === date && slot.time === time) ?? null;
  const wanted = toMinutes(time);
  const alternatives = [...slots]
    .sort((a, b) => distance(a, date, wanted) - distance(b, date, wanted))
    .filter((slot) => slot !== exact)
    .slice(0, exact ? 4 : 5);
  return {
    requested: { date, time },
    available: Boolean(exact),
    exact: exact ? briefSlot(exact) : null,
    alternatives: alternatives.map(briefSlot),
    note: exact ? "That time is free." : "That time is not free. These are the nearest open times.",
  };
}

function distance(slot: Slot, date: string, minutes: number): number {
  const dayPenalty = slot.date === date ? 0 : 24 * 60;
  return dayPenalty + Math.abs(toMinutes(slot.time) - minutes);
}

async function doctorTarget(user: PublicUser, doctorId: string | undefined): Promise<{ doctorId: string } | { error: string }> {
  if (user.role === "doctor") {
    const doctor = doctorOnly(user);
    if (!doctor.ok) return doctor;
    if (doctorId && doctorId !== doctor.doctorId) return { error: "You can only look at your own book." };
    return { doctorId: doctor.doctorId };
  }
  if (user.role !== "patient") return { error: "That book isn't available to this account." };
  if (!doctorId || !isListed(doctorId)) return { error: "Choose a doctor from the practice list." };
  return { doctorId };
}

export async function patientAppointments(user: PublicUser, which: string) {
  const patient = patientOnly(user);
  if (!patient.ok) return patient;
  const scope = which === "previous" || which === "all" || which === "upcoming" ? which : "upcoming";
  const instant = now();
  const visits = await visitsFor(user);
  const upcoming = visits.filter((visit) => (visit.status === "booked" || visit.status === "pending_payment") && slotStart(visit).getTime() > instant.getTime());
  const previous = visits.filter((visit) => !upcoming.includes(visit));
  const picked = scope === "upcoming" ? upcoming : scope === "previous" ? previous : visits;
  const shown = picked.slice(0, LIST_CAP).map((visit) => publicVisit(visit, "patient"));
  return { which: scope, count: picked.length, truncated: picked.length > shown.length, appointments: shown };
}

export function searchDoctors(user: PublicUser, query: string) {
  if (user.role !== "patient" && user.role !== "doctor") return { error: "Sign in as a patient or a doctor to search." };
  const needle = query.trim().toLowerCase();
  const matches = allDoctors()
    .filter((doctor) => isListed(doctor.id))
    .filter((doctor) => {
      if (!needle) return true;
      const haystack = `${doctor.name} ${doctor.interest} ${doctor.languages.join(" ")} ${doctor.bio}`.toLowerCase();
      return haystack.includes(needle);
    })
    .slice(0, 8)
    .map((doctor) => ({
      id: doctor.id,
      name: doctor.name,
      interest: doctor.interest,
      qualification: doctor.qualification,
      room: doctor.room,
      languages: doctor.languages,
      days: doctor.days,
    }));
  return { query: needle, count: matches.length, doctors: matches };
}

export function visitReasons() {
  return {
    reasons: reasons.map((reason) => ({ id: reason.id, label: reason.label, minutes: reason.minutes })),
  };
}

export async function moneyForPatient(user: PublicUser, reference?: string) {
  const patient = patientOnly(user);
  if (!patient.ok) return patient;
  const visits = await visitsFor(user);
  const wanted = reference?.trim();
  const chosen = wanted ? visits.filter((visit) => visit.reference === wanted) : visits.slice(-20);
  if (wanted && chosen.length === 0) return { error: "No visit with that reference is on your account." };
  const store = await getStore();
  let online: Awaited<ReturnType<typeof paymentHistory>> = [];
  try {
    online = await paymentHistory(chosen);
  } catch (error) {
    console.error(`[assistant] Could not read online payments: ${error instanceof Error ? error.message : "unknown error"}`);
  }
  const onlineByVisit = new Map(online.map((item) => [item.visit.id, item]));
  const rows = [];
  for (const visit of chosen) {
    const charge = await store.getCharge(visit.id).catch(() => null);
    const money = summarise(charge, visit.status);
    const paidOnline = onlineByVisit.get(visit.id);
    rows.push({
      reference: visit.reference,
      date: visit.date,
      time: visit.time,
      doctor: findDoctor(visit.doctorId)?.name ?? "Doctor",
      visitStatus: visit.status,
      fee: money.feePence > 0 ? formatMoney(money.feePence) : null,
      deskOrCard: paymentLine(money),
      refundState: money.refundDuePence > 0 ? `${formatMoney(money.refundDuePence)} still to refund` : money.state,
      online: paidOnline
        ? {
            amount: formatMoney(paidOnline.payment.amountMinor),
            status: paidOnline.payment.status,
            refunds: paidOnline.refunds.map((refund) => refundStatusLabel(refund)),
          }
        : null,
    });
  }
  return { payments: rows, note: "Desk payments are recorded by the practice. Online refunds stay pending until the bank confirms them." };
}

export function prescriptions() {
  return {
    stored: false,
    prescriptions: [],
    message: "This practice does not keep prescriptions in the booking system. Nothing here is a prescription.",
  };
}
