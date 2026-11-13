"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Edit,
  Pin,
  Sliders,
  Users,
} from "@/components/icons";
import { useTheme } from "@/components/providers/ThemeProvider";
import { AnimatedList, AnimatedListItem } from "@/components/reactbits/AnimatedList";
import { CountUp } from "@/components/reactbits/CountUp";
import { BentoCard, MagicBento } from "@/components/reactbits/MagicBento";
import { RubberSegment } from "@/components/reactbits/RubberSegment";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  buildWeek,
  holdsPlace,
  minutesLabel,
  occurrenceLabel,
  sessionIsPast,
  todayTitle,
  weekMonday,
  weekTag,
  weekTitle,
  type DaySession,
  type ScheduleDay,
  type ScheduleVisit,
  type Seat,
  type TimeBlock,
  type WeekModel,
} from "@/components/doctors/schedule-model";
import type { AppointmentStatus, ConsultSession, SessionTrim } from "@/lib/clinic-types";
import { addDays, dayOfMonth } from "@/lib/clock";
import {
  describeSession,
  hoursOnDate,
  sessionBlocks,
  sessionRunsOn,
  slotTimeLabel,
  toMinutes,
  trimsCovering,
} from "@/lib/sessions";

export interface SessionsViewerProps {
  doctorName: string;
  today: string;
  nowMinutes: number;
  sessions: ConsultSession[];
  visits: ScheduleVisit[];
  trims: SessionTrim[];
  room: string;
  visible: boolean;
}

type ViewMode = "week" | "directory";

interface InspectedVisit {
  visit: ScheduleVisit;
  blockEndTime: string;
  outsideHours: boolean;
}

const VISIT_STATUS_STYLE: Record<AppointmentStatus, { label: string; className: string }> = {
  booked: { label: "Confirmed", className: "bg-accent-soft text-accent" },
  pending_payment: { label: "Awaiting payment", className: "bg-warn-soft text-warn" },
  completed: { label: "Completed", className: "bg-success-soft text-success" },
  cancelled: { label: "Cancelled", className: "bg-fill text-muted" },
  expired: { label: "Expired", className: "bg-fill text-muted" },
  displaced: { label: "Displaced", className: "bg-danger-soft text-danger" },
};

function buildSundayDay(
  sessions: readonly ConsultSession[],
  visits: readonly ScheduleVisit[],
  trims: readonly SessionTrim[],
  sundayDate: string,
  today: string,
): ScheduleDay | null {
  const live = sessions.filter((session) => !session.archivedAt);
  const holding = visits.filter((visit) => holdsPlace(visit.status));
  const claimed = new Set<string>();
  const daySessions: DaySession[] = [];

  for (const session of live) {
    const hours = hoursOnDate(session, sundayDate, trims, live);
    if (!hours) continue;
    const coveredTrims = trimsCovering(session.id, sundayDate, trims, live);
    const open = sessionBlocks(session).filter(
      (block) =>
        block.time >= hours.startTime &&
        block.endTime <= hours.endTime &&
        !coveredTrims.some(
          (trim) =>
            toMinutes(block.time) < toMinutes(trim.endTime) &&
            toMinutes(trim.startTime) < toMinutes(block.endTime),
        ),
    );
    if (open.length === 0) continue;

    const mine = holding.filter((visit) => {
      if (visit.date !== sundayDate || claimed.has(visit.id)) return false;
      if (visit.sessionId) return visit.sessionId === session.id;
      return visit.time >= hours.startTime && visit.time < hours.endTime;
    });
    for (const visit of mine) claimed.add(visit.id);

    const places = session.mode === "wave" ? Math.max(1, session.waveCapacity ?? 1) : 1;
    const times = new Set(open.map((block) => block.time));
    const byTime = new Map<string, ScheduleVisit[]>();
    const outside: ScheduleVisit[] = [];
    for (const visit of mine) {
      if (!times.has(visit.time)) {
        outside.push(visit);
        continue;
      }
      const list = byTime.get(visit.time) ?? [];
      list.push(visit);
      byTime.set(visit.time, list);
    }

    const blocks: TimeBlock[] = open.map((block) => {
      const waiting = (byTime.get(block.time) ?? [])
        .slice()
        .sort((a, b) => (a.token ?? 99) - (b.token ?? 99) || a.patientName.localeCompare(b.patientName));
      const seats: Seat[] = Array.from({ length: places }, (_, index) => ({ seat: index + 1, visit: null }));
      for (const visit of waiting) {
        const preferred =
          visit.token && visit.token >= 1 && visit.token <= places
            ? visit.token - 1
            : seats.findIndex((seat) => !seat.visit);
        const slotIndex =
          preferred >= 0 && !seats[preferred]!.visit
            ? preferred
            : seats.findIndex((seat) => !seat.visit);
        if (slotIndex < 0) outside.push(visit);
        else seats[slotIndex] = { seat: slotIndex + 1, visit };
      }
      return { ...block, places, seats };
    });

    const booked = blocks.reduce(
      (sum, block) => sum + block.seats.filter((seat) => seat.visit).length,
      0,
    );
    const capacity = blocks.reduce((sum, block) => sum + block.places, 0);

    daySessions.push({
      key: `${session.id}::${sundayDate}`,
      session,
      date: sundayDate,
      startMin: toMinutes(open[0]!.time),
      endMin: toMinutes(open[open.length - 1]!.endTime),
      blocks,
      booked,
      capacity,
      outside,
      lane: 0,
      lanes: 1,
    });
  }

  if (daySessions.length === 0) return null;
  daySessions.sort((a, b) => a.startMin - b.startMin);
  const count = daySessions.length;
  const totalBooked = daySessions.reduce((sum, item) => sum + item.booked, 0);
  const totalCap = daySessions.reduce((sum, item) => sum + item.capacity, 0);

  return {
    date: sundayDate,
    dow: "Sun",
    num: dayOfMonth(sundayDate),
    isToday: sundayDate === today,
    summary: `${count} ${count === 1 ? "session" : "sessions"} · ${totalBooked}/${totalCap}`,
    sessions: daySessions,
  };
}

function buildFullWeek(
  sessions: readonly ConsultSession[],
  visits: readonly ScheduleVisit[],
  trims: readonly SessionTrim[],
  monday: string,
  today: string,
): WeekModel {
  const base = buildWeek(sessions, visits, trims, monday, today);
  const sunday = buildSundayDay(sessions, visits, trims, addDays(monday, 6), today);
  if (!sunday) return base;

  const sundayBooked = sunday.sessions.reduce((sum, item) => sum + item.booked, 0);
  const sundayCap = sunday.sessions.reduce((sum, item) => sum + item.capacity, 0);
  return {
    days: [...base.days, sunday],
    booked: base.booked + sundayBooked,
    capacity: base.capacity + sundayCap,
  };
}

function collectOccurrenceVisits(occurrence: DaySession): InspectedVisit[] {
  const list: InspectedVisit[] = [];
  for (const block of occurrence.blocks) {
    for (const seat of block.seats) {
      if (seat.visit) {
        list.push({
          visit: seat.visit,
          blockEndTime: block.endTime,
          outsideHours: false,
        });
      }
    }
  }
  for (const visit of occurrence.outside) {
    list.push({
      visit,
      blockEndTime: visit.endTime ?? visit.time,
      outsideHours: true,
    });
  }
  return list;
}

function upcomingBookedCount(
  session: ConsultSession,
  visits: readonly ScheduleVisit[],
  today: string,
): number {
  return visits.filter((visit) => {
    if (!holdsPlace(visit.status) || visit.date < today) return false;
    if (visit.sessionId) return visit.sessionId === session.id;
    return (
      sessionRunsOn(session, visit.date) &&
      visit.time >= session.startTime &&
      visit.time < session.endTime
    );
  }).length;
}

function SessionModeBadge({ mode }: { mode: ConsultSession["mode"] }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase ${
        mode === "stream" ? "bg-accent-soft text-accent" : "bg-warn-soft text-warn"
      }`}
    >
      {mode === "stream" ? "Stream" : "Wave"}
    </span>
  );
}

export function SessionsViewer({
  doctorName: _doctorName,
  today,
  nowMinutes,
  sessions,
  visits,
  trims,
  room: _room,
  visible: _visible,
}: SessionsViewerProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [view, setView] = useState<ViewMode>("week");
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [showActiveOnly, setShowActiveOnly] = useState(false);

  const monday = weekMonday(today, weekOffset);
  const week = useMemo(
    () => buildFullWeek(sessions, visits, trims, monday, today),
    [sessions, visits, trims, monday, today],
  );

  const activeDays = useMemo(
    () => week.days.filter((day) => day.sessions.length > 0),
    [week.days],
  );

  const weekOccurrences = useMemo(
    () => week.days.flatMap((day) => day.sessions),
    [week],
  );

  const selected = useMemo(
    () =>
      weekOccurrences.find((item) => item.key === selectedKey) ??
      weekOccurrences.find((item) => item.date === today) ??
      weekOccurrences[0] ??
      null,
    [weekOccurrences, selectedKey, today],
  );

  const selectedVisits = useMemo(
    () => (selected ? collectOccurrenceVisits(selected) : []),
    [selected],
  );

  const streamCount = sessions.filter((s) => s.mode === "stream").length;
  const waveCount = sessions.filter((s) => s.mode === "wave").length;
  const openPlaces = Math.max(0, week.capacity - week.booked);
  const utilizationPct =
    week.capacity > 0 ? Math.round((week.booked / week.capacity) * 100) : 0;

  const isFilteringActive = showActiveOnly && activeDays.length > 0;
  const displayedDays = isFilteringActive ? activeDays : week.days;

  return (
    <div className="mx-auto max-w-[92rem] space-y-6 px-4 pt-6 pb-16 md:px-8 md:pt-8 xl:px-10">
      {/* 1. Weekly Metrics Strip */}
      <MagicBento>
        <BentoCard spotlightColor="transparent">
          <p className="text-caption font-medium text-muted">Active sessions</p>
          <p className="mt-2 text-title2 font-semibold text-ink tabular">
            <CountUp to={sessions.length} duration={0.7} trigger="load" />
          </p>
          <p className="mt-1 text-caption text-ink-2">
            {streamCount} stream · {waveCount} wave
          </p>
        </BentoCard>

        <BentoCard spotlightColor="transparent">
          <p className="text-caption font-medium text-muted">Weekly capacity</p>
          <p className="mt-2 text-title2 font-semibold text-ink tabular">
            <CountUp to={week.capacity} duration={0.7} trigger="load" />
          </p>
          <p className="mt-1 text-caption text-ink-2">Slots &amp; wave places this week</p>
        </BentoCard>

        <BentoCard spotlightColor="transparent">
          <p className="text-caption font-medium text-muted">Booked this week</p>
          <p className="mt-2 text-title2 font-semibold text-ink tabular">
            <CountUp to={week.booked} duration={0.7} trigger="load" />
          </p>
          <p className="mt-1 text-caption text-ink-2">{utilizationPct}% week occupancy</p>
        </BentoCard>

        <BentoCard spotlightColor="transparent">
          <p className="text-caption font-medium text-muted">Open places this week</p>
          <p className="mt-2 text-title2 font-semibold text-ink tabular">
            <CountUp to={openPlaces} duration={0.7} trigger="load" />
          </p>
          <p className="mt-1 text-caption text-ink-2">Available for patient booking</p>
        </BentoCard>
      </MagicBento>

      {/* 2. Unified Schedule Workspace */}
      <section
        aria-label={view === "week" ? "Weekly schedule grid" : "Active sessions directory"}
        className="rounded-sheet border border-hairline bg-surface p-4 shadow-card sm:p-6"
      >
        {/* Unified Controls Header */}
        <div className="mb-6 flex flex-col gap-3.5 lg:flex-row lg:items-center lg:justify-between border-b border-hairline pb-4">
          {/* Left: View Switcher (Week Grid | Session Directory) & Date title */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <RubberSegment
              aria-label="Schedule view"
              value={view}
              onChange={(next) => setView(next as ViewMode)}
              size="md"
              radius={12}
              equalSlots={false}
              trackColor={isDark ? "#18181b" : "#f4f4f5"}
              thumbColor={isDark ? "#27272a" : "#ffffff"}
              textColor={isDark ? "#a1a1aa" : "#52525b"}
              activeTextColor={isDark ? "#fafafa" : "#09090b"}
              className="border border-hairline"
              items={[
                { value: "week", label: "Week Grid", icon: <Calendar size={15} /> },
                { value: "directory", label: "Session Directory", icon: <ClipboardList size={15} /> },
              ]}
            />

            {view === "week" ? (
              <div className="flex items-center gap-2">
                <span className="text-callout font-semibold text-ink">{weekTitle(monday)}</span>
                {weekOffset === 0 ? (
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">
                    This week
                  </span>
                ) : (
                  <span className="rounded-full bg-surface-2 border border-hairline px-2 py-0.5 text-[11px] font-medium text-muted">
                    {weekTag(weekOffset)}
                  </span>
                )}
              </div>
            ) : null}
          </div>

          {/* Right: Prev week / This week / Next week + Edit sessions */}
          <div className="flex flex-wrap items-center gap-2.5">
            {view === "week" ? (
              <div className="inline-flex h-9 items-center rounded-xl border border-hairline bg-surface-2 p-0.5 text-caption">
                <button
                  type="button"
                  onClick={() => setWeekOffset((offset) => offset - 1)}
                  aria-label="Previous week"
                  className="inline-flex h-full items-center gap-1 rounded-lg px-2.5 font-medium text-ink-2 hover:bg-surface hover:text-ink transition"
                >
                  <ChevronLeft size={14} />
                  <span>Prev week</span>
                </button>
                <button
                  type="button"
                  onClick={() => setWeekOffset(0)}
                  disabled={weekOffset === 0}
                  className={`h-full rounded-lg px-2.5 font-semibold transition ${
                    weekOffset === 0
                      ? "bg-surface text-ink shadow-sm cursor-default"
                      : "text-muted hover:text-ink disabled:opacity-40"
                  }`}
                >
                  This week
                </button>
                <button
                  type="button"
                  onClick={() => setWeekOffset((offset) => offset + 1)}
                  aria-label="Next week"
                  className="inline-flex h-full items-center gap-1 rounded-lg px-2.5 font-medium text-ink-2 hover:bg-surface hover:text-ink transition"
                >
                  <span>Next week</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            ) : null}

            <Link
              href="/dashboard/sessions/manage"
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-ink px-3.5 text-caption font-semibold text-canvas transition hover:opacity-90 active:opacity-85 shadow-sm"
            >
              <Sliders size={14} />
              <span>Edit sessions</span>
            </Link>
          </div>
        </div>

        {/* Content Body: Week Grid OR Session Directory */}
        {view === "week" ? (
          <div
            className={`grid gap-3 sm:grid-cols-2 md:grid-cols-3 ${
              week.days.length === 7 ? "lg:grid-cols-7" : "lg:grid-cols-6"
            }`}
          >
            {week.days.map((day) => (
              <div
                key={day.date}
                className={`flex min-w-0 flex-col rounded-card border p-3.5 transition ${
                  day.isToday
                    ? "border-accent/45 bg-accent-soft/20 shadow-sm"
                    : "border-hairline bg-surface-2/60"
                }`}
              >
                <div className="flex items-start justify-between gap-2 border-b border-hairline pb-2.5">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-callout font-semibold text-ink">{day.dow}</span>
                      <span className="text-callout font-semibold text-ink tabular">{day.num}</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted tabular">{day.summary}</p>
                  </div>
                  {day.isToday ? (
                    <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-accent-ink">
                      Today
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 flex flex-1 flex-col gap-2.5">
                  {day.sessions.length === 0 ? (
                    <div className="flex min-h-[90px] flex-1 items-center justify-center rounded-xl border border-dashed border-hairline/80 bg-surface-2/20 p-4 text-center">
                      <p className="text-caption text-muted">No sessions</p>
                    </div>
                  ) : (
                    day.sessions.map((item) => {
                      const isSelected = selected?.key === item.key;
                      const isStream = item.session.mode === "stream";
                      const pct =
                        item.capacity > 0
                          ? Math.min(100, Math.round((item.booked / item.capacity) * 100))
                          : 0;
                      const isLiveNow =
                        day.isToday &&
                        nowMinutes >= item.startMin &&
                        nowMinutes < item.endMin;

                      return (
                        <button
                          key={item.key}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => setSelectedKey(item.key)}
                          className={`group flex w-full flex-col gap-2.5 rounded-xl border p-3.5 text-left transition-all ${
                            isSelected
                              ? isStream
                                ? "border-accent bg-accent-soft shadow-raised ring-2 ring-accent/40"
                                : "border-warn bg-warn-soft shadow-raised ring-2 ring-warn/40"
                              : isStream
                                ? "border-accent/25 bg-surface hover:border-accent/60 hover:bg-accent-soft/45 hover:shadow-card"
                                : "border-warn/25 bg-surface hover:border-warn/60 hover:bg-warn-soft/45 hover:shadow-card"
                          }`}
                        >
                          {/* Top row: Mode badge & Type tags */}
                          <div className="flex items-center justify-between gap-1.5">
                            <SessionModeBadge mode={item.session.mode} />
                            <div className="flex items-center gap-1.5 shrink-0">
                              {isLiveNow ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-semibold text-success">
                                  <span aria-hidden="true" className="size-1.5 rounded-full bg-success animate-pulse" />
                                  Live
                                </span>
                              ) : null}
                              {item.session.onDate ? (
                                <span className="rounded-full border border-hairline bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-ink-2">
                                  One-off
                                </span>
                              ) : null}
                            </div>
                          </div>

                          {/* Title */}
                          <div>
                            <h3 className="line-clamp-2 text-caption sm:text-[13px] font-semibold text-ink leading-snug">
                              {item.session.label || "Consulting session"}
                            </h3>
                          </div>

                          {/* Time & Room */}
                          <div className="space-y-1 text-[12px] text-ink-2">
                            <p className="flex items-center gap-1.5 whitespace-nowrap font-medium tabular">
                              <Clock size={13} className="shrink-0 text-muted" />
                              <span>
                                {minutesLabel(item.startMin)}–{minutesLabel(item.endMin)}
                              </span>
                            </p>
                            <p className="flex items-center gap-1.5 truncate text-muted">
                              <Pin size={13} className="shrink-0 text-muted" />
                              <span className="truncate">{item.session.room}</span>
                            </p>
                          </div>

                          {/* Capacity meter */}
                          <div className="pt-1 border-t border-hairline/60">
                            <div className="flex items-center justify-between text-[11px] font-medium text-ink-2 tabular">
                              <span>
                                {item.booked}/{item.capacity} booked
                              </span>
                              <span className={pct > 0 ? "font-semibold text-ink" : "text-muted"}>
                                {pct}%
                              </span>
                            </div>
                            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-fill-strong">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  isStream ? "bg-accent" : "bg-warn"
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <Card className="rounded-sheet p-8 text-center">
            <h2 className="text-title3 font-semibold text-ink">No active consulting sessions</h2>
            <p className="mx-auto mt-2 max-w-md text-callout text-ink-2">
              Add your weekly or one-off consulting hours in Session Studio so patients can see and book you.
            </p>
            <div className="mt-5 flex justify-center">
              <ButtonLink href="/dashboard/sessions/manage" variant="primary" size="md">
                <Sliders size={16} />
                Create first session in Studio
              </ButtonLink>
            </div>
          </Card>
        ) : (
          <AnimatedList className="grid gap-4 md:grid-cols-2">
            {sessions.map((session, index) => {
              const upcoming = upcomingBookedCount(session, visits, today);
              const past = sessionIsPast(session, today);

              return (
                <AnimatedListItem key={session.id} index={index}>
                  <Card className="flex h-full flex-col justify-between gap-4 rounded-sheet p-5 md:p-6">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <h2 className="text-title3 font-semibold text-ink">
                          {session.label || "Consulting session"}
                        </h2>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <SessionModeBadge mode={session.mode} />
                          {session.onDate ? (
                            <span className="rounded-full bg-fill px-2.5 py-0.5 text-[11px] font-medium text-ink-2">
                              One-off
                            </span>
                          ) : null}
                          {past ? (
                            <span className="rounded-full bg-fill px-2.5 py-0.5 text-[11px] font-medium text-muted">
                              Ended
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <p className="text-callout text-ink-2">{describeSession(session)}</p>

                      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1 text-caption text-muted">
                        <span className="inline-flex items-center gap-1.5">
                          <Pin size={14} />
                          {session.room}
                        </span>
                        <span className="inline-flex items-center gap-1.5 tabular">
                          <Users size={14} />
                          {upcoming} upcoming {upcoming === 1 ? "visit" : "visits"}
                        </span>
                      </div>
                    </div>

                    <div className="border-t border-hairline pt-4">
                      <ButtonLink
                        href={`/dashboard/sessions/manage?session=${session.id}`}
                        variant="secondary"
                        size="md"
                        className="w-full justify-center"
                      >
                        <Edit size={16} />
                        Edit in Studio
                      </ButtonLink>
                    </div>
                  </Card>
                </AnimatedListItem>
              );
            })}
          </AnimatedList>
        )}
      </section>

      {/* 3. Session & Patient Inspector (in Week view) */}
      {view === "week" ? (
        <section
          aria-label="Session and patient inspector"
          className="rounded-sheet border border-hairline bg-surface p-5 shadow-card md:p-6"
        >
          {selected ? (
            <div className="grid gap-6 lg:grid-cols-12">
              {/* Session Details & Capacity: 5 cols on lg, 4 cols on xl */}
              <div className="space-y-5 lg:col-span-5 xl:col-span-4">
                <div className="space-y-2 border-b border-hairline pb-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-caption font-medium uppercase tracking-wider text-muted">
                      Session inspector
                    </span>
                    <SessionModeBadge mode={selected.session.mode} />
                  </div>
                  <h2 className="text-title3 font-semibold text-ink">
                    {selected.session.label || "Consulting session"}
                  </h2>
                  <p className="text-callout text-ink-2">
                    {occurrenceLabel(selected.session, selected.date)}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-muted">
                    <span className="inline-flex items-center gap-1.5 tabular font-medium">
                      <Clock size={14} />
                      {minutesLabel(selected.startMin)}–{minutesLabel(selected.endMin)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Pin size={14} />
                      {selected.session.room}
                    </span>
                  </div>
                  <p className="text-caption text-ink-2">{describeSession(selected.session)}</p>
                </div>

                {/* Capacity Utilization */}
                <div className="rounded-card border border-hairline bg-surface-2/70 p-4">
                  <div className="flex items-center justify-between text-callout font-medium text-ink">
                    <span className="inline-flex items-center gap-1.5">
                      <Users size={16} className="text-accent" />
                      Capacity utilization
                    </span>
                    <span className="tabular font-semibold">
                      {selected.booked} / {selected.capacity} places
                    </span>
                  </div>
                  <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-fill-strong">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        selected.session.mode === "stream" ? "bg-accent" : "bg-warn"
                      }`}
                      style={{
                        width: `${
                          selected.capacity > 0
                            ? Math.min(100, Math.round((selected.booked / selected.capacity) * 100))
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                  <p className="mt-2 text-caption text-muted tabular">
                    {Math.max(0, selected.capacity - selected.booked)} open{" "}
                    {selected.capacity - selected.booked === 1 ? "place" : "places"} remaining
                  </p>
                </div>

                <div>
                  <ButtonLink
                    href={`/dashboard/sessions/manage?session=${selected.session.id}`}
                    variant="primary"
                    size="md"
                    className="w-full justify-center"
                  >
                    <Edit size={16} />
                    Edit this session in Studio
                  </ButtonLink>
                </div>
              </div>

              {/* Booked Visits: 7 cols on lg, 8 cols on xl */}
              <div className="lg:col-span-7 xl:col-span-8 lg:border-l lg:border-hairline lg:pl-6">
                <div className="flex items-center justify-between border-b border-hairline pb-3">
                  <h3 className="text-callout font-semibold text-ink">
                    Booked visits ({selectedVisits.length})
                  </h3>
                  <span className="text-caption text-muted">
                    {selectedVisits.length === 0
                      ? "No bookings"
                      : `${selectedVisits.length} ${selectedVisits.length === 1 ? "patient" : "patients"}`}
                  </span>
                </div>

                {selectedVisits.length === 0 ? (
                  <div className="mt-4 rounded-card border border-dashed border-hairline bg-surface-2/40 px-4 py-8 text-center text-callout text-muted">
                    No patients are booked in this occurrence yet.
                  </div>
                ) : (
                  <AnimatedList className="mt-4 grid gap-3 sm:grid-cols-2">
                    {selectedVisits.map((entry, index) => {
                      const statusMeta = VISIT_STATUS_STYLE[entry.visit.status];
                      const timeLabel = slotTimeLabel({
                        time: entry.visit.time,
                        endTime: entry.visit.endTime ?? entry.blockEndTime,
                        mode: selected.session.mode,
                      });

                      return (
                        <AnimatedListItem
                          key={entry.visit.id}
                          index={index}
                          className="rounded-card border border-hairline bg-surface-2/75 p-3.5 shadow-sm transition hover:border-hairline-strong hover:bg-surface-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-callout font-semibold text-ink">
                                {entry.visit.patientName}
                              </p>
                              <p className="mt-0.5 text-caption font-medium text-ink-2 tabular">
                                {timeLabel}
                                {selected.session.mode === "wave" && entry.visit.token
                                  ? ` · Token #${entry.visit.token}`
                                  : ""}
                              </p>
                              <p className="mt-0.5 text-caption text-muted truncate">
                                {entry.visit.reason} · {entry.visit.reference}
                              </p>
                              {entry.outsideHours ? (
                                <p className="mt-1 text-[11px] font-medium text-warn">
                                  Booked outside current session hours
                                </p>
                              ) : null}
                            </div>
                            <span
                              className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusMeta.className}`}
                            >
                              {statusMeta.label}
                            </span>
                          </div>
                        </AnimatedListItem>
                      );
                    })}
                  </AnimatedList>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-6 text-center">
              <h2 className="text-title3 font-semibold text-ink">
                No sessions in {weekTitle(monday)}
              </h2>
              <p className="text-callout text-ink-2">
                Switch weeks above or open Session Studio to add consulting hours for this period.
              </p>
              <ButtonLink
                href="/dashboard/sessions/manage"
                variant="primary"
                size="md"
                className="w-full justify-center sm:w-auto"
              >
                <Sliders size={16} />
                Open Session Studio
              </ButtonLink>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
