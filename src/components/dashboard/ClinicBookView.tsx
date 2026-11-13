"use client";

import Link from "next/link";
import { useId, useMemo, useState, type ReactNode } from "react";
import {
  Alert,
  Bell,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Close,
  Phone,
  Plus,
  Search,
  Sliders,
} from "@/components/icons";
import { AnimatedList, AnimatedListItem } from "@/components/reactbits/AnimatedList";
import { CountUp } from "@/components/reactbits/CountUp";
import { BentoCard, MagicBento } from "@/components/reactbits/MagicBento";
import { RubberSegment } from "@/components/reactbits/RubberSegment";
import { Step, Stepper, type StepItem } from "@/components/reactbits/Stepper";
import { buildWeek, minutesLabel, weekMonday, weekTitle } from "@/components/doctors/schedule-model";
import { Button, ButtonLink } from "@/components/ui/Button";
import { buttonClass } from "@/components/ui/button-styles";
import { Card } from "@/components/ui/Card";
import { PendingButton } from "@/components/ui/PendingButton";
import type {
  AppointmentRecord,
  ConsultSession,
  RescheduleRecord,
  SessionTrim,
  UserAccount,
} from "@/lib/clinic-types";
import { PRACTICE_TZ } from "@/lib/clock";
import { reasons } from "@/lib/data";
import type { DoctorStatus } from "@/lib/doctor-status";
import { formatPhone, formatShortDate, formatWhen } from "@/lib/format";
import type { InboxItem } from "@/lib/ops/types";
import { slotTimeLabel } from "@/lib/sessions";
import { updateVisit } from "@/server/booking-actions";
import { markAllReadAction, openInboxItemAction } from "@/server/inbox-actions";

export interface DoctorFilterOption {
  id: string;
  short: string;
  name: string;
}

export interface ClinicBookViewProps {
  userName: string;
  userRole: UserAccount["role"];
  room: string | null;
  expiresAt: string;
  expiresLabel: string;
  setup: DoctorStatus | null;
  sessions?: ConsultSession[];
  trims?: SessionTrim[];
  inboxItems?: InboxItem[];
  wholeBook: boolean;
  filterDoctorId: string;
  doctorOptions: DoctorFilterOption[];
  doctorNames: Record<string, string>;
  visits: AppointmentRecord[];
  today: string;
  returnTo: string;
  payments: Record<string, string>;
  moves: Record<string, RescheduleRecord[]>;
  pendingDisplacedCount: number;
  noticeSlot?: ReactNode;
  displacedSlot?: ReactNode;
}

type QueueTab = "today" | "upcoming" | "awaiting" | "earlier" | "cancelled" | "all";

function reasonLabel(id: string): string {
  return reasons.find((reason) => reason.id === id)?.label ?? "Appointment";
}

function statusLabel(status: AppointmentRecord["status"]): string {
  if (status === "completed") return "Completed";
  if (status === "cancelled") return "Cancelled";
  if (status === "pending_payment") return "Awaiting payment";
  if (status === "expired") return "Hold expired";
  if (status === "displaced") return "Hours removed, new time pending";
  return "Booked";
}

function statusPillClass(status: AppointmentRecord["status"]): string {
  if (status === "completed") return "bg-success-soft text-success border-success/25";
  if (status === "cancelled" || status === "expired") {
    return "bg-fill text-muted border-hairline";
  }
  if (status === "pending_payment" || status === "displaced") {
    return "bg-warn-soft text-warn border-warn/25";
  }
  return "bg-accent-soft text-accent border-accent/25";
}

function whenLabel(visit: AppointmentRecord): string {
  return visit.endTime && visit.token
    ? slotTimeLabel({ time: visit.time, endTime: visit.endTime, mode: "wave" })
    : visit.time;
}

function spot(date: string, time: string, token: number | null): string {
  return `${formatShortDate(date)}, ${time}${token ? ` (token ${token})` : ""}`;
}

function roleLabel(role: string): string {
  return role === "patient" ? "patient" : role === "doctor" ? "doctor" : "clinic desk";
}

function movedOn(at: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: PRACTICE_TZ,
  }).format(new Date(at));
}

function inboxWhen(at: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: PRACTICE_TZ,
  }).format(new Date(at));
}

function greetingName(name: string, role: UserAccount["role"]): string {
  const clean = name.trim() || "Doctor";
  if (role !== "doctor") return clean;
  return /^dr\.?\s/i.test(clean) ? clean : `Dr ${clean}`;
}

function groupVisits(visits: readonly AppointmentRecord[], today: string) {
  const todayVisits: AppointmentRecord[] = [];
  const upcoming: AppointmentRecord[] = [];
  const earlier: AppointmentRecord[] = [];
  const cancelled: AppointmentRecord[] = [];
  const awaiting: AppointmentRecord[] = [];
  const ordered = [...visits].sort((a, b) =>
    a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date),
  );
  for (const visit of ordered) {
    if (visit.status === "pending_payment") awaiting.push(visit);
    else if (visit.status === "cancelled" || visit.status === "expired") cancelled.push(visit);
    else if (visit.date === today) todayVisits.push(visit);
    else if (visit.date > today) upcoming.push(visit);
    else earlier.push(visit);
  }
  return { awaiting, todayVisits, upcoming, earlier, cancelled };
}

export function ClinicBookView({
  userName,
  userRole,
  room: _room,
  expiresAt,
  expiresLabel,
  setup,
  sessions = [],
  trims = [],
  inboxItems = [],
  wholeBook,
  filterDoctorId,
  doctorOptions,
  doctorNames,
  visits,
  today,
  returnTo,
  payments,
  moves,
  pendingDisplacedCount,
  noticeSlot,
  displacedSlot,
}: ClinicBookViewProps) {
  const searchId = useId();
  const [search, setSearch] = useState("");
  const [weekOffset, setWeekOffset] = useState(0);
  const groups = useMemo(() => groupVisits(visits, today), [visits, today]);

  const [activeTab, setActiveTab] = useState<QueueTab>(() =>
    groups.todayVisits.length > 0 ? "today" : "all",
  );

  const kpis = useMemo(() => {
    const todayQueue = groups.todayVisits.filter((visit) => visit.status === "booked").length;
    const completedToday = groups.todayVisits.filter((visit) => visit.status === "completed").length;
    const upcomingBooked = groups.upcoming.filter((visit) => visit.status === "booked").length;
    const awaitingCount = groups.awaiting.length;
    return {
      todayQueue,
      completedToday,
      upcomingBooked,
      awaitingCount,
      attentionTotal: awaitingCount + pendingDisplacedCount,
      totalActiveAppointments: todayQueue + upcomingBooked,
    };
  }, [groups, pendingDisplacedCount]);

  const tabItems = useMemo(
    () => [
      { value: "today", label: `Today (${groups.todayVisits.length})` },
      { value: "upcoming", label: `Upcoming (${groups.upcoming.length})` },
      { value: "awaiting", label: `Awaiting (${groups.awaiting.length})` },
      { value: "earlier", label: `Earlier (${groups.earlier.length})` },
      { value: "cancelled", label: `Cancelled (${groups.cancelled.length})` },
      { value: "all", label: `All (${visits.length})` },
    ],
    [groups, visits.length],
  );

  const tabVisits = useMemo(() => {
    if (activeTab === "today") return groups.todayVisits;
    if (activeTab === "upcoming") return groups.upcoming;
    if (activeTab === "awaiting") return groups.awaiting;
    if (activeTab === "earlier") return groups.earlier;
    if (activeTab === "cancelled") return groups.cancelled;
    return [
      ...groups.todayVisits,
      ...groups.awaiting,
      ...groups.upcoming,
      ...groups.earlier,
      ...groups.cancelled,
    ];
  }, [activeTab, groups]);

  const filteredVisits = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tabVisits;
    return tabVisits.filter((visit) => {
      const doctorName = (doctorNames[visit.doctorId] ?? "").toLowerCase();
      return (
        visit.patientName.toLowerCase().includes(q) ||
        visit.reference.toLowerCase().includes(q) ||
        visit.patientChi.toLowerCase().includes(q) ||
        doctorName.includes(q)
      );
    });
  }, [tabVisits, search, doctorNames]);

  // 6-day Mon–Sat calendar grid for Sketch 1 (click any calendar item -> Edit sessions page)
  const monday = weekMonday(today, weekOffset);
  const calendarWeek = useMemo(() => {
    const scheduleVisits = visits.map((visit) => ({
      id: visit.id,
      sessionId: visit.sessionId ?? null,
      slotId: visit.slotId,
      date: visit.date,
      time: visit.time,
      endTime: visit.endTime ?? null,
      token: visit.token ?? null,
      reason: reasonLabel(visit.reasonId),
      patientName: visit.patientName,
      status: visit.status,
      reference: visit.reference,
    }));
    return buildWeek(sessions, scheduleVisits, trims, monday, today);
  }, [sessions, visits, trims, monday, today]);

  const unreadInboxCount = inboxItems.filter((item) => !item.readAt).length;
  const isOwnDoctor = userRole === "doctor" && Boolean(setup);

  const defaultStepperIndex = setup
    ? Math.max(0, setup.steps.findIndex((step) => !step.done))
    : 0;
  const stepperItems: StepItem[] = setup
    ? setup.steps.map((step) => ({
        id: step.id,
        title: step.label,
        subtitle: step.done ? "Completed" : "Action needed",
        done: step.done,
      }))
    : [];

  return (
    <div className="mx-auto max-w-[92rem] px-5 pt-8 pb-16 md:px-8 md:pt-10 xl:px-10">
      {/* 1. Greeting Header ("Hello Dr X — You have X appointments") */}
      <section
        aria-labelledby="clinic-book-heading"
        className="rounded-sheet border border-hairline bg-surface p-6 shadow-card md:p-8"
      >
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h1
              id="clinic-book-heading"
              className="text-title2 font-bold tracking-tight text-ink md:text-title1"
            >
              Hello {greetingName(userName, userRole)}
            </h1>

            <p className="mt-1.5 text-body text-ink-2">
              You have{" "}
              <span className="font-semibold text-ink tabular">
                <CountUp to={kpis.totalActiveAppointments} trigger="load" duration={0.6} />
              </span>{" "}
              {kpis.totalActiveAppointments === 1 ? "appointment" : "appointments"} scheduled (
              <span className="tabular font-medium text-ink">{kpis.todayQueue}</span> today). Session
              runs until{" "}
              <time dateTime={expiresAt} className="tabular font-medium text-ink">
                {expiresLabel}
              </time>
              .
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {userRole === "doctor" ? (
              <>
                <ButtonLink href="/dashboard/sessions" variant="secondary" size="md">
                  <Calendar size={16} />
                  View sessions
                </ButtonLink>
                <ButtonLink href="/dashboard/sessions/manage" variant="primary" size="md">
                  <Sliders size={16} />
                  Edit sessions
                </ButtonLink>
              </>
            ) : null}
            {userRole === "admin" ? (
              <ButtonLink href="/admin" variant="primary" size="md">
                Admin console
              </ButtonLink>
            ) : null}
            {userRole === "reception" ? (
              <ButtonLink href="/book" variant="secondary" size="md">
                <Calendar size={16} />
                Book a visit
              </ButtonLink>
            ) : null}
          </div>
        </div>
      </section>

      {/* 2. Sketch 1 Main Grid: Left = Calendar (click item -> Edit sessions), Right = Notifications */}
      {isOwnDoctor ? (
        <section
          aria-label="Calendar and notifications"
          className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(20rem,1fr)] lg:items-start"
        >
          {/* Left: Calendar (6-day grid — click any calendar item to go to editing page) */}
          <Card className="rounded-sheet p-5 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline pb-4">
              <div>
                <h2 className="text-title3 font-semibold text-ink">Calendar</h2>
                <p className="mt-0.5 text-callout text-muted">
                  {weekTitle(monday)} · Click any session block to edit it.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => setWeekOffset((v) => v - 1)}
                  aria-label="Previous week"
                  className="!min-h-9 !px-2.5"
                >
                  <ChevronLeft size={16} />
                </Button>
                <Button
                  variant={weekOffset === 0 ? "primary" : "secondary"}
                  size="md"
                  onClick={() => setWeekOffset(0)}
                  disabled={weekOffset === 0}
                  className="!min-h-9 !px-3"
                >
                  This week
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => setWeekOffset((v) => v + 1)}
                  aria-label="Next week"
                  className="!min-h-9 !px-2.5"
                >
                  <ChevronRight size={16} />
                </Button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {calendarWeek.days.slice(0, 6).map((day) => (
                <div
                  key={day.date}
                  className={`flex min-h-[10rem] flex-col rounded-card border p-3.5 transition-colors ${
                    day.isToday
                      ? "border-accent/45 bg-accent-soft/25"
                      : "border-hairline bg-surface-2/60"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 border-b border-hairline pb-2">
                    <span className="text-callout font-semibold text-ink">
                      {day.dow} <span className="tabular">{day.num}</span>
                    </span>
                    {day.isToday ? (
                      <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-ink">
                        Today
                      </span>
                    ) : (
                      <Link
                        href={`/dashboard/sessions/manage?date=${day.date}`}
                        aria-label={`Add session on ${day.dow} ${day.num}`}
                        className="inline-flex size-6 items-center justify-center rounded-full text-muted transition-colors hover:bg-fill hover:text-ink"
                      >
                        <Plus size={14} />
                      </Link>
                    )}
                  </div>

                  <div className="mt-2.5 flex flex-1 flex-col gap-2">
                    {day.sessions.length === 0 ? (
                      <Link
                        href={`/dashboard/sessions/manage?date=${day.date}`}
                        className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-hairline px-2 py-4 text-center text-caption text-muted no-underline transition-colors hover:border-control hover:bg-surface hover:text-ink"
                      >
                        + Add session
                      </Link>
                    ) : (
                      day.sessions.map((item) => {
                        const isWave = item.session.mode === "wave";
                        return (
                          <Link
                            key={item.key}
                            href={`/dashboard/sessions/manage?session=${item.session.id}`}
                            className={`group block rounded-xl border px-3 py-2 text-left no-underline transition-colors ${
                              isWave
                                ? "border-warn/30 bg-surface hover:border-warn hover:bg-warn-soft/50"
                                : "border-accent/25 bg-surface hover:border-accent hover:bg-accent-soft/50"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1.5">
                              <span className="truncate text-caption font-semibold text-ink">
                                {item.session.label || (isWave ? "Wave" : "Stream")}
                              </span>
                              <span
                                className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                                  isWave ? "bg-warn-soft text-warn" : "bg-accent-soft text-accent"
                                }`}
                              >
                                {isWave ? "Wave" : "Stream"}
                              </span>
                            </div>
                            <p className="mt-1 flex items-center justify-between text-[12px] text-ink-2 tabular">
                              <span>
                                {minutesLabel(item.startMin)}–{minutesLabel(item.endMin)}
                              </span>
                              <span className="text-muted">
                                {item.booked}/{item.capacity}
                              </span>
                            </p>
                          </Link>
                        );
                      })
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Right: Notifications Panel */}
          <Card className="flex h-full flex-col justify-between rounded-sheet p-5 md:p-6">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline pb-4">
                <div className="flex items-center gap-2">
                  <Bell size={18} className="text-accent" />
                  <h2 className="text-title3 font-semibold text-ink">Notifications</h2>
                  {unreadInboxCount > 0 ? (
                    <span className="tabular rounded-full bg-accent-soft px-2 py-0.5 text-caption font-semibold text-accent">
                      {unreadInboxCount} new
                    </span>
                  ) : null}
                </div>
                {unreadInboxCount > 0 ? (
                  <form action={markAllReadAction}>
                    <button
                      type="submit"
                      className="text-caption font-medium text-accent hover:underline underline-offset-4"
                    >
                      Mark all read
                    </button>
                  </form>
                ) : null}
              </div>

              {pendingDisplacedCount > 0 ? (
                <div className="mt-4 rounded-card border border-warn/30 bg-warn-soft px-3.5 py-2.5 text-caption font-medium text-warn">
                  {pendingDisplacedCount} displaced{" "}
                  {pendingDisplacedCount === 1 ? "patient is" : "patients are"} waiting to pick a
                  new time.
                </div>
              ) : null}

              {inboxItems.length === 0 ? (
                <div className="mt-4 rounded-card border border-dashed border-hairline bg-surface-2/50 px-4 py-8 text-center">
                  <p className="text-callout font-medium text-ink">All caught up</p>
                  <p className="mt-1 text-caption text-muted">
                    New bookings, cancellations, and schedule changes appear here.
                  </p>
                </div>
              ) : (
                <AnimatedList className="mt-4 gap-2.5">
                  {inboxItems.slice(0, 5).map((item, index) => (
                    <AnimatedListItem key={item.id} index={index}>
                      <form action={openInboxItemAction}>
                        <input type="hidden" name="id" value={item.id} />
                        <button
                          type="submit"
                          className={`flex w-full items-start gap-2.5 rounded-card border px-3.5 py-2.5 text-left transition-colors ${
                            item.readAt
                              ? "border-hairline bg-surface-2/60 hover:bg-fill"
                              : "border-accent/35 bg-accent-soft/45 hover:bg-accent-soft/75"
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className={`mt-1.5 size-2 shrink-0 rounded-full ${
                              item.readAt ? "bg-transparent" : "bg-accent"
                            }`}
                          />
                          <span className="min-w-0 flex-1">
                            <span
                              className={`block truncate text-callout text-ink ${
                                item.readAt ? "font-medium" : "font-semibold"
                              }`}
                            >
                              {item.title}
                            </span>
                            {item.body ? (
                              <span className="mt-0.5 line-clamp-2 block text-caption text-ink-2">
                                {item.body}
                              </span>
                            ) : null}
                            <span className="mt-1 block text-[11px] text-muted tabular">
                              {inboxWhen(item.createdAt)}
                            </span>
                          </span>
                        </button>
                      </form>
                    </AnimatedListItem>
                  ))}
                </AnimatedList>
              )}
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-hairline pt-4">
              <Link
                href="/inbox"
                className="text-callout font-medium text-accent hover:underline underline-offset-4"
              >
                All notifications
              </Link>
              <Link
                href="/dashboard/notifications"
                className="text-callout font-medium text-ink-2 hover:text-ink hover:underline underline-offset-4"
              >
                Email settings
              </Link>
            </div>
          </Card>
        </section>
      ) : null}

      {/* 3. KPI Bento Strip */}
      <section aria-label="Queue summary" className="mt-6">
        <MagicBento>
          <BentoCard spotlightColor="transparent">
            <div className="flex items-center justify-between gap-3">
              <span className="text-caption font-semibold uppercase tracking-wider text-muted">
                Today&apos;s Queue
              </span>
              <span className="flex size-8 items-center justify-center rounded-full bg-accent-soft text-accent">
                <ClipboardList size={16} />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <CountUp
                to={kpis.todayQueue}
                trigger="load"
                duration={0.6}
                className="text-title1 font-bold text-ink tabular"
              />
            </div>
            <p className="mt-1 text-caption text-muted">Booked patients in today&apos;s queue</p>
          </BentoCard>

          <BentoCard spotlightColor="transparent">
            <div className="flex items-center justify-between gap-3">
              <span className="text-caption font-semibold uppercase tracking-wider text-muted">
                Completed Today
              </span>
              <span className="flex size-8 items-center justify-center rounded-full bg-success-soft text-success">
                <Check size={16} />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <CountUp
                to={kpis.completedToday}
                trigger="load"
                duration={0.6}
                className="text-title1 font-bold text-ink tabular"
              />
            </div>
            <p className="mt-1 text-caption text-muted">Visits marked complete today</p>
          </BentoCard>

          <BentoCard spotlightColor="transparent">
            <div className="flex items-center justify-between gap-3">
              <span className="text-caption font-semibold uppercase tracking-wider text-muted">
                Upcoming Visits
              </span>
              <span className="flex size-8 items-center justify-center rounded-full bg-accent-soft text-accent">
                <Calendar size={16} />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <CountUp
                to={kpis.upcomingBooked}
                trigger="load"
                duration={0.6}
                className="text-title1 font-bold text-ink tabular"
              />
            </div>
            <p className="mt-1 text-caption text-muted">Booked slots from tomorrow onwards</p>
          </BentoCard>

          <BentoCard spotlightColor="transparent">
            <div className="flex items-center justify-between gap-3">
              <span className="text-caption font-semibold uppercase tracking-wider text-muted">
                Awaiting / Displaced
              </span>
              <span className="flex size-8 items-center justify-center rounded-full bg-warn-soft text-warn">
                <Alert size={16} />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <CountUp
                to={kpis.attentionTotal}
                trigger="load"
                duration={0.6}
                className="text-title1 font-bold text-ink tabular"
              />
            </div>
            <p className="mt-1 text-caption text-muted tabular">
              {kpis.awaitingCount} awaiting payment · {pendingDisplacedCount} displaced
            </p>
          </BentoCard>
        </MagicBento>
      </section>

      {/* 4. Onboarding Checklist */}
      {setup && !setup.visible ? (
        <section aria-labelledby="finish-profile" className="mt-6">
          <Card className="rounded-sheet p-5 md:p-6">
            <h2 id="finish-profile" className="text-title3 font-semibold text-ink">
              Finish your profile to appear to patients
            </h2>
            <p className="mt-1 text-callout text-ink-2">
              Patients can&apos;t see or book you until both steps are done.
            </p>
            <Stepper steps={stepperItems} defaultStep={defaultStepperIndex} className="mt-4">
              {setup.steps.map((step) => {
                const targetHref =
                  step.id === "session" ? "/dashboard/sessions/manage" : "/dashboard/profile";
                const ctaLabel =
                  step.id === "profile"
                    ? step.done
                      ? "Review profile"
                      : "Finish profile"
                    : step.done
                      ? "Manage sessions"
                      : "Add session";
                return (
                  <Step key={step.id}>
                    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-hairline bg-surface-2 px-4 py-3.5">
                      <p className="text-callout text-ink-2">
                        {step.detail || "This step is complete and ready for patients."}
                      </p>
                      <ButtonLink
                        href={targetHref}
                        variant={step.done ? "secondary" : "primary"}
                        size="md"
                      >
                        {ctaLabel}
                      </ButtonLink>
                    </div>
                  </Step>
                );
              })}
            </Stepper>
          </Card>
        </section>
      ) : null}

      {/* 5. Notice & Displaced Patients */}
      {noticeSlot}
      {displacedSlot}

      {/* 6. Clinic Book Queue & Filters */}
      <section aria-labelledby="queue-heading" className="mt-8">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="queue-heading" className="text-title3 font-semibold text-ink">
                Patient queue
              </h2>
              <p className="mt-0.5 text-callout text-ink-2">
                Filter by queue window or search by patient name, reference, or CHI.
              </p>
            </div>
            <p className="text-callout text-muted tabular">
              Showing <span className="font-semibold text-ink">{filteredVisits.length}</span> of{" "}
              {tabVisits.length}
            </p>
          </div>

          {wholeBook ? (
            <nav aria-label="Filter by doctor" className="flex flex-wrap gap-2">
              <ButtonLink
                href="/dashboard"
                variant={!filterDoctorId ? "primary" : "secondary"}
                size="md"
                aria-current={!filterDoctorId ? "page" : undefined}
              >
                All doctors
              </ButtonLink>
              {doctorOptions.map((item) => (
                <ButtonLink
                  key={item.id}
                  href={`/dashboard?doctor=${item.id}`}
                  variant={filterDoctorId === item.id ? "primary" : "secondary"}
                  size="md"
                  aria-current={filterDoctorId === item.id ? "page" : undefined}
                >
                  {item.short}
                </ButtonLink>
              ))}
            </nav>
          ) : null}

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-full overflow-x-auto pb-1">
              <RubberSegment
                aria-label="Filter visits by queue status"
                items={tabItems}
                value={activeTab}
                onChange={(val) => setActiveTab(val as QueueTab)}
                equalSlots={false}
                size="md"
                radius={999}
                trackColor="var(--v-fill)"
                thumbColor="var(--v-ink)"
                textColor="var(--v-ink-2)"
                activeTextColor="var(--v-canvas)"
              />
            </div>

            <div className="relative w-full lg:max-w-sm">
              <label htmlFor={searchId} className="sr-only">
                Search patients by name, reference, or CHI
              </label>
              <Search
                size={16}
                className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted"
              />
              <input
                id={searchId}
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, reference, or CHI…"
                className="field pl-10 pr-10"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                  className="absolute top-1/2 right-2.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-muted transition-colors hover:bg-fill hover:text-ink"
                >
                  <Close size={14} />
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {filteredVisits.length === 0 ? (
          <Card className="mt-6 p-6">
            <p className="text-body font-medium text-ink">
              {visits.length === 0
                ? "No visits on this book yet."
                : search.trim()
                  ? "No visits match your search in this tab."
                  : "No visits in this view."}
            </p>
            <p className="mt-1 text-callout text-ink-2">
              {visits.length === 0
                ? "Appointments appear here automatically as soon as a patient books."
                : search.trim()
                  ? "Try clearing your search or switching to the All tab."
                  : "Switch tabs above to inspect upcoming, earlier, or awaiting visits."}
            </p>
          </Card>
        ) : (
          <AnimatedList className="mt-6">
            {filteredVisits.map((visit, index) => {
              const doctorDisplay = doctorNames[visit.doctorId] ?? "Your doctor";
              const visitMoves = moves[visit.id] ?? [];
              return (
                <AnimatedListItem key={visit.id} index={index}>
                  <article
                    className={`rounded-card border bg-surface p-5 shadow-card ${
                      visit.date === today && visit.status === "booked"
                        ? "border-accent/40 ring-1 ring-accent/15"
                        : "border-hairline"
                    }`}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div className="flex flex-wrap items-baseline gap-2.5">
                        <h3 className="text-body font-semibold text-ink">{visit.patientName}</h3>
                        {wholeBook && !filterDoctorId ? (
                          <span className="rounded-full border border-hairline bg-surface-2 px-2.5 py-0.5 text-caption font-medium text-ink-2">
                            {doctorDisplay}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {visit.token ? (
                          <span className="tabular inline-flex items-center rounded-full border border-hairline bg-surface-2 px-2.5 py-0.5 text-caption font-semibold text-ink">
                            Token {visit.token} of {visit.waveCapacity ?? "?"}
                          </span>
                        ) : null}
                        <p
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-caption font-semibold ${statusPillClass(visit.status)}`}
                        >
                          {statusLabel(visit.status)}
                        </p>
                      </div>
                    </div>

                    <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-body text-ink-2">
                      <span className="inline-flex items-center gap-1.5 tabular font-medium text-ink">
                        <Clock size={15} className="text-muted" />
                        {formatWhen({ date: visit.date, time: whenLabel(visit) }, today)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{doctorDisplay}</span>
                      <span aria-hidden="true">·</span>
                      <span>{reasonLabel(visit.reasonId)}</span>
                    </p>

                    <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-callout text-muted">
                      <span>
                        Reference <span className="tabular font-medium text-ink">{visit.reference}</span>
                      </span>
                      {payments[visit.id] ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="tabular text-ink">{payments[visit.id]}</span>
                        </>
                      ) : null}
                      {visit.patientMobile ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1 tabular">
                            <Phone size={13} />
                            {formatPhone(visit.patientMobile)}
                          </span>
                        </>
                      ) : null}
                      {visit.patientChi ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>
                            CHI <span className="tabular text-ink-2">{visit.patientChi}</span>
                          </span>
                        </>
                      ) : null}
                    </p>

                    {visit.token ? (
                      <p className="mt-1.5 text-caption text-muted">
                        Seen in token order within this wave.
                      </p>
                    ) : null}

                    {visitMoves.length > 0 ? (
                      <ul
                        aria-label="History of moves"
                        className="mt-2.5 grid gap-1 rounded-xl border border-hairline bg-surface-2 px-3.5 py-2.5 text-callout text-muted"
                      >
                        {visitMoves.map((move) => (
                          <li key={move.id}>
                            Moved by {move.byName} ({roleLabel(move.byRole)}) from{" "}
                            <span className="tabular text-ink-2">
                              {spot(move.fromDate, move.fromTime, move.fromToken)}
                            </span>{" "}
                            to{" "}
                            <span className="tabular text-ink-2">
                              {spot(move.toDate, move.toTime, move.toToken)}
                            </span>{" "}
                            on <span className="tabular">{movedOn(move.at)}</span>
                            {move.reason ? `. “${move.reason}”` : "."}
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    {visit.note ? (
                      <p className="mt-3 rounded-xl border border-hairline bg-surface-2 px-3.5 py-2.5 text-callout whitespace-pre-line text-ink-2">
                        {visit.note}
                      </p>
                    ) : null}

                    {visit.status === "pending_payment" ? (
                      <div className="group mt-4 flex flex-wrap items-center gap-3">
                        <form action={updateVisit}>
                          <input type="hidden" name="id" value={visit.id} />
                          <input type="hidden" name="status" value="cancelled" />
                          <input type="hidden" name="return" value={returnTo} />
                          <PendingButton
                            pendingLabel="Releasing…"
                            className={buttonClass(
                              "plain",
                              "md",
                              "group-has-[[aria-busy=true]]:pointer-events-none",
                            )}
                            aria-label={`Give up the held place, ${formatWhen(visit, today)}`}
                          >
                            Give up this place
                          </PendingButton>
                        </form>
                      </div>
                    ) : null}

                    {visit.status === "booked" ? (
                      <div className="group mt-4 flex flex-wrap items-center gap-3">
                        <form action={updateVisit}>
                          <input type="hidden" name="id" value={visit.id} />
                          <input type="hidden" name="status" value="completed" />
                          <input type="hidden" name="return" value={returnTo} />
                          <PendingButton
                            pendingLabel="Marking complete…"
                            className={buttonClass(
                              "secondary",
                              "md",
                              "group-has-[[aria-busy=true]]:pointer-events-none",
                            )}
                            aria-label={`Mark complete, ${visit.patientName}, ${formatWhen(visit, today)}`}
                          >
                            Mark complete
                          </PendingButton>
                        </form>

                        {visit.date >= today ? (
                          <ButtonLink
                            href={`/reschedule/${visit.id}?return=${encodeURIComponent(returnTo)}`}
                            variant="secondary"
                            size="md"
                            aria-label={`Reschedule ${visit.patientName}, ${formatWhen(visit, today)}`}
                          >
                            Reschedule
                          </ButtonLink>
                        ) : null}

                        <form action={updateVisit}>
                          <input type="hidden" name="id" value={visit.id} />
                          <input type="hidden" name="status" value="cancelled" />
                          <input type="hidden" name="return" value={returnTo} />
                          <PendingButton
                            pendingLabel="Cancelling…"
                            className={buttonClass(
                              "plain",
                              "md",
                              "group-has-[[aria-busy=true]]:pointer-events-none",
                            )}
                            aria-label={`Cancel ${visit.patientName}, ${formatWhen(visit, today)}`}
                          >
                            Cancel visit
                          </PendingButton>
                        </form>
                      </div>
                    ) : null}
                  </article>
                </AnimatedListItem>
              );
            })}
          </AnimatedList>
        )}
      </section>
    </div>
  );
}
