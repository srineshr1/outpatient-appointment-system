"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, Calendar, Check, ClipboardList } from "@/components/icons";
import { PatientHistoryPanel, SessionPatientList } from "./PatientHistoryPanel";
import { Card } from "@/components/ui/Card";
import { holdsPlace, type ScheduleVisit } from "@/components/doctors/schedule-model";
import type { ConsultSession, SessionTrim } from "@/lib/clinic-types";
import type { PatientDetails } from "@/lib/patient-history";
import { addDays, now, practiceWallClock } from "@/lib/clock";
import { relativeDay } from "@/lib/format";
import { hoursOnDate, toMinutes } from "@/lib/sessions";

export interface SessionsViewerProps {
  doctorName: string;
  today: string;
  nowMinutes: number;
  sessions: ConsultSession[];
  visits: ScheduleVisit[];
  trims: SessionTrim[];
  /** Details and earlier visits for each booked patient, keyed by visit id. Built on the server. */
  patients?: Record<string, PatientDetails>;
  room: string;
  visible: boolean;
}

/** Stop looking for a later session after eight weeks. */
const LOOKAHEAD_DAYS = 56;

export interface SessionFocus {
  kind: "now" | "next" | "none";
  patients: number;
  label: string;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  /** The visits holding a place in this session, in queue order (token, then time). */
  visitIds: string[];
}

interface Occurrence {
  session: ConsultSession;
  date: string;
  startTime: string;
  endTime: string;
  startMin: number;
  endMin: number;
}

function liveSessions(sessions: readonly ConsultSession[]): ConsultSession[] {
  return sessions.filter((session) => !session.archivedAt);
}

function occurrencesOn(
  date: string,
  sessions: readonly ConsultSession[],
  trims: readonly SessionTrim[],
): Occurrence[] {
  const roster = liveSessions(sessions);
  const items: Occurrence[] = [];
  for (const session of roster) {
    const hours = hoursOnDate(session, date, trims, roster);
    if (!hours) continue;
    items.push({
      session,
      date,
      startTime: hours.startTime,
      endTime: hours.endTime,
      startMin: toMinutes(hours.startTime),
      endMin: toMinutes(hours.endTime),
    });
  }
  return items;
}

function sessionVisits(item: Occurrence, visits: readonly ScheduleVisit[]): ScheduleVisit[] {
  return visits
    .filter((visit) => {
      if (visit.date !== item.date || !holdsPlace(visit.status)) return false;
      if (visit.sessionId) return visit.sessionId === item.session.id;
      return visit.time >= item.startTime && visit.time < item.endTime;
    })
    .sort((a, b) => a.time.localeCompare(b.time) || (a.token ?? 0) - (b.token ?? 0) || a.id.localeCompare(b.id));
}

/** Latest date worth scanning: the sessions' own end, and never more than eight weeks out. */
function searchEnd(sessions: readonly ConsultSession[], today: string): string {
  const cap = addDays(today, LOOKAHEAD_DAYS);
  let openEnded = false;
  let latest: string | null = null;
  for (const session of liveSessions(sessions)) {
    const end = session.onDate ?? session.endDate ?? null;
    if (!end) {
      openEnded = true;
      continue;
    }
    if (!latest || end > latest) latest = end;
  }
  if (openEnded || !latest || latest > cap) return cap;
  return latest;
}

function asFocus(kind: "now" | "next", item: Occurrence, visits: readonly ScheduleVisit[]): SessionFocus {
  const held = sessionVisits(item, visits);
  return {
    kind,
    patients: held.length,
    visitIds: held.map((visit) => visit.id),
    label: item.session.label || "Consulting session",
    date: item.date,
    startTime: item.startTime,
    endTime: item.endTime,
  };
}

const NONE: SessionFocus = {
  kind: "none",
  patients: 0,
  label: "",
  date: null,
  startTime: null,
  endTime: null,
  visitIds: [],
};

/**
 * The session a doctor should see: the one running now, or the next one to start.
 * Overlapping sessions that are both on now use the one that started latest.
 */
export function focusSession(
  sessions: readonly ConsultSession[],
  visits: readonly ScheduleVisit[],
  trims: readonly SessionTrim[],
  today: string,
  nowMinutes: number,
): SessionFocus {
  const todayItems = occurrencesOn(today, sessions, trims);
  const current = todayItems
    .filter((item) => item.startMin <= nowMinutes && nowMinutes < item.endMin)
    .sort((a, b) => b.startMin - a.startMin || a.session.id.localeCompare(b.session.id))[0];
  if (current) return asFocus("now", current, visits);

  const laterToday = todayItems
    .filter((item) => item.startMin > nowMinutes)
    .sort((a, b) => a.startMin - b.startMin || a.session.id.localeCompare(b.session.id))[0];
  if (laterToday) return asFocus("next", laterToday, visits);

  const end = searchEnd(sessions, today);
  for (let date = addDays(today, 1); date <= end; date = addDays(date, 1)) {
    const next = occurrencesOn(date, sessions, trims).sort(
      (a, b) => a.startMin - b.startMin || a.session.id.localeCompare(b.session.id),
    )[0];
    if (next) return asFocus("next", next, visits);
  }
  return NONE;
}

function patientWord(count: number): string {
  return count === 1 ? "patient" : "patients";
}

export interface SessionStats {
  booked: number;
  waiting: number;
  completed: number;
  awaitingPayment: number;
}

/** Booked from today on, still to be seen today, completed today, and places held for payment. */
export function sessionStats(visits: readonly ScheduleVisit[], today: string): SessionStats {
  let booked = 0;
  let waiting = 0;
  let completed = 0;
  let awaitingPayment = 0;
  for (const visit of visits) {
    if (visit.status === "booked" && visit.date >= today) booked += 1;
    if (visit.status === "booked" && visit.date === today) waiting += 1;
    if (visit.status === "completed" && visit.date === today) completed += 1;
    if (visit.status === "pending_payment") awaitingPayment += 1;
  }
  return { booked, waiting, completed, awaitingPayment };
}

export function SessionsViewer({
  doctorName: _doctorName,
  today,
  nowMinutes,
  sessions,
  visits,
  trims,
  patients = {},
  room: _room,
  visible: _visible,
}: SessionsViewerProps) {
  const [clock, setClock] = useState({ date: today, minutes: nowMinutes });

  useEffect(() => {
    const tick = () => {
      const wall = practiceWallClock(now());
      const minutes = wall.hour * 60 + wall.minute;
      setClock((prev) =>
        prev.date === wall.date && prev.minutes === minutes ? prev : { date: wall.date, minutes },
      );
    };
    tick();
    const timer = window.setInterval(tick, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const focus = useMemo(
    () => focusSession(sessions, visits, trims, clock.date, clock.minutes),
    [sessions, visits, trims, clock],
  );
  const stats = useMemo(() => sessionStats(visits, clock.date), [visits, clock.date]);

  // The session's patients the server sent details for (it leaves out anyone the viewer may not see).
  const roster = useMemo(
    () => focus.visitIds.map((id) => patients[id]).filter((item): item is PatientDetails => Boolean(item)),
    [focus.visitIds, patients],
  );
  const [picked, setPicked] = useState<string | null>(null);
  // Default to the patient with the doctor, then the first still waiting, then the first on the list.
  const fallback =
    roster.find((item) => item.status === "booked" && item.consultStartedLabel) ??
    roster.find((item) => item.status === "booked") ??
    roster[0] ??
    null;
  const selected = roster.find((item) => item.visitId === picked) ?? fallback;

  const when =
    focus.date && focus.startTime && focus.endTime
      ? focus.date === clock.date
        ? `${focus.startTime}–${focus.endTime}`
        : `${focus.startTime}–${focus.endTime} · ${relativeDay(focus.date, clock.date)}`
      : "";

  return (
    <div className="mx-auto max-w-[92rem] px-4 pt-8 pb-16 md:px-8 md:pt-10 xl:px-10">
      <section aria-label="Visit summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-sheet p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-caption font-semibold tracking-wider text-muted uppercase">Booked</h2>
            <span className="flex size-8 items-center justify-center rounded-full bg-accent-soft text-accent">
              <ClipboardList size={16} />
            </span>
          </div>
          <p className="mt-3 text-title1 font-bold text-ink tabular" aria-label={`${stats.booked} booked`}>
            {stats.booked}
          </p>
          <p className="mt-1 text-caption text-muted">Patients booked from today on</p>
        </Card>
        <Card className="rounded-sheet p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-caption font-semibold tracking-wider text-muted uppercase">Waiting today</h2>
            <span className="flex size-8 items-center justify-center rounded-full bg-warn-soft text-warn">
              <Calendar size={16} />
            </span>
          </div>
          <p className="mt-3 text-title1 font-bold text-ink tabular" aria-label={`${stats.waiting} waiting today`}>
            {stats.waiting}
          </p>
          <p className="mt-1 text-caption text-muted">Booked and still to be seen today</p>
        </Card>
        <Card className="rounded-sheet p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-caption font-semibold tracking-wider text-muted uppercase">Completed today</h2>
            <span className="flex size-8 items-center justify-center rounded-full bg-success-soft text-success">
              <Check size={16} />
            </span>
          </div>
          <p className="mt-3 text-title1 font-bold text-ink tabular" aria-label={`${stats.completed} completed today`}>
            {stats.completed}
          </p>
          <p className="mt-1 text-caption text-muted">Visits marked complete today</p>
        </Card>
        <Card className="rounded-sheet p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-caption font-semibold tracking-wider text-muted uppercase">Awaiting payment</h2>
            <span className="flex size-8 items-center justify-center rounded-full bg-warn-soft text-warn">
              <Alert size={16} />
            </span>
          </div>
          <p
            className="mt-3 text-title1 font-bold text-ink tabular"
            aria-label={`${stats.awaitingPayment} awaiting payment`}
          >
            {stats.awaitingPayment}
          </p>
          <p className="mt-1 text-caption text-muted">Places held until the patient pays</p>
        </Card>
      </section>

      <div
        className={
          roster.length > 0
            ? "mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] lg:items-start"
            : "mt-6"
        }
      >
        <div className={roster.length > 0 ? "grid gap-6" : ""}>
      <section aria-labelledby="session-focus-heading" className={roster.length > 0 ? "" : "mx-auto max-w-xl"}>
        <Card className="rounded-sheet px-6 py-10 text-center md:px-10">
          {focus.kind === "none" ? (
            <>
              <h1 id="session-focus-heading" className="text-title3 font-semibold text-ink">
                No upcoming session
              </h1>
              <p className="mt-6 text-title1 font-bold text-ink tabular" aria-label="0 patients">
                0
              </p>
              <p className="mt-2 text-callout text-ink-2">Nothing is on now, and no session is coming up.</p>
            </>
          ) : (
            <>
              <p className="text-caption font-semibold tracking-wider text-muted uppercase">
                {focus.kind === "now" ? "Now" : "Next"}
              </p>
              <h1 id="session-focus-heading" className="mt-2 text-title3 font-semibold text-ink">
                {focus.label}
              </h1>
              <p className="mt-1 text-callout text-ink-2 tabular">{when}</p>
              <p
                className="mt-8 text-title1 font-bold text-ink tabular"
                aria-label={`${focus.patients} ${patientWord(focus.patients)}`}
              >
                {focus.patients}
              </p>
              <p className="mt-1 text-body text-ink-2">{patientWord(focus.patients)}</p>
            </>
          )}
        </Card>
      </section>
          {roster.length > 0 ? (
            <SessionPatientList patients={roster} selectedId={selected?.visitId ?? null} onSelect={setPicked} />
          ) : null}
        </div>
        {roster.length > 0 && selected ? <PatientHistoryPanel details={selected} /> : null}
      </div>
    </div>
  );
}
