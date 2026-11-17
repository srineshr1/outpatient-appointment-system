"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import {
  Bell,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  Sliders,
} from "@/components/icons";
import { AnimatedList, AnimatedListItem } from "@/components/reactbits/AnimatedList";
import { doctorTitle } from "@/lib/names";
import { Step, Stepper, type StepItem } from "@/components/reactbits/Stepper";
import { buildWeek, minutesLabel, weekMonday, weekTitle } from "@/components/doctors/schedule-model";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card, Notice } from "@/components/ui/Card";
import { QueueBoard } from "./QueueBoard";
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
import type { InboxItem } from "@/lib/ops/types";
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
  /** A doctor account an admin has not verified yet: patients cannot book it. */
  verificationPending?: boolean;
}

function reasonLabel(id: string): string {
  return reasons.find((reason) => reason.id === id)?.label ?? "Appointment";
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
  return doctorTitle(clean);
}

export function groupVisits(visits: readonly AppointmentRecord[], today: string) {
  const todayVisits: AppointmentRecord[] = [];
  const upcoming: AppointmentRecord[] = [];
  const earlier: AppointmentRecord[] = [];
  const cancelled: AppointmentRecord[] = [];
  const awaiting: AppointmentRecord[] = [];
  // Same wave: token order, so the queue reads in the order patients are seen.
  const ordered = [...visits].sort((a, b) =>
    a.date === b.date ? a.time.localeCompare(b.time) || (a.token ?? 0) - (b.token ?? 0) : a.date.localeCompare(b.date),
  );
  for (const visit of ordered) {
    if (visit.status === "pending_payment") awaiting.push(visit);
    // A displaced visit (hours removed, new time pending) is not an active visit: it sits with the
    // cancelled ones until the patient picks a new time, and is counted in "displaced" separately.
    else if (visit.status === "cancelled" || visit.status === "expired" || visit.status === "displaced" || visit.status === "no_show") cancelled.push(visit);
    else if (visit.date === today) todayVisits.push(visit);
    else if (visit.date > today) upcoming.push(visit);
    else earlier.push(visit);
  }
  return { awaiting, todayVisits, upcoming, earlier, cancelled };
}

export function ClinicBookView({
  userName,
  userRole,
  expiresAt,
  expiresLabel,
  setup,
  sessions = [],
  trims = [],
  inboxItems = [],
  visits,
  today,
  pendingDisplacedCount,
  noticeSlot,
  displacedSlot,
  verificationPending = false,
  wholeBook,
  doctorNames,
  returnTo,
}: ClinicBookViewProps) {
  const [weekOffset, setWeekOffset] = useState(0);
  const groups = useMemo(() => groupVisits(visits, today), [visits, today]);

  const kpis = useMemo(() => {
    const todayQueue = groups.todayVisits.filter((visit) => visit.status === "booked").length;
    const upcomingBooked = groups.upcoming.filter((visit) => visit.status === "booked").length;
    return {
      todayQueue,
      totalActiveAppointments: todayQueue + upcomingBooked,
    };
  }, [groups]);

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
        className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"
      >
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
              {kpis.totalActiveAppointments}
            </span>{" "}
            {kpis.totalActiveAppointments === 1 ? "appointment" : "appointments"} scheduled (
            <span className="tabular font-medium text-ink">{kpis.todayQueue}</span> today).
          </p>
          <p className="mt-1 text-caption text-muted">
            You&apos;ll be signed out at{" "}
            <time dateTime={expiresAt} className="tabular font-medium text-ink-2">
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
      </section>

      {verificationPending ? (
        <Notice tone="info" className="mt-4">
          Your account is waiting for the practice to verify it. You can set up your profile and sessions now. Patients can find and book you once an admin verifies you.
        </Notice>
      ) : null}

      {noticeSlot}

      <QueueBoard visits={visits} today={today} doctorNames={doctorNames} returnTo={returnTo} showDoctor={wholeBook} />

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
                    <span className="flex items-center gap-1.5">
                      {day.isToday ? (
                        <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-ink">
                          Today
                        </span>
                      ) : null}
                      {/* Past days can't take a new session, so they offer no "+". */}
                      {day.date >= today ? (
                        <Link
                          href={`/dashboard/sessions/manage?date=${day.date}`}
                          aria-label={`Add session on ${day.dow} ${day.num}`}
                          className="inline-flex size-6 items-center justify-center rounded-full text-muted transition-colors hover:bg-fill hover:text-ink"
                        >
                          <Plus size={14} />
                        </Link>
                      ) : null}
                    </span>
                  </div>

                  <div className="mt-2.5 flex flex-1 flex-col gap-2">
                    {day.sessions.length === 0 && day.date < today ? (
                      <p className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-hairline px-2 py-4 text-center text-caption text-muted">
                        No sessions
                      </p>
                    ) : day.sessions.length === 0 ? (
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
                            href={`/dashboard/sessions/manage?session=${encodeURIComponent(item.session.id)}&date=${day.date}`}
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
      {displacedSlot}

    </div>
  );
}
