"use client";

import Link from "next/link";
import { useActionState, useMemo, useRef, useState } from "react";
import { TimeWheelPicker } from "@/components/doctors/TimeWheel";
import { CLINIC_END, CLINIC_START, clinicWeekday, sessionIsPast } from "@/components/doctors/schedule-model";
import { Alert, Calendar, Check, ChevronLeft, ChevronRight, Clock, Edit, Info, Pin, Plus, Sliders, Users } from "@/components/icons";
import { AnimatedList, AnimatedListItem } from "@/components/reactbits/AnimatedList";
import { GlideSelect } from "@/components/reactbits/GlideSelect";
import { RubberSegment } from "@/components/reactbits/RubberSegment";
import { SquishSwitch } from "@/components/reactbits/SquishSwitch";
import { Button, ButtonLink, buttonClass } from "@/components/ui/Button";
import { Card, Notice } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { PendingButton } from "@/components/ui/PendingButton";
import type { AppointmentStatus, ConsultSession, SessionTrim } from "@/lib/clinic-types";
import { addDays, dayOfMonth, mondayOf, weekdayIndex } from "@/lib/clock";
import { isUpcomingVisit, occupiesTime, sessionStructureChanged, stillFits } from "@/lib/elastic-scheduling";
import type { FormState } from "@/lib/form-state";
import { addBlockedReason, defaultsFor, toRecurringDraft, type SessionDefaults } from "@/lib/session-defaults";
import {
  checkSession,
  daysLabel,
  describeSession,
  fromMinutes,
  hoursOnDate,
  isTime,
  MAX_WAVE_CAPACITY,
  minutesOverlap,
  newAbsorptions,
  planAbsorption,
  planStreamShift,
  sessionBlocks,
  sessionRunsOn,
  STREAM_SLOT_MINUTES,
  toMinutes,
  visitWhenLabel,
  WAVE_MINUTES,
  type SessionInput,
} from "@/lib/sessions";
import { archiveSession, saveSession } from "@/server/profile-actions";

export interface StudioVisit {
  id: string;
  sessionId: string | null;
  slotId: string;
  date: string;
  time: string;
  endTime: string | null;
  token: number | null;
  patientName: string;
  status: AppointmentStatus;
}

interface StudioDraft extends SessionDefaults {
  waveMinutes: number | null;
}

function nextClinicDay(today: string): string {
  for (let offset = 0; offset <= 7; offset++) {
    const candidate = addDays(today, offset);
    if (clinicWeekday(candidate) !== null) return candidate;
  }
  return today;
}

function createDraft(
  session: ConsultSession | null,
  room: string,
  today: string,
  initialDate?: string | null,
  nowMinutes?: number,
): StudioDraft {
  const base = defaultsFor(session, room);
  if (!session) {
    const start =
      initialDate && clinicWeekday(initialDate) !== null && initialDate >= today ? initialDate : nextClinicDay(today);
    const wd = clinicWeekday(start);
    // A draft for today starts at the next half hour, not at a time that has already gone.
    if (start === today && typeof nowMinutes === "number" && toMinutes(base.startTime) <= nowMinutes) {
      const begin = Math.ceil((nowMinutes + 1) / 30) * 30;
      const length = toMinutes(base.endTime) - toMinutes(base.startTime);
      const fits = begin + length <= 23 * 60 + 45 ? length : 60;
      if (begin + fits <= 23 * 60 + 45) {
        base.startTime = fromMinutes(begin);
        base.endTime = fromMinutes(begin + fits);
      }
    }
    return {
      ...base,
      kind: "once",
      weekdays: wd ? [wd] : [1, 2, 3, 4, 5],
      startDate: start,
      endDate: addDays(start, 84),
      onDate: start,
      waveMinutes: null,
    };
  }
  return {
    ...base,
    onDate: base.onDate || nextClinicDay(today),
    waveMinutes: session.waveMinutes ?? null,
  };
}

function toSessionInput(draft: StudioDraft): SessionInput {
  const once = draft.kind === "once";
  return {
    label: draft.label,
    kind: draft.kind,
    onDate: once ? draft.onDate || null : null,
    startDate: once ? null : draft.startDate || null,
    endDate: once ? null : draft.endDate || null,
    weekdays: once ? [] : draft.weekdays,
    startTime: draft.startTime,
    endTime: draft.endTime,
    room: draft.room,
    mode: draft.mode,
    slotMinutes: draft.mode === "stream" ? draft.slotMinutes : null,
    waveMinutes: draft.mode === "wave" ? draft.waveMinutes : null,
    waveCapacity: draft.mode === "wave" ? draft.waveCapacity : null,
  };
}

function toProposedSession(
  draft: StudioDraft,
  editing: ConsultSession | null,
  doctorId: string,
  idOverride?: string,
): ConsultSession {
  const once = draft.kind === "once";
  return {
    id: idOverride ?? editing?.id ?? "__draft__",
    doctorId,
    label: draft.label,
    weekdays: once ? [] : [...draft.weekdays].sort((a, b) => a - b),
    startTime: draft.startTime,
    endTime: draft.endTime,
    room: draft.room,
    mode: draft.mode,
    slotMinutes: draft.mode === "stream" ? draft.slotMinutes : null,
    waveMinutes: draft.mode === "wave" ? draft.waveMinutes : null,
    waveCapacity: draft.mode === "wave" ? draft.waveCapacity : null,
    startDate: once ? null : draft.startDate || null,
    endDate: once ? null : draft.endDate || null,
    onDate: once ? draft.onDate || null : null,
    archivedAt: null,
    createdAt: editing?.createdAt ?? "",
    updatedAt: editing?.updatedAt ?? "",
  };
}

function isSameDraft(session: ConsultSession, draft: StudioDraft): boolean {
  const kind = session.onDate ? "once" : "recurring";
  if (session.label !== draft.label) return false;
  if (kind !== draft.kind) return false;
  if (session.startTime !== draft.startTime || session.endTime !== draft.endTime) return false;
  if (session.room !== draft.room || session.mode !== draft.mode) return false;
  if (draft.mode === "stream") {
    if ((session.slotMinutes ?? 20) !== draft.slotMinutes) return false;
  } else if ((session.waveCapacity ?? 6) !== draft.waveCapacity) {
    return false;
  }
  if (draft.kind === "once") return (session.onDate ?? "") === draft.onDate;
  const a = [...session.weekdays].sort((x, y) => x - y).join(",");
  const b = [...draft.weekdays].sort((x, y) => x - y).join(",");
  return a === b && (session.startDate ?? "") === draft.startDate && (session.endDate ?? "") === draft.endDate;
}

function placesCount(session: ConsultSession): number {
  const blocks = sessionBlocks(session);
  const perBlock = session.mode === "wave" ? (session.waveCapacity ?? 1) : 1;
  return blocks.length * perBlock;
}

function gridBounds(anchor: number, end: number, step: number): { min: number; max: number } {
  const floor = Math.min(CLINIC_START, Math.floor(anchor / 60) * 60);
  const ceil = Math.max(CLINIC_END, Math.ceil(end / 60) * 60);
  const rem = (((anchor - floor) % step) + step) % step;
  const min = floor + rem;
  const max = min + Math.floor((ceil - min) / step) * step;
  return { min, max };
}

function formatDuration(minutes: number): string {
  if (minutes <= 0) return "0m";
  if (minutes % 60 === 0) return `${minutes / 60}h`;
  if (minutes > 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return `${minutes}m`;
}

function formatDateHeading(iso: string): string {
  const [, month, day] = iso.split("-").map(Number);
  const dayName = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][weekdayIndex(iso)];
  const monthName = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][(month ?? 1) - 1];
  return `${dayName}, ${day} ${monthName}`;
}

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2–8 Nov", or "30 Nov – 6 Dec" across months: Monday to Sunday, the whole strip. */
export function weekSpanLabel(monday: string): string {
  const sunday = addDays(monday, 6);
  const month = (iso: string) => SHORT_MONTHS[Number(iso.slice(5, 7)) - 1];
  return month(monday) === month(sunday)
    ? `${dayOfMonth(monday)}–${dayOfMonth(sunday)} ${month(sunday)}`
    : `${dayOfMonth(monday)} ${month(monday)} – ${dayOfMonth(sunday)} ${month(sunday)}`;
}

function weekOffsetForDate(target: string, baseToday: string): number {
  try {
    const mTarget = new Date(mondayOf(target) + "T00:00:00Z").getTime();
    const mBase = new Date(mondayOf(baseToday) + "T00:00:00Z").getTime();
    return Math.round((mTarget - mBase) / (7 * 24 * 60 * 60 * 1000));
  } catch {
    return 0;
  }
}

interface MonthWeek {
  monday: string;
  weekIndex: number;
  label: string;
}

function getMonthWeeks(currentMonday: string): { monthTitle: string; weeks: MonthWeek[] } {
  const mondayMonth = currentMonday.slice(0, 7);
  const thursdayMonth = addDays(currentMonday, 3).slice(0, 7);
  const targetPrefix = currentMonday.startsWith(thursdayMonth) ? mondayMonth : thursdayMonth;

  const [yStr, mStr] = targetPrefix.split("-");
  const year = Number(yStr);
  const month = Number(mStr);
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const monthTitle = `${monthNames[month - 1]} ${year}`;

  let scanMonday = mondayOf(`${targetPrefix}-01`);
  if (scanMonday < `${targetPrefix}-01` && !addDays(scanMonday, 3).startsWith(targetPrefix)) {
    scanMonday = addDays(scanMonday, 7);
  }

  const weeks: MonthWeek[] = [];
  let idx = 1;
  while (scanMonday.startsWith(targetPrefix) || addDays(scanMonday, 3).startsWith(targetPrefix)) {
    weeks.push({
      monday: scanMonday,
      weekIndex: idx,
      label: `Week ${idx} (${weekSpanLabel(scanMonday)})`,
    });
    scanMonday = addDays(scanMonday, 7);
    idx++;
  }

  return { monthTitle, weeks };
}

export function SessionStudio({
  doctorId,
  doctorName,
  sessions,
  visits,
  trims,
  today,
  nowMinutes,
  room,
  initialSessionId,
  initialDate = null,
  startInCreateMode,
  profileComplete,
  verificationPending = false,
  notice,
  noticeTone,
  removingSession,
  removingCount,
}: {
  doctorId: string;
  doctorName: string;
  sessions: ConsultSession[];
  visits: StudioVisit[];
  trims: SessionTrim[];
  today: string;
  nowMinutes: number;
  room: string;
  initialSessionId: string | null;
  initialDate?: string | null;
  startInCreateMode: boolean;
  profileComplete: boolean;
  verificationPending?: boolean;
  notice: string | null;
  noticeTone: "info" | "success" | "danger" | "neutral";
  removingSession: ConsultSession | null;
  removingCount: number;
}) {
  const initialSession = useMemo(
    () => (startInCreateMode ? null : sessions.find((s) => s.id === initialSessionId) ?? sessions[0] ?? null),
    [initialSessionId, sessions, startInCreateMode],
  );

  const initialTarget = initialDate || initialSession?.onDate || today;
  const [editingId, setEditingId] = useState<string | null>(() => initialSession?.id ?? null);
  const [isCreateMode, setIsCreateMode] = useState<boolean>(() => startInCreateMode || sessions.length === 0);
  const [draft, setDraft] = useState<StudioDraft>(() =>
    createDraft(initialSession, room, today, initialDate, nowMinutes),
  );
  const [showWheels, setShowWheels] = useState(false);
  const [confirmRetire, setConfirmRetire] = useState(false);
  const [studioWeekOffset, setStudioWeekOffset] = useState<number>(() =>
    weekOffsetForDate(initialTarget, today),
  );
  const [selectedDate, setSelectedDate] = useState<string>(() => initialTarget);
  const [showAllSessions, setShowAllSessions] = useState(false);

  const [savedState, formAction] = useActionState(saveSession, null as FormState);
  // A save result (error, "notify patients" or "move patients" banner) belongs to the session and day
  // it was sent from. Selecting another session, starting a new one or changing the day hides it, so a
  // banner's confirm button can never submit a different session's form.
  const [bannerEpoch, setBannerEpoch] = useState(0);
  const [submittedEpoch, setSubmittedEpoch] = useState<number | null>(null);
  const state = submittedEpoch === bannerEpoch ? savedState : null;
  const clearBanners = () => setBannerEpoch((epoch) => epoch + 1);
  const editorRef = useRef<HTMLDivElement>(null);
  const revealEditor = () => {
    // On a phone the editor sits above the day strip: bring it into view after picking a session.
    if (typeof window === "undefined" || window.matchMedia?.("(min-width: 1024px)").matches) return;
    requestAnimationFrame(() => editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const editing = useMemo(
    () => (isCreateMode ? null : sessions.find((s) => s.id === editingId) ?? null),
    [editingId, isCreateMode, sessions],
  );

  const upcomingCountBySession = useMemo(() => {
    const counts = new Map<string, number>();
    for (const visit of visits) {
      if (!visit.sessionId || visit.date < today || !isUpcomingVisit(visit)) continue;
      counts.set(visit.sessionId, (counts.get(visit.sessionId) ?? 0) + 1);
    }
    return counts;
  }, [visits, today]);

  const showDate = (date: string) => {
    setSelectedDate(date);
    setStudioWeekOffset(weekOffsetForDate(date, today));
  };

  const selectSession = (session: ConsultSession) => {
    setIsCreateMode(false);
    setEditingId(session.id);
    setDraft(createDraft(session, room, today));
    setConfirmRetire(false);
    clearBanners();
    if (session.onDate) showDate(session.onDate);
    revealEditor();
  };

  /** A new draft on `date` when sessions can be added then, else on the next clinic day (shown in the strip). */
  const startCreate = (date: string = selectedDate) => {
    const target = addBlockedReason(date, today) === null ? date : nextClinicDay(date > today ? date : today);
    setIsCreateMode(true);
    setEditingId(null);
    setDraft(createDraft(null, room, today, target, nowMinutes));
    setConfirmRetire(false);
    clearBanners();
    showDate(target);
    setShowAllSessions(false);
  };

  const moveWeek = (delta: number) => {
    const nextOffset = studioWeekOffset + delta;
    const nextMonday = addDays(mondayOf(today), nextOffset * 7);
    setStudioWeekOffset(nextOffset);
    // Keep the same weekday in the new week, so the strip always has a day picked.
    setSelectedDate((prev) => addDays(nextMonday, (weekdayIndex(prev) + 6) % 7));
    setShowAllSessions(false);
    clearBanners();
  };

  const studioMonday = useMemo(
    () => addDays(mondayOf(today), studioWeekOffset * 7),
    [today, studioWeekOffset],
  );

  const { monthTitle, weeks: monthWeeks } = useMemo(
    () => getMonthWeeks(studioMonday),
    [studioMonday],
  );

  const isCurrentWeek = useMemo(
    () => studioMonday === mondayOf(today),
    [studioMonday, today],
  );

  const weekDays = useMemo(() => {
    const liveSessions = sessions.filter((s) => !s.archivedAt);
    const DOW_THREE_LETTERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(studioMonday, i);
      const dayIdx = weekdayIndex(date);
      const dow = DOW_THREE_LETTERS[dayIdx];
      const num = dayOfMonth(date);
      const isToday = date === today;
      const isSelected = !showAllSessions && date === selectedDate;

      const dateSessions = liveSessions.filter((s) => {
        const hours = hoursOnDate(s, date, trims, liveSessions);
        return Boolean(hours);
      });

      return {
        date,
        dow,
        num,
        isToday,
        isSelected,
        sessionCount: dateSessions.length,
      };
    });
  }, [studioMonday, today, selectedDate, showAllSessions, sessions, trims]);

  const selectedDateSessions = useMemo(() => {
    if (!selectedDate) return [];
    const liveSessions = sessions.filter((s) => !s.archivedAt);
    return liveSessions
      .map((session) => {
        const hours = hoursOnDate(session, selectedDate, trims, liveSessions);
        if (!hours) return null;
        return {
          session,
          hours,
          upcoming: upcomingCountBySession.get(session.id) ?? 0,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
      .sort((a, b) => a.hours.startTime.localeCompare(b.hours.startTime));
  }, [selectedDate, sessions, trims, upcomingCountBySession]);

  const draftAppliesToSelectedDate = useMemo(() => {
    if (!selectedDate) return false;
    return sessionRunsOn({ ...toSessionInput(draft), weekdays: [...draft.weekdays] }, selectedDate);
  }, [draft, selectedDate]);

  const resetDraft = () => {
    if (editing) {
      setDraft(createDraft(editing, room, today));
    } else {
      setDraft(createDraft(null, room, today, selectedDate, nowMinutes));
    }
    setConfirmRetire(false);
    clearBanners();
  };

  const isRecurring = draft.kind === "recurring";

  const toggleRecurring = (nextRecurring: boolean) => {
    setDraft((prev) => {
      if (nextRecurring) return toRecurringDraft(prev, nextClinicDay(today), editing);
      return {
        ...prev,
        kind: "once",
        onDate: prev.onDate || prev.startDate || nextClinicDay(today),
      };
    });
  };

  // Only a saved session that has ended is read-only. A new draft on a past date stays editable: the
  // schedule check below asks for today or a later date instead of locking the Date field.
  const past = useMemo(() => (editing ? sessionIsPast(editing, today) : false), [editing, today]);

  const dirty = useMemo(() => (!editing ? true : !isSameDraft(editing, draft)), [editing, draft]);

  const others = useMemo(
    () => sessions.filter((s) => s.id !== editing?.id && !s.archivedAt),
    [sessions, editing?.id],
  );

  const keepOpenRange = Boolean(editing && !editing.onDate && !editing.startDate && !editing.endDate);
  const input = useMemo(() => toSessionInput(draft), [draft]);
  const startMoved = !editing || editing.startTime !== draft.startTime || (editing.onDate ?? "") !== (draft.kind === "once" ? draft.onDate : "");
  const checked = useMemo(
    () => checkSession(input, others, today, { keepOpenRange, nowMinutes: startMoved ? nowMinutes : undefined }),
    [input, others, today, keepOpenRange, startMoved, nowMinutes],
  );

  const proposed = useMemo(
    () => toProposedSession(draft, editing, doctorId, editing?.id ?? "__draft__"),
    [draft, editing, doctorId],
  );

  const affected = useMemo(() => {
    const ownAffected = editing
      ? visits.filter((visit) => {
          const structural = sessionStructureChanged(editing, proposed);
          return (
            visit.sessionId === editing.id &&
            visit.date >= today &&
            (visit.status === "booked" || (structural && visit.status === "pending_payment")) &&
            !stillFits(visit, proposed)
          );
        })
      : [];

    const tentativeOccupying = visits
      .filter(
        (visit) =>
          occupiesTime(visit) &&
          visit.date >= today &&
          (!editing || visit.sessionId !== editing.id || stillFits(visit, proposed)),
      )
      .map((visit) => ({ date: visit.date, time: visit.time, endTime: visit.endTime, sessionId: visit.sessionId }));
    const tentativePlan = checked.ok ? planAbsorption(proposed, others, tentativeOccupying, today, trims) : null;
    const potentialTrims = tentativePlan && tentativePlan.ok ? tentativePlan.trims : [];

    const trimAffected: typeof visits = [];
    if (potentialTrims.length > 0) {
      for (const visit of visits) {
        if (!occupiesTime(visit) || visit.date < today || (editing && visit.sessionId === editing.id)) continue;
        if (!isTime(visit.time)) continue;
        const vStart = toMinutes(visit.time);
        const vEnd = visit.endTime && isTime(visit.endTime) ? toMinutes(visit.endTime) : vStart + 15;
        const hit = potentialTrims.some(
          (t) =>
            t.sessionId === visit.sessionId &&
            t.date === visit.date &&
            minutesOverlap(toMinutes(t.startTime), toMinutes(t.endTime), vStart, vEnd),
        );
        if (hit && !ownAffected.some((v) => v.id === visit.id)) {
          trimAffected.push(visit);
        }
      }
    }

    return [...ownAffected, ...trimAffected].sort((a, b) =>
      a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date),
    );
  }, [editing, proposed, visits, today, checked.ok, others, trims]);

  const occupyingVisits = useMemo(() => {
    const leaving = new Set(affected.map((visit) => visit.id));
    return visits
      .filter((visit) => occupiesTime(visit) && visit.date >= today && !leaving.has(visit.id))
      .map((visit) => ({
        date: visit.date,
        time: visit.time,
        endTime: visit.endTime,
        sessionId: visit.sessionId,
      }));
  }, [affected, visits, today]);

  const plan = useMemo(
    () => (checked.ok ? planAbsorption(proposed, others, occupyingVisits, today, trims) : null),
    [checked.ok, proposed, others, occupyingVisits, today, trims],
  );

  const shift = useMemo(() => {
    if (!checked.ok || !plan || plan.ok || affected.length > 0) return null;
    return planStreamShift(
      proposed,
      others,
      visits
        .filter((visit) => visit.date >= today && occupiesTime(visit))
        .map((visit) => ({
          id: visit.id,
          status: visit.status,
          date: visit.date,
          time: visit.time,
          endTime: visit.endTime,
          sessionId: visit.sessionId,
        })),
      today,
      trims,
      (visit) => visit.status === "booked" && (visit.date > today || toMinutes(visit.time) > nowMinutes),
    );
  }, [checked.ok, plan, affected.length, proposed, others, visits, today, trims, nowMinutes]);

  const shiftMoves = useMemo(() => (shift && shift.ok ? shift.moves : []), [shift]);
  // Hours this save would newly take from other sessions: shown as a warning that must be ticked.
  const absorbKey = useMemo(() => {
    if (!plan || !plan.ok || shiftMoves.length > 0) return "";
    return newAbsorptions(plan.trims, trims, proposed.id)
      .map((trim) => `${trim.sessionId}|${trim.startTime}|${trim.endTime}`)
      .sort()
      .join(",");
  }, [plan, shiftMoves.length, trims, proposed.id]);
  const [absorbConfirmedKey, setAbsorbConfirmedKey] = useState("");
  const absorbing = absorbKey !== "";
  const absorbConfirmed = absorbing && absorbConfirmedKey === absorbKey;
  const blocked = past || !checked.ok || Boolean(plan && !plan.ok && shiftMoves.length === 0);

  const showDisplaceBanner = Boolean(state?.displace) || (!blocked && dirty && affected.length > 0);
  const displaceCount = state?.displace?.count ?? affected.length;
  const displaceTimes =
    state?.displace?.times ?? affected.map(visitWhenLabel);

  const showShiftBanner = Boolean(state?.shift) || (!blocked && dirty && shiftMoves.length > 0);
  const shiftCount = state?.shift?.count ?? shiftMoves.length;
  const shiftPreviewLines = useMemo(() => {
    if (state?.shift?.lines) return state.shift.lines;
    const names = new Map(visits.map((v) => [v.id, v.patientName]));
    return shiftMoves.map((m) => `${names.get(m.visitId) ?? "Patient"} ${m.fromTime} → ${m.toTime}`);
  }, [state?.shift?.lines, visits, shiftMoves]);

  const canSimpleSave =
    !past && dirty && !blocked && !showDisplaceBanner && !showShiftBanner && (!absorbing || absorbConfirmed);

  const startMin = toMinutes(draft.startTime);
  const endMin = toMinutes(draft.endTime);
  const step = useMemo(() => {
    if (draft.mode === "stream") return draft.slotMinutes;
    const baseStep = draft.waveMinutes ?? 15;
    return (endMin - startMin) % baseStep === 0 ? baseStep : 5;
  }, [draft.mode, draft.slotMinutes, draft.waveMinutes, startMin, endMin]);

  const grid = useMemo(() => gridBounds(startMin, endMin, step), [startMin, endMin, step]);
  const durationMinutes = Math.max(0, endMin - startMin);
  const oldPlaces = editing ? placesCount(editing) : 0;
  const newPlaces = checked.ok ? placesCount(proposed) : 0;
  const placesDelta = editing ? newPlaces - oldPlaces : newPlaces;
  const editingUpcoming = editing ? upcomingCountBySession.get(editing.id) ?? 0 : 0;



  const changeSlotMinutes = (nextMinutes: number) => {
    const units = Math.max(1, Math.round((endMin - startMin) / nextMinutes));
    const nextEnd = Math.min(23 * 60 + 45, Math.max(startMin + nextMinutes, startMin + units * nextMinutes));
    setDraft((prev) => ({
      ...prev,
      slotMinutes: nextMinutes,
      endTime: fromMinutes(nextEnd),
    }));
  };

  const slotOptions = useMemo(() => {
    const base = new Set<number>(STREAM_SLOT_MINUTES);
    if (draft.slotMinutes) base.add(draft.slotMinutes);
    return [...base]
      .sort((a, b) => a - b)
      .map((minutes) => ({
        value: String(minutes),
        label: `${minutes} min slots`,
        tag: minutes === 20 ? "Default" : undefined,
      }));
  }, [draft.slotMinutes]);

  const legacyWaveChoices = useMemo(() => {
    if (draft.mode !== "wave" || !editing?.waveMinutes) return null;
    const set = new Set<number>(WAVE_MINUTES);
    set.add(editing.waveMinutes);
    return [...set].sort((a, b) => a - b);
  }, [draft.mode, editing]);

  const sessionHeading = editing
    ? editing.label || (editing.mode === "wave" ? "Wave session" : "Stream session")
    : draft.label.trim() || "New session";

  return (
    <div className="mx-auto max-w-[92rem] px-4 pt-6 pb-16 md:px-6 xl:px-8">
      {/* 1. Outer Studio Header ("Add / Edit panel") */}
      <section
        aria-label="Add or edit sessions"
        className="rounded-sheet border border-hairline bg-surface p-5 shadow-card md:p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-caption text-muted">
              <Sliders size={14} className="text-accent" />
              <span>{doctorName}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular">
                {sessions.length} active {sessions.length === 1 ? "session" : "sessions"}
              </span>
            </div>
            <h1 className="mt-1.5 text-title2 font-semibold tracking-tight text-ink md:text-title1">
              Add / Edit panel
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant={isCreateMode ? "primary" : "secondary"}
              size="md"
              onClick={() => startCreate()}
            >
              <Plus size={16} />
              New session
            </Button>
            <ButtonLink href="/dashboard/sessions" variant="secondary" size="md">
              <Calendar size={16} />
              View schedule
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* Profile incomplete notice */}
      {!profileComplete ? (
        <Notice tone="info" className="mt-4">
          Patients can’t see you yet.{" "}
          <Link href="/dashboard/profile" className="font-semibold text-accent underline underline-offset-4">
            Finish your profile
          </Link>{" "}
          as well as adding a session.
        </Notice>
      ) : null}

      {verificationPending ? (
        <Notice tone="info" className="mt-4">
          Your account is waiting for the practice to verify it. You can set up your profile and sessions now. Patients can find and book you once an admin verifies you.
        </Notice>
      ) : null}

      {/* Feedback notice from server action redirects. A result notice belongs to the save that made it,
          so it goes once the doctor moves to another session or day. */}
      {notice && (noticeTone === "info" || bannerEpoch === 0) ? (
        noticeTone === "danger" ? (
          <Notice tone="danger" role="alert" className="mt-4">
            {notice}
          </Notice>
        ) : (
          <output className="mt-4 block">
            <Notice tone={noticeTone}>{notice}</Notice>
          </output>
        )
      ) : null}

      {/* Displaced patient removal confirmation flow */}
      {removingSession && removingCount > 0 ? (
        <section
          aria-labelledby="remove-displace"
          role="alert"
          className="mt-4 rounded-card border border-danger/30 bg-danger-soft px-5 py-4 text-callout text-ink"
        >
          <h2 id="remove-displace" className="text-body font-semibold text-ink">
            {removingCount === 1 ? "1 patient is" : `${removingCount} patients are`} booked in{" "}
            {removingSession.label || "that session"}
          </h2>
          <p className="mt-1 text-ink-2">
            Move or cancel {removingCount === 1 ? "that visit" : "those visits"} from your clinic book first, or remove
            the session and notify {removingCount === 1 ? "the patient" : "them"}: each is offered the nearest free
            times with you (held for 24 hours) and can pick one or cancel for a full refund.
          </p>
          <form action={archiveSession} className="group mt-3 grid gap-3">
            <input type="hidden" name="returnTo" value="/dashboard/sessions/manage" />
            <input type="hidden" name="id" value={removingSession.id} />
            <input type="hidden" name="displace" value="confirm" />
            <input type="hidden" name="displaceCount" value={removingCount} />
            <label htmlFor="remove-displace-reason" className="font-semibold text-ink">
              Message for the patients <span className="font-normal text-ink-2">(optional)</span>
            </label>
            <input id="remove-displace-reason" name="displaceReason" maxLength={200} className="field" />
            <div className="flex flex-wrap items-center gap-3">
              <PendingButton
                pendingLabel="Notifying…"
                className={buttonClass("primary", "md", "group-has-[[aria-busy=true]]:pointer-events-none")}
              >
                Notify them and offer new times
              </PendingButton>
              <ButtonLink href="/dashboard/sessions/manage" variant="plain" size="md">
                Keep the session
              </ButtonLink>
            </div>
          </form>
        </section>
      ) : null}

      {/* 2. Sketch 2 Two-Column Body: Left = "X session" form, Right = "Calendar Preview" */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:items-start">
        {/* LEFT PANEL — "X session" form */}
        <div ref={editorRef} className="min-w-0 scroll-mt-[calc(var(--header-h)+1rem)]">
        <Card className="min-w-0 rounded-sheet p-5 md:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline pb-4">
            <div className="min-w-0 max-w-full flex-1">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface-2 px-2.5 py-0.5 text-caption font-medium text-ink-2">
                {editing ? <Edit size={12} /> : <Plus size={12} />}
                {editing ? "Editing session" : "Creating session"}
              </span>
              <h2 className="mt-2 truncate text-title2 font-semibold text-ink" title={sessionHeading}>
                {sessionHeading}
              </h2>
            </div>

            <RubberSegment
              aria-label="Booking mode"
              items={[
                { value: "stream", label: "Stream" },
                { value: "wave", label: "Wave" },
              ]}
              value={draft.mode}
              onChange={(value) => setDraft((prev) => ({ ...prev, mode: value as "stream" | "wave" }))}
              size="sm"
              radius={10}
              trackColor="var(--v-fill)"
              thumbColor="var(--v-surface)"
              textColor="var(--v-ink-2)"
              activeTextColor="var(--v-ink)"
              disabled={past}
            />
          </div>

          {past ? (
            <Notice tone="neutral" className="mt-4">
              This session has already ended. Past sessions are read-only; start a new session to open future dates.
            </Notice>
          ) : null}

          {state && !state.ok && !state.displace && !state.shift ? (
            <Notice tone="danger" role="alert" className="mt-4">
              {state.message}
            </Notice>
          ) : null}

          <form action={formAction} onSubmit={() => setSubmittedEpoch(bannerEpoch)} className="mt-5 space-y-5">
            <input type="hidden" name="returnTo" value="/dashboard/sessions/manage" />
            <input type="hidden" name="viewDate" value={selectedDate} />
            <input type="hidden" name="id" value={editing?.id ?? ""} />
            <input type="hidden" name="kind" value={draft.kind} />
            <input type="hidden" name="mode" value={draft.mode} />
            <input type="hidden" name="startTime" value={draft.startTime} />
            <input type="hidden" name="endTime" value={draft.endTime} />
            {draft.kind === "once" ? (
              <input type="hidden" name="onDate" value={draft.onDate} />
            ) : (
              <>
                <input type="hidden" name="startDate" value={draft.startDate} />
                <input type="hidden" name="endDate" value={draft.endDate} />
                {draft.weekdays.map((day) => (
                  <input key={day} type="hidden" name="weekdays" value={day} />
                ))}
              </>
            )}
            {draft.mode === "stream" ? (
              <input type="hidden" name="slotMinutes" value={draft.slotMinutes} />
            ) : (
              <>
                <input type="hidden" name="waveCapacity" value={draft.waveCapacity} />
                {draft.waveMinutes ? <input type="hidden" name="waveMinutes" value={draft.waveMinutes} /> : null}
              </>
            )}

            <fieldset disabled={past} className="space-y-5 disabled:opacity-65">
              {/* Name & Room */}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="studio-label" label="Session name" optional>
                  {({ id }) => (
                    <input
                      id={id}
                      name="label"
                      value={draft.label}
                      maxLength={60}
                      placeholder="e.g. Morning clinic"
                      onChange={(e) => setDraft((prev) => ({ ...prev, label: e.target.value }))}
                      className="field"
                    />
                  )}
                </Field>
                <Field id="studio-room" label="Room or clinic">
                  {({ id }) => (
                    <input
                      id={id}
                      name="room"
                      value={draft.room}
                      maxLength={60}
                      required
                      placeholder="Room 6"
                      onChange={(e) => setDraft((prev) => ({ ...prev, room: e.target.value }))}
                      className="field"
                    />
                  )}
                </Field>
              </div>

              {/* TIME ROW: Time : [ Start ] [ End ] */}
              <div className="rounded-card border border-hairline bg-surface-2/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 text-callout font-semibold text-ink">
                    <Clock size={16} className="text-accent" />
                    Time
                    <span className="text-caption font-normal text-muted tabular">
                      ({formatDuration(durationMinutes)} · {newPlaces} {draft.mode === "stream" ? "slots" : "places"})
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowWheels((v) => !v)}
                    className="text-caption font-medium text-accent hover:underline underline-offset-4"
                  >
                    {showWheels ? "Hide time wheels" : "Use time wheels"}
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field id="studio-start-time" label="Starts">
                    {({ id }) => (
                      <input
                        id={id}
                        type="time"
                        step={300}
                        value={draft.startTime}
                        onChange={(e) => setDraft((prev) => ({ ...prev, startTime: e.target.value }))}
                        className="field tabular"
                      />
                    )}
                  </Field>
                  <Field id="studio-end-time" label="Ends">
                    {({ id }) => (
                      <input
                        id={id}
                        type="time"
                        step={300}
                        value={draft.endTime}
                        onChange={(e) => setDraft((prev) => ({ ...prev, endTime: e.target.value }))}
                        className="field tabular"
                      />
                    )}
                  </Field>
                </div>

                {showWheels ? (
                  <div className="mt-4 grid grid-cols-1 gap-4 border-t border-hairline pt-4 sm:grid-cols-2">
                    <TimeWheelPicker
                      label="Start time wheel"
                      ariaLabel="Start time wheel"
                      valueText={draft.startTime}
                      value={startMin}
                      min={grid.min}
                      max={Math.max(grid.min, endMin - step)}
                      step={step}
                      disabled={past}
                      note={`${step}m grid`}
                      palette={{
                        bg: draft.mode === "wave" ? "var(--v-warn-soft)" : "var(--v-accent-soft)",
                        bd: draft.mode === "wave" ? "var(--v-warn)" : "var(--v-accent)",
                        fg: "var(--v-ink)",
                        dot: draft.mode === "wave" ? "var(--v-warn)" : "var(--v-accent)",
                      }}
                      onChange={(next) =>
                        setDraft((prev) => ({ ...prev, startTime: fromMinutes(next) }))
                      }
                    />
                    <TimeWheelPicker
                      label="End time wheel"
                      ariaLabel="End time wheel"
                      valueText={draft.endTime}
                      value={endMin}
                      min={Math.min(grid.max, startMin + step)}
                      max={grid.max}
                      step={step}
                      disabled={past}
                      note={`${step}m grid`}
                      palette={{
                        bg: draft.mode === "wave" ? "var(--v-warn-soft)" : "var(--v-accent-soft)",
                        bd: draft.mode === "wave" ? "var(--v-warn)" : "var(--v-accent)",
                        fg: "var(--v-ink)",
                        dot: draft.mode === "wave" ? "var(--v-warn)" : "var(--v-accent)",
                      }}
                      onChange={(next) =>
                        setDraft((prev) => ({ ...prev, endTime: fromMinutes(next) }))
                      }
                    />
                  </div>
                ) : null}
              </div>

              {/* RECURRING CHECKBOX + DATE ROW (2nd date box appears when Recurring is clicked!) */}
              <div className="rounded-card border border-hairline bg-surface-2/60 p-4 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <label
                      htmlFor="studio-recurring"
                      className="cursor-pointer text-callout font-semibold text-ink"
                    >
                      Recurring
                    </label>
                    <p className="text-caption text-muted">
                      {isRecurring
                        ? "Repeats weekly between From and Until dates."
                        : "Runs once on a single date."}
                    </p>
                  </div>
                  <SquishSwitch
                    id="studio-recurring"
                    checked={isRecurring}
                    onChange={toggleRecurring}
                    ariaLabel="Recurring"
                    width={52}
                    height={28}
                    radius={14}
                    disabled={past}
                  />
                </div>

                {!isRecurring ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field id="studio-on-date" label="Date">
                      {({ id }) => (
                        <input
                          id={id}
                          type="date"
                          value={draft.onDate}
                          onChange={(e) => setDraft((prev) => ({ ...prev, onDate: e.target.value }))}
                          className="field tabular"
                        />
                      )}
                    </Field>
                  </div>
                ) : (
                  <div className="space-y-4 border-t border-hairline pt-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Field id="studio-from-date" label="From date">
                        {({ id }) => (
                          <input
                            id={id}
                            type="date"
                            value={draft.startDate}
                            onChange={(e) => {
                              const nextStart = e.target.value;
                              const wd = clinicWeekday(nextStart);
                              setDraft((prev) => ({
                                ...prev,
                                startDate: nextStart,
                                ...(wd ? { weekdays: [wd] } : {}),
                              }));
                            }}
                            className="field tabular"
                          />
                        )}
                      </Field>
                      <Field id="studio-until-date" label="Until date">
                        {({ id }) => (
                          <input
                            id={id}
                            type="date"
                            value={draft.endDate}
                            onChange={(e) => setDraft((prev) => ({ ...prev, endDate: e.target.value }))}
                            className="field tabular"
                          />
                        )}
                      </Field>
                    </div>
                  </div>
                )}
              </div>

              {/* Slot length or Wave capacity */}
              <div className="grid gap-4 sm:grid-cols-2">
                {draft.mode === "stream" ? (
                  <div>
                    <span className="mb-1.5 block text-callout font-semibold text-ink">
                      Patient slot length
                    </span>
                    <GlideSelect
                      options={slotOptions}
                      value={String(draft.slotMinutes)}
                      onChange={(val) => changeSlotMinutes(Number(val))}
                      ariaLabel="Patient slot length"
                    />
                  </div>
                ) : (
                  <Field
                    id="studio-wave-cap"
                    label="Max patients per wave"
                    hint={`1 to ${MAX_WAVE_CAPACITY} patients seen in token order.`}
                  >
                    {({ id, describedBy }) => (
                      <input
                        id={id}
                        type="number"
                        min={1}
                        max={MAX_WAVE_CAPACITY}
                        inputMode="numeric"
                        aria-describedby={describedBy}
                        value={draft.waveCapacity}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            waveCapacity: Math.max(1, Math.min(MAX_WAVE_CAPACITY, Number(e.target.value) || 1)),
                          }))
                        }
                        className="field tabular"
                      />
                    )}
                  </Field>
                )}

                {legacyWaveChoices ? (
                  <div className="flex items-end">
                    <p className="text-caption text-muted">
                      Retaining wave interval of {draft.waveMinutes} min for existing bookings.
                    </p>
                  </div>
                ) : null}
              </div>

              {/* AFFECTED BOX ("If anything is affected show here") */}
              <div
                aria-live="polite"
                className={`rounded-card border p-4 ${
                  !checked.ok || (plan && !plan.ok && shiftMoves.length === 0)
                    ? "border-danger/35 bg-danger-soft/60"
                    : showDisplaceBanner || showShiftBanner || absorbing
                      ? "border-warn/40 bg-warn-soft/60"
                      : "border-hairline bg-surface-2/70"
                }`}
              >
                <div className="flex items-center gap-2 text-callout font-semibold text-ink">
                  {!checked.ok || (plan && !plan.ok && shiftMoves.length === 0) ? (
                    <Alert size={16} className="text-danger" />
                  ) : showDisplaceBanner || showShiftBanner || absorbing ? (
                    <Alert size={16} className="text-warn" />
                  ) : (
                    <Info size={16} className="text-accent" />
                  )}
                  <span>Affected bookings &amp; schedule check</span>
                </div>

                {!checked.ok ? (
                  <p className="mt-1.5 text-callout text-danger">{checked.message}</p>
                ) : plan && !plan.ok && shiftMoves.length === 0 ? (
                  <p className="mt-1.5 text-callout text-danger">{plan.message}</p>
                ) : showDisplaceBanner ? (
                  <div className="mt-2 space-y-3">
                    <p className="text-callout text-ink-2">
                      {displaceCount} booked {displaceCount === 1 ? "visit falls" : "visits fall"} outside these
                      updated settings ({displaceTimes.slice(0, 3).join(", ")}
                      {displaceCount > 3 ? ` +${displaceCount - 3} more` : ""}).
                    </p>
                    <input type="hidden" name="displace" value="confirm" />
                    <input type="hidden" name="displaceCount" value={displaceCount} />
                    <Field id="studio-displace-reason" label="Message for affected patients" optional>
                      {({ id }) => (
                        <input
                          id={id}
                          name="displaceReason"
                          maxLength={200}
                          placeholder="e.g. Clinic hours adjusted for the morning."
                          className="field"
                        />
                      )}
                    </Field>
                    <PendingButton
                      pendingLabel="Notifying & saving…"
                      className={buttonClass("primary", "md")}
                    >
                      Notify them and offer new times
                    </PendingButton>
                  </div>
                ) : showShiftBanner ? (
                  <div className="mt-2 space-y-3">
                    <p className="text-callout text-ink-2">
                      Growing into an adjacent stream moves {shiftCount}{" "}
                      {shiftCount === 1 ? "patient" : "patients"} to later free slots:{" "}
                      {shiftPreviewLines.slice(0, 3).join("; ")}.
                    </p>
                    <input type="hidden" name="shift" value="confirm" />
                    <input type="hidden" name="shiftCount" value={shiftCount} />
                    <PendingButton
                      pendingLabel="Moving & saving…"
                      className={buttonClass("primary", "md")}
                    >
                      Confirm move and save
                    </PendingButton>
                  </div>
                ) : absorbing && plan?.ok ? (
                  <div className="mt-2 space-y-2.5">
                    <p className="text-callout font-semibold text-warn">This change takes hours from another session.</p>
                    <p className="text-callout text-ink-2">{plan.notice}</p>
                    <label className="flex cursor-pointer items-start gap-2.5 text-callout font-medium text-ink">
                      <input
                        type="checkbox"
                        name="absorb"
                        value="confirm"
                        checked={absorbConfirmed}
                        onChange={(e) => setAbsorbConfirmedKey(e.target.checked ? absorbKey : "")}
                        className="mt-0.5 size-4 shrink-0 accent-[var(--v-accent)]"
                      />
                      <span>Yes, take these hours from the other session.</span>
                    </label>
                  </div>
                ) : (
                  <p className="mt-1.5 text-callout text-ink-2">
                    {plan?.ok && plan.notice
                      ? plan.notice
                      : "No existing bookings are affected by this configuration."}
                  </p>
                )}
              </div>

              {/* CANCEL & SUBMIT ROW */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-4">
                <div className="flex flex-wrap items-center gap-2.5">
                  {editing ? (
                    <Button variant="secondary" size="md" onClick={resetDraft} disabled={past || !dirty}>
                      Cancel
                    </Button>
                  ) : (
                    <ButtonLink href="/dashboard/sessions" variant="secondary" size="md">
                      Cancel
                    </ButtonLink>
                  )}

                  {!showDisplaceBanner && !showShiftBanner ? (
                    <PendingButton
                      pendingLabel={editing ? "Saving…" : "Creating…"}
                      disabled={!canSimpleSave}
                      className={buttonClass("primary", "md")}
                    >
                      {editing ? "Submit changes" : "Submit"}
                    </PendingButton>
                  ) : null}
                </div>

                {editing ? (
                  <span className="text-caption text-muted tabular">
                    {placesDelta === 0
                      ? `${newPlaces} places/block`
                      : `${placesDelta > 0 ? "+" : ""}${placesDelta} places vs current`}
                  </span>
                ) : null}
              </div>
            </fieldset>
          </form>

          {/* Retire session bar */}
          {editing ? (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-card border border-hairline bg-surface-2/60 px-4 py-3.5">
              <div className="min-w-0">
                <p className="text-callout font-semibold text-ink">Remove this session</p>
                <p className="text-caption text-muted">
                  {editingUpcoming > 0
                    ? `${editingUpcoming} upcoming ${editingUpcoming === 1 ? "visit" : "visits"} booked.`
                    : "Removes future booking availability while keeping past records."}
                </p>
              </div>
              <form action={archiveSession} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="returnTo" value="/dashboard/sessions/manage" />
                <input type="hidden" name="viewDate" value={selectedDate} />
                <input type="hidden" name="id" value={editing.id} />
                {!confirmRetire ? (
                  <Button
                    variant="secondary"
                    size="md"
                    disabled={past}
                    onClick={() => setConfirmRetire(true)}
                    className="border-danger/40 bg-danger-soft text-danger hover:bg-danger/15"
                  >
                    Remove session
                  </Button>
                ) : (
                  <>
                    <PendingButton
                      pendingLabel="Removing…"
                      disabled={past}
                      className={buttonClass(
                        "secondary",
                        "md",
                        "border-danger/45 bg-danger-soft text-danger hover:bg-danger/15",
                      )}
                    >
                      {editingUpcoming > 0 ? "Continue removal…" : "Confirm remove"}
                    </PendingButton>
                    <Button variant="plain" size="md" onClick={() => setConfirmRetire(false)}>
                      Keep
                    </Button>
                  </>
                )}
              </form>
            </div>
          ) : null}
        </Card>
        </div>

        {/* RIGHT PANEL — Week Day Strip & Sessions on Date */}
        <aside aria-label="Schedule calendar and sessions" className="min-w-0 space-y-4">
          <Card className="min-w-0 overflow-hidden rounded-sheet p-5">
            {/* Week navigation row with month title & week dots */}
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-2 border-b border-hairline pb-3">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="whitespace-nowrap text-callout font-bold text-ink">
                  {monthTitle}
                </span>
                {isCurrentWeek ? (
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent shrink-0">
                    This week
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setStudioWeekOffset(0);
                      setSelectedDate(today);
                      setShowAllSessions(false);
                      clearBanners();
                    }}
                    className="rounded-full border border-hairline bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-ink-2 hover:bg-surface hover:text-ink transition-colors shrink-0"
                  >
                    Jump to today
                  </button>
                )}
              </div>

              {/* Right: <  ● ● ● ● ●  > */}
              <div className="ml-auto flex shrink-0 items-center gap-1.5">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => moveWeek(-1)}
                  aria-label="Previous week"
                  className="!min-h-8 !px-2 rounded-full"
                >
                  <ChevronLeft size={14} />
                </Button>

                {/* Week dots: dots representing weeks of the month */}
                <div
                  className="flex items-center gap-1.5 px-1 py-1"
                  role="tablist"
                  aria-label="Weeks of the month"
                >
                  {monthWeeks.map((w) => {
                    const active = w.monday === studioMonday;
                    return (
                      <button
                        key={w.monday}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        aria-label={w.label}
                        title={w.label}
                        onClick={() => {
                          setStudioWeekOffset(weekOffsetForDate(w.monday, today));
                          setSelectedDate((prevDate) => {
                            const m = mondayOf(prevDate);
                            return m === w.monday ? prevDate : w.monday;
                          });
                          setShowAllSessions(false);
                          clearBanners();
                        }}
                        className="group relative flex items-center justify-center p-0.5 transition-all focus:outline-none"
                      >
                        <span
                          className={`block rounded-full transition-all duration-200 ${
                            active
                              ? "h-2.5 w-6 bg-accent shadow-sm"
                              : "size-2.5 bg-control/55 hover:bg-muted group-hover:scale-125"
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => moveWeek(1)}
                  aria-label="Next week"
                  className="!min-h-8 !px-2 rounded-full"
                >
                  <ChevronRight size={14} />
                </Button>
              </div>
            </div>

            {/* Three-letter weekday buttons with date number below */}
            <div className="mt-3 grid grid-cols-7 gap-1.5" role="tablist" aria-label="Week days">
              {weekDays.map((day) => {
                return (
                  <button
                    key={day.date}
                    type="button"
                    role="tab"
                    aria-selected={day.isSelected}
                    aria-label={`${day.dow} ${day.num}, ${day.sessionCount} ${day.sessionCount === 1 ? "session" : "sessions"}`}
                    onClick={() => {
                      if (day.date !== selectedDate) clearBanners();
                      setSelectedDate(day.date);
                      setShowAllSessions(false);
                    }}
                    className={`group relative flex flex-col items-center justify-center rounded-xl p-2 text-center transition-all ${
                      day.isSelected
                        ? "border border-accent bg-accent text-accent-ink shadow-sm"
                        : day.isToday
                          ? "border border-accent/40 bg-accent-soft/30 text-ink hover:bg-accent-soft/50"
                          : "border border-hairline bg-surface hover:border-control hover:bg-fill text-ink"
                    }`}
                  >
                    <span
                      className={`text-[11px] font-semibold tracking-wider uppercase ${
                        day.isSelected ? "text-accent-ink" : "text-muted group-hover:text-ink"
                      }`}
                    >
                      {day.dow}
                    </span>
                    <span
                      className={`mt-0.5 text-callout font-bold tabular ${
                        day.isSelected ? "text-accent-ink" : "text-ink"
                      }`}
                    >
                      {day.num}
                    </span>
                    <span
                      aria-hidden="true"
                      className={`mt-1 size-1.5 rounded-full transition-colors ${
                        day.sessionCount > 0
                          ? day.isSelected
                            ? "bg-accent-ink"
                            : "bg-accent"
                          : "bg-transparent"
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            {/* Section heading: Sessions on selected date (or All sessions) */}
            <div className="mt-5 flex items-center justify-between gap-2 border-t border-hairline pt-4">
              <div className="min-w-0">
                <h3 className="text-callout font-bold text-ink truncate">
                  {showAllSessions
                    ? "All sessions"
                    : `Sessions on ${formatDateHeading(selectedDate)}`}
                </h3>
                <p className="text-caption text-muted">
                  {showAllSessions
                    ? `${sessions.length} total active ${sessions.length === 1 ? "session" : "sessions"}`
                    : `${selectedDateSessions.length} ${
                        selectedDateSessions.length === 1 ? "session" : "sessions"
                      } scheduled`}
                </p>
              </div>

              {sessions.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setShowAllSessions((prev) => !prev)}
                  className="shrink-0 text-caption font-semibold text-accent hover:underline"
                >
                  {showAllSessions ? "Filter by date" : `View all (${sessions.length})`}
                </button>
              ) : null}
            </div>

            {/* Sessions list */}
            <div className="mt-3">
              {showAllSessions ? (
                // Full directory of sessions
                sessions.length === 0 ? (
                  <p className="py-4 text-center text-caption text-muted">
                    No saved sessions yet.
                  </p>
                ) : (
                  <AnimatedList className="gap-2 w-full min-w-0 max-w-full p-0 m-0 list-none">
                    {sessions.map((session, index) => {
                      const selected = !isCreateMode && editing?.id === session.id;
                      const upcoming = upcomingCountBySession.get(session.id) ?? 0;
                      return (
                        <AnimatedListItem
                          key={session.id}
                          index={index}
                          selected={selected}
                          className="min-w-0 w-full max-w-full p-0 m-0 list-none"
                        >
                          <button
                            type="button"
                            onClick={() => selectSession(session)}
                            aria-pressed={selected}
                            className={`group block w-full min-w-0 max-w-full overflow-hidden rounded-xl border p-3 text-left transition-colors box-border ${
                              selected
                                ? "border-accent bg-accent-soft/75 dark:bg-accent/20"
                                : "border-hairline bg-surface hover:border-control hover:bg-fill"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 min-w-0 w-full">
                              <span className="truncate min-w-0 flex-1 text-callout font-semibold text-ink">
                                {session.label ||
                                  (session.mode === "wave" ? "Wave session" : "Stream session")}
                              </span>
                              <span className="shrink-0 text-[11px] font-medium text-muted tabular">
                                {session.startTime}–{session.endTime}
                              </span>
                            </div>
                            <p className="mt-1 line-clamp-2 text-caption text-ink-2 break-words">
                              {describeSession(session)}
                            </p>
                            <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-muted tabular">
                              <Users size={12} className="shrink-0" />
                              <span>{upcoming} upcoming</span>
                            </p>
                          </button>
                        </AnimatedListItem>
                      );
                    })}
                  </AnimatedList>
                )
              ) : (
                // Filtered to selectedDate
                <div className="space-y-2.5">
                  {/* If user is creating a session for this date, show unsaved draft badge */}
                  {isCreateMode && draftAppliesToSelectedDate ? (
                    <div className="rounded-xl border border-dashed border-accent bg-accent-soft/20 p-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-callout font-semibold text-ink truncate">
                          {draft.label || (draft.mode === "wave" ? "New wave session" : "New stream session")}
                        </span>
                        <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-accent-ink">
                          Draft in progress
                        </span>
                      </div>
                      <p className="mt-1 text-caption font-medium text-ink tabular">
                        {draft.startTime} – {draft.endTime} · {newPlaces} {draft.mode === "stream" ? "slots" : "tokens"}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted">
                        📍 {draft.room || room || "Room pending"} · Unsaved
                      </p>
                    </div>
                  ) : null}

                  {selectedDateSessions.length === 0 && (!isCreateMode || !draftAppliesToSelectedDate) ? (
                    <div className="rounded-xl border border-dashed border-hairline bg-surface/50 px-4 py-6 text-center">
                      <p className="text-callout font-semibold text-ink">
                        No sessions on {formatDateHeading(selectedDate)}
                      </p>
                      {addBlockedReason(selectedDate, today) ? (
                        <p className="mt-1 text-caption text-muted">{addBlockedReason(selectedDate, today)}</p>
                      ) : (
                        <>
                          <p className="mt-1 text-caption text-muted">
                            No consulting hours scheduled for this date.
                          </p>
                          <Button
                            type="button"
                            variant="secondary"
                            size="md"
                            onClick={() => startCreate(selectedDate)}
                            className="mt-3 inline-flex items-center gap-1.5"
                          >
                            <Plus size={14} />
                            Add session on this date
                          </Button>
                        </>
                      )}
                    </div>
                  ) : (
                    <AnimatedList className="gap-2 w-full min-w-0 max-w-full p-0 m-0 list-none">
                      {selectedDateSessions.map(({ session, hours, upcoming }, index) => {
                        const isBeingEdited = !isCreateMode && editing?.id === session.id;
                        const isWave = session.mode === "wave";
                        return (
                          <AnimatedListItem
                            key={session.id}
                            index={index}
                            selected={isBeingEdited}
                            className="min-w-0 w-full max-w-full p-0 m-0 list-none"
                          >
                            <button
                              type="button"
                              onClick={() => selectSession(session)}
                              aria-pressed={isBeingEdited}
                              className={`group block w-full min-w-0 max-w-full overflow-hidden rounded-xl border p-3.5 text-left transition-colors box-border ${
                                isBeingEdited
                                  ? "border-accent bg-accent-soft/75 dark:bg-accent/20 ring-1 ring-accent"
                                  : "border-hairline bg-surface hover:border-control hover:bg-fill"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2 min-w-0 w-full">
                                <span className="truncate min-w-0 flex-1 text-callout font-semibold text-ink">
                                  {session.label || (isWave ? "Wave session" : "Stream session")}
                                </span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {isBeingEdited ? (
                                    <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-accent-ink">
                                      Editing now
                                    </span>
                                  ) : null}
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                      isWave ? "bg-warn-soft text-warn" : "bg-accent-soft text-accent"
                                    }`}
                                  >
                                    {isWave ? "Wave" : "Stream"}
                                  </span>
                                </div>
                              </div>

                              <p className="mt-1 text-body font-semibold text-ink tabular">
                                {hours.startTime} – {hours.endTime}
                              </p>

                              <p className="mt-1 text-caption text-ink-2">
                                {session.onDate
                                  ? "One-off session"
                                  : `Repeats ${daysLabel(session)}`}
                              </p>

                              <div className="mt-2.5 flex min-w-0 items-center justify-between gap-2 border-t border-hairline/60 pt-2 text-caption text-muted">
                                <span className="inline-flex min-w-0 items-center gap-1" title={session.room || undefined}>
                                  <Pin size={12} className="shrink-0" />
                                  <span className="truncate">{session.room || "Room pending"}</span>
                                </span>
                                <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap tabular">
                                  <Users size={12} />
                                  <span>{upcoming} upcoming</span>
                                </span>
                              </div>
                            </button>
                          </AnimatedListItem>
                        );
                      })}
                    </AnimatedList>
                  )}
                </div>
              )}
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
