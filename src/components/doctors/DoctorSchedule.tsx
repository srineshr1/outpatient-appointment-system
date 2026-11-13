"use client";

import Link from "next/link";
import { useActionState, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { PageHeading } from "@/components/shell/PageHeading";
import { PendingButton } from "@/components/ui/PendingButton";
import type { ConsultSession, SessionTrim } from "@/lib/clinic-types";
import { sessionStructureChanged, stillFits } from "@/lib/elastic-scheduling";
import type { FormState } from "@/lib/form-state";
import { formatShortDate } from "@/lib/format";
import { addDays, isIsoDate, mondayOf, weekdayIndex } from "@/lib/clock";
import {
  checkSession,
  fromMinutes,
  MAX_WAVE_CAPACITY,
  planAbsorption,
  planStreamShift,
  sessionBlocks,
  STREAM_SLOT_MINUTES,
  toMinutes,
  WAVE_MINUTES,
  WEEKDAY_NAMES,
  type SessionInput,
} from "@/lib/sessions";
import { archiveSession, saveSession } from "@/server/profile-actions";
import { updateVisit } from "@/server/booking-actions";
import { TimeWheelPicker } from "./TimeWheel";
import {
  buildWeek,
  CLINIC_END,
  CLINIC_START,
  clinicWeekday,
  firstFreeHour,
  blockHeightCss,
  holdsPlace,
  HOUR_VAR,
  hourHeightCss,
  minutesLabel,
  occurrenceLabel,
  sessionIsPast,
  todayTitle,
  topCss,
  weekMonday,
  weekTag,
  weekTitle,
  type DaySession,
  type ScheduleVisit,
} from "./schedule-model";

type Palette = { bg: string; bd: string; fg: string; dot: string; soft: string };
type Palettes = { stream: Palette; wave: Palette };

const LIGHT_PALETTES: Palettes = {
  stream: { bg: "#e0f2fe", bd: "#0369a1", fg: "#0c4a6e", dot: "#0369a1", soft: "#f0f9ff" },
  wave: { bg: "#fef3c7", bd: "#b45309", fg: "#78350f", dot: "#b45309", soft: "#fffbeb" },
};
const DARK_PALETTES: Palettes = {
  stream: { bg: "rgba(56, 189, 248, 0.14)", bd: "#38bdf8", fg: "#e0f2fe", dot: "#38bdf8", soft: "rgba(56, 189, 248, 0.08)" },
  wave: { bg: "rgba(251, 191, 36, 0.14)", bd: "#fbbf24", fg: "#fef3c7", dot: "#fbbf24", soft: "rgba(251, 191, 36, 0.08)" },
};

interface EditorState {
  key: string;
  sessionId: string | null;
  date: string;
  label: string;
  mode: "stream" | "wave";
  startMin: number;
  endMin: number;
  slotMinutes: number;
  waveMinutes: number | null;
  waveCapacity: number;
  /** Weekly (with days and a date range) or a one-off on `date`. */
  recurring: boolean;
  weekdays: number[];
  startDate: string;
  endDate: string;
}

export function DoctorSchedule({
  doctorName,
  doctorId,
  today,
  nowMinutes,
  sessions,
  visits,
  trims,
  room,
  editable,
  returnTo,
  notice = null,
  editHref = null,
}: {
  doctorName: string;
  doctorId: string;
  today: string;
  /** Clinic wall-clock minutes since midnight, for the line on today. */
  nowMinutes: number;
  sessions: ConsultSession[];
  visits: ScheduleVisit[];
  trims: SessionTrim[];
  room: string;
  /** Own-book doctors can change sessions. Practice doctors see the same week, without the controls. */
  editable: boolean;
  returnTo: string;
  notice?: string | null;
  /** Where a read-only schedule sends the doctor to edit. */
  editHref?: string | null;
}) {
  const { theme } = useTheme();
  const palettes = theme === "dark" ? DARK_PALETTES : LIGHT_PALETTES;
  const [weekOffset, setWeekOffset] = useState(0);
  const [edit, setEdit] = useState<EditorState | null>(() => openingEditor(sessions, visits, trims, today));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [openVisitId, setOpenVisitId] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [saveState, saveAction] = useActionState(saveSession, null as FormState);

  const monday = weekMonday(today, weekOffset);
  const previewSessions = useMemo(() => withDraft(sessions, edit, doctorId, room), [sessions, edit, doctorId, room]);
  const week = useMemo(() => buildWeek(previewSessions, visits, trims, monday, today), [previewSessions, visits, trims, monday, today]);
  const selected = week.days.flatMap((day) => day.sessions).find((item) => item.key === edit?.key) ?? null;
  const base = edit?.sessionId ? (sessions.find((session) => session.id === edit.sessionId) ?? null) : null;
  const past = base ? sessionIsPast(base, today) : edit ? Boolean(edit.date) && edit.date < today : false;

  /**
   * Every editor change goes through here. A draft whose dates or days change may no longer run on
   * the day it was opened on (a weekly session steps aside on a day with a one-off, or now starts
   * later), so follow it to its first day on the calendar instead of losing the editor.
   */
  function updateEdit(next: EditorState) {
    const found = locateDraft(sessions, visits, trims, next, doctorId, room, today);
    if (found) {
      setEdit({ ...next, key: found.key, date: found.date });
      setWeekOffset(found.offset);
    } else setEdit(next);
  }

  function choose(item: DaySession) {
    setEdit(editorFrom(item.session, item.key));
    setConfirmDelete(false);
    setOpenVisitId(null);
    setHint(null);
  }

  function addNewOn(date: string) {
    if (!clinicWeekday(date)) {
      setHint("Choose Monday through Saturday to add a session.");
      return;
    }
    const start = firstFreeHour(sessions, trims, date);
    if (start === null) {
      setHint("There is no free hour left on that day. Shorten another session first.");
      return;
    }
    const key = `__new__::${date}`;
    setEdit({
      key,
      sessionId: null,
      date,
      label: "New session",
      mode: "stream",
      startMin: start,
      endMin: start + 60,
      slotMinutes: 15,
      waveMinutes: null,
      waveCapacity: 6,
      recurring: false,
      weekdays: [weekdayIndex(date)],
      startDate: date,
      endDate: "",
    });
    setConfirmDelete(false);
    setOpenVisitId(null);
    setHint(
      `New 1-hour stream ready for ${formatShortDate(date)} at ${minutesLabel(start)}. Adjust hours or style on the right, then click Apply change.`,
    );
  }

  function addNew() {
    const date = week.days.map((day) => day.date).find((day) => day >= today) ?? null;
    if (!date || !clinicWeekday(date)) {
      setHint("This week is over. Move to a later week to add a session.");
      return;
    }
    addNewOn(date);
  }

  const banner = saveState && !saveState.ok ? saveState.message : (hint ?? notice);
  const bannerWarn = Boolean((saveState && !saveState.ok) || hint);

  return (
    <div className="bg-canvas text-ink">
      <div className="flex flex-col gap-3.5 px-4 py-4 md:px-6 xl:px-7 xl:pt-[18px] xl:pb-6">
        <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="flex flex-wrap items-baseline gap-x-3.5 gap-y-1">
            <PageHeading className="text-[26px] leading-tight font-bold tracking-tight text-ink">Schedule</PageHeading>
            <p className="text-sm text-muted">
              {doctorName} · Outpatient clinic · {todayTitle(today)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {editHref ? (
              <Link
                href={editHref}
                className="inline-flex min-h-11 items-center rounded-[10px] bg-ink px-4 text-sm font-semibold text-canvas transition-opacity hover:opacity-90"
              >
                Edit schedule
              </Link>
            ) : null}
            <WeekNav monday={monday} weekOffset={weekOffset} onWeek={setWeekOffset} />
            {editable ? (
              <button type="button" onClick={addNew} className={`${solidButton} shrink-0 gap-1.5 whitespace-nowrap`}>
                <PlusIcon />
                Add session
              </button>
            ) : null}
          </div>
        </header>

        {banner ? (
          <div
            role={bannerWarn ? "alert" : "status"}
            className={`rounded-[10px] border px-3 py-2.5 text-[13px] leading-snug ${bannerToneClass(bannerWarn ? "warn" : "info")}`}
          >
            {banner}
          </div>
        ) : null}

        {/*
          Three panes on a wide screen: appointments on the left, the week in the middle, the editor on
          the right. The calendar sets the row height (its hours follow the viewport); the side panes
          fill that height and scroll on their own. Narrower screens keep the calendar first, with the
          appointments under it and the editor beside (xl) or below them.
        */}
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_370px] xl:items-start min-[87.5rem]:grid-cols-[276px_minmax(0,1fr)_396px] min-[87.5rem]:items-stretch min-[100rem]:grid-cols-[300px_minmax(0,1fr)_420px]">
          <div className="min-w-0 xl:col-start-1 xl:row-start-1 min-[87.5rem]:col-start-2">
            <Calendar
              week={week}
              today={today}
              editable={editable}
              nowMinutes={nowMinutes}
              selectedKey={edit?.key ?? null}
              palettes={palettes}
              onSelect={choose}
              onAddOnDate={addNewOn}
            />
          </div>
          <div
            className={`min-w-0 xl:col-start-1 xl:row-start-2 min-[87.5rem]:relative min-[87.5rem]:col-start-1 min-[87.5rem]:row-start-1 ${selected ? "" : "hidden min-[87.5rem]:block"}`}
          >
            <div className={paneScroll}>
              {selected ? (
                <Appointments
                  selected={selected}
                  today={today}
                  returnTo={returnTo}
                  openVisitId={openVisitId}
                  setOpenVisitId={setOpenVisitId}
                  wavePalette={palettes.wave}
                />
              ) : (
                <section aria-labelledby="schedule-appointments" className="rounded-[14px] border border-hairline bg-surface p-4 shadow-card min-[87.5rem]:h-full">
                  <h2 id="schedule-appointments" className="text-base font-bold text-ink">
                    Appointments
                  </h2>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
                    Pick a session in the calendar to see its appointments.
                  </p>
                </section>
              )}
            </div>
          </div>
          <div className="min-w-0 xl:col-start-2 xl:row-span-2 xl:row-start-1 min-[87.5rem]:relative min-[87.5rem]:col-start-3 min-[87.5rem]:row-span-1">
            <div className={paneScroll}>
              <Editor
                editable={editable}
                edit={edit}
                setEdit={updateEdit}
                selected={selected}
                base={base}
                sessions={sessions}
                visits={visits}
                trims={trims}
                room={room}
                doctorId={doctorId}
                today={today}
                past={past}
                returnTo={returnTo}
                confirmDelete={confirmDelete}
                setConfirmDelete={setConfirmDelete}
                openVisitId={openVisitId}
                setOpenVisitId={setOpenVisitId}
                onAdd={addNew}
                onHint={setHint}
                nowMinutes={nowMinutes}
                saveAction={saveAction}
                saveState={saveState}
                palettes={palettes}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** A side pane on the three-pane layout: as tall as the calendar, scrolling inside when its content is taller. */
const paneScroll =
  "min-[87.5rem]:absolute min-[87.5rem]:inset-0 min-[87.5rem]:overflow-y-auto min-[87.5rem]:overscroll-contain min-[87.5rem]:rounded-[14px] min-[87.5rem]:pb-16 min-[87.5rem]:[scrollbar-width:thin]";

function WeekNav({ monday, weekOffset, onWeek }: { monday: string; weekOffset: number; onWeek: (offset: number) => void }) {
  return (
    <nav aria-label="Week" className="flex flex-wrap items-center gap-2">
      <button type="button" aria-label="Previous week" onClick={() => onWeek(weekOffset - 1)} className={iconButton}>
        <Chevron direction="left" />
      </button>
      <button type="button" aria-label="Next week" onClick={() => onWeek(weekOffset + 1)} className={iconButton}>
        <Chevron direction="right" />
      </button>
      <button type="button" onClick={() => onWeek(0)} className={`${textButton} px-4`}>
        Today
      </button>
      <div className="ml-1 flex flex-col">
        <span className="text-base font-bold text-ink tabular-nums">{weekTitle(monday)}</span>
        <span className="text-xs text-muted">{weekTag(weekOffset)}</span>
      </div>
    </nav>
  );
}

function Calendar({
  week,
  today,
  editable,
  nowMinutes,
  selectedKey,
  palettes,
  onSelect,
  onAddOnDate,
}: {
  week: ReturnType<typeof buildWeek>;
  today: string;
  editable: boolean;
  nowMinutes: number;
  selectedKey: string | null;
  palettes: Palettes;
  onSelect: (item: DaySession) => void;
  onAddOnDate: (date: string) => void;
}) {
  const hours = [];
  for (let hour = 8; hour < 18; hour += 1) hours.push(minutesLabel(hour * 60));
  const columnHeight = topCss(CLINIC_END);
  // One hour row, sized to the viewport (see hourHeightCss). Every top and height below scales with it.
  const scale = { [HOUR_VAR]: hourHeightCss() } as CSSProperties;

  return (
    <section
      aria-label="Weekly calendar"
      className="w-full min-w-0 overflow-hidden rounded-[14px] border border-hairline bg-surface shadow-card"
      style={scale}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-hairline bg-surface-2/60 px-3.5 py-2 text-xs text-muted">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: palettes.stream.dot }} />
            <span className="font-semibold text-ink-2">Stream</span> Fixed 1-to-1 slots
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: palettes.wave.dot }} />
            <span className="font-semibold text-ink-2">Wave</span> Hourly arrival queue
          </span>
        </div>
        <div aria-hidden="true" className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-ink-2" /> Booked
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full border border-ink-2" /> Open
          </span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          <div className="grid grid-cols-[52px_repeat(6,minmax(0,1fr))]">
            <div className="border-b border-hairline" />
            {week.days.map((day) => (
              <div key={day.date} className="flex flex-col gap-0.5 border-b border-l border-hairline px-2.5 py-2">
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold tracking-wider text-muted uppercase">{day.dow}</span>
                    <span
                      className={`inline-flex h-[26px] min-w-[26px] items-center justify-center rounded-[13px] text-sm font-bold ${
                        day.isToday ? "bg-accent text-accent-ink" : "text-ink"
                      }`}
                    >
                      {day.num}
                    </span>
                  </div>
                  {editable && day.date >= today ? (
                    <button
                      type="button"
                      onClick={() => onAddOnDate(day.date)}
                      aria-label={`New session on ${day.dow} ${day.num}`}
                      title={`New session on ${day.dow} ${day.num}`}
                      className="inline-flex size-6 shrink-0 items-center justify-center rounded-md border border-transparent text-muted transition-colors hover:border-hairline hover:bg-surface-2 hover:text-ink"
                    >
                      <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true">
                        <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      </svg>
                    </button>
                  ) : null}
                </div>
                <span className="text-xs text-muted tabular-nums">{day.summary}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-[52px_repeat(6,minmax(0,1fr))]">
            <div>
              {hours.map((label) => (
                <div
                  key={label}
                  className="box-border pr-2 pt-0.5 text-right text-[11px] text-muted tabular-nums"
                  style={{ height: `var(${HOUR_VAR})` }}
                >
                  {label}
                </div>
              ))}
            </div>
            {week.days.map((day) => (
              <div
                key={day.date}
                className="relative border-l border-hairline"
                style={{
                  height: columnHeight,
                  backgroundColor: day.isToday ? "color-mix(in srgb, var(--v-accent) 5%, var(--v-surface))" : "var(--v-surface)",
                  backgroundImage: "linear-gradient(to bottom, var(--v-hairline) 0, var(--v-hairline) 1px, transparent 1px)",
                  backgroundSize: `100% var(${HOUR_VAR})`,
                }}
              >
                {/* Drawn first, so session cards sit on top of the line instead of being cut by it. */}
                {day.isToday && nowMinutes >= CLINIC_START && nowMinutes <= CLINIC_END ? (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute right-0 left-0 h-0.5 bg-accent"
                    style={{ top: topCss(nowMinutes) }}
                  />
                ) : null}
                {day.sessions.map((item) => (
                  <SessionBlock key={item.key} item={item} selected={item.key === selectedKey} palettes={palettes} onSelect={onSelect} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function SessionBlock({
  item,
  selected,
  palettes,
  onSelect,
}: {
  item: DaySession;
  selected: boolean;
  palettes: Palettes;
  onSelect: (item: DaySession) => void;
}) {
  const palette = item.session.mode === "wave" ? palettes.wave : palettes.stream;
  const height = blockHeightCss(item.startMin, item.endMin);
  const top = topCss(item.startMin, 1);
  const many = item.lanes > 1;
  // An hour and a half or longer has room for the name on its own line; shorter cards keep it beside the type.
  const roomy = item.endMin - item.startMin >= 90;
  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      aria-pressed={selected}
      aria-label={`${item.session.label || (item.session.mode === "wave" ? "Wave" : "Stream")}, ${item.session.mode} session, ${minutesLabel(item.startMin)} to ${minutesLabel(item.endMin)}, ${item.booked} of ${item.capacity} booked`}
      className="absolute box-border flex flex-col gap-1 overflow-hidden rounded-lg border px-1.5 py-1.5 text-left transition-shadow"
      style={{
        top,
        height,
        left: many ? `calc(${(item.lane * 100) / item.lanes}% + 3px)` : 3,
        right: many ? undefined : 3,
        width: many ? `calc(${100 / item.lanes}% - 6px)` : undefined,
        background: palette.bg,
        borderColor: palette.bd,
        color: palette.fg,
        boxShadow: selected ? `0 0 0 2px ${palette.bd}` : "var(--v-shadow-card)",
      }}
    >
      <span className="flex w-full min-w-0 items-center gap-1 text-[11px] font-bold">
        <span className="inline-flex min-w-0 items-center gap-1 truncate">
          <span className="shrink-0">{item.session.mode === "wave" ? <WaveIcon /> : <StreamIcon />}</span>
          <span className="truncate">{item.session.mode === "wave" ? "Wave" : "Stream"}</span>
        </span>
        {item.session.label && !roomy ? <span className="min-w-0 truncate font-semibold">· {item.session.label}</span> : null}
        <span className="ml-auto shrink-0 tabular-nums">
          {item.booked}/{item.capacity}
        </span>
      </span>
      {item.session.label && roomy ? <span className="truncate text-xs leading-tight font-semibold">{item.session.label}</span> : null}
      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <span className="shrink-0 text-[11px] leading-none font-medium tabular-nums">
          {minutesLabel(item.startMin)}–{minutesLabel(item.endMin)}
        </span>
        <span className="flex flex-wrap gap-[3px]">
          {item.blocks.map((block) => (
            <span
              key={block.time}
              className="flex"
              style={{
                gap: item.session.mode === "wave" ? 2 : 0,
                padding: item.session.mode === "wave" ? "2px 3px" : 0,
                borderRadius: 7,
                background: item.session.mode === "wave" ? palette.soft : "transparent",
                border: `1px solid ${item.session.mode === "wave" ? `${palette.bd}66` : "transparent"}`,
              }}
            >
              {block.seats.map((seat) => (
                <span
                  key={seat.seat}
                  className="block size-2 rounded-full border-[1.5px]"
                  style={{ borderColor: palette.dot, background: seat.visit ? palette.dot : "transparent" }}
                />
              ))}
            </span>
          ))}
        </span>
      </span>
    </button>
  );
}

function Editor(props: {
  editable: boolean;
  edit: EditorState | null;
  setEdit: (edit: EditorState) => void;
  selected: DaySession | null;
  base: ConsultSession | null;
  sessions: ConsultSession[];
  visits: ScheduleVisit[];
  trims: SessionTrim[];
  room: string;
  doctorId: string;
  today: string;
  past: boolean;
  returnTo: string;
  confirmDelete: boolean;
  setConfirmDelete: (value: boolean) => void;
  openVisitId: string | null;
  setOpenVisitId: (id: string | null) => void;
  onAdd: () => void;
  onHint: (hint: string | null) => void;
  /** Clinic wall-clock minutes now: today's visits that have started are not moved. */
  nowMinutes: number;
  saveAction: (formData: FormData) => void;
  saveState: FormState;
  palettes: Palettes;
}) {
  const { edit, selected, base, editable, past, saveState } = props;
  if (!edit) {
    return (
      <aside aria-label="Session editor" className="min-w-0 overflow-hidden rounded-[14px] border border-hairline bg-surface shadow-card">
        <div className="flex flex-col gap-2 p-5">
          <span className="text-base font-bold text-ink">No session selected</span>
          <span className="text-sm leading-relaxed text-muted">
            Pick a session in the calendar to adjust its hours, style, or capacity
            {editable ? ", or click + Add session above." : "."}
          </span>
        </div>
      </aside>
    );
  }

  const palette = edit.mode === "wave" ? props.palettes.wave : props.palettes.stream;
  const step = edit.mode === "stream" ? edit.slotMinutes : (edit.waveMinutes ?? 5);
  const grid = sliderGrid(edit.startMin, step);
  const reserved = props.visits.filter(
    (visit) => visit.sessionId === edit.sessionId && visit.date >= props.today && holdsPlace(visit.status),
  );
  const proposed = toSession(edit, base, props.doctorId, props.room);
  const dirty = !base || !sameEditor(base, edit);
  const others = props.sessions.filter((session) => session.id !== proposed.id && !session.archivedAt);
  // A weekly session saved before dates were required may keep blank dates (the server allows it too).
  const keepOpenRange = Boolean(base && !base.onDate && !base.startDate && !base.endDate);
  const checked = checkSession(toInput(edit, base, props.room), others, props.today, { keepOpenRange });
  // Patients whose place disappears with this change: outside shortened hours, or (for fewer places
  // per wave, another slot length or interval, stream/wave or other days) no longer fitting at all.
  const structureChanged = Boolean(base && sessionStructureChanged(base, proposed));
  const affected = base
    ? props.visits.filter(
        (visit) =>
          visit.sessionId === base.id &&
          visit.date >= props.today &&
          (visit.status === "booked" || (structureChanged && visit.status === "pending_payment")) &&
          !stillFits(visit, proposed),
      )
    : [];
  const leaving = new Set(affected.map((visit) => visit.id));
  const plan = checked.ok
    ? planAbsorption(proposed, others, occupying(props.visits.filter((visit) => !leaving.has(visit.id))), props.today, props.trims)
    : null;
  // Growing into the start of a stream where patients are booked: the stream starts later and those
  // patients move to its next free slots that day, after the doctor confirms (planStreamShift).
  const shift =
    checked.ok && plan && !plan.ok && affected.length === 0
      ? planStreamShift(
          proposed,
          others,
          props.visits
            .filter((visit) => visit.date >= props.today && holdsPlace(visit.status))
            .map((visit) => ({ id: visit.id, status: visit.status, date: visit.date, time: visit.time, endTime: visit.endTime ?? null, sessionId: visit.sessionId ?? null })),
          props.today,
          props.trims,
          (visit) => visit.date > props.today || toMinutes(visit.time) > props.nowMinutes,
        )
      : null;
  const shiftMoves = shift && shift.ok ? shift.moves : [];
  const blocked = past || !checked.ok || Boolean(plan && !plan.ok && shiftMoves.length === 0);
  const displacing = !blocked && dirty && affected.length > 0;
  const shifting = !blocked && dirty && shiftMoves.length > 0;
  const shiftCount = saveState?.shift?.count ?? shiftMoves.length;
  const displaceCount = saveState?.displace?.count ?? affected.length;
  const canApply = editable && dirty && !blocked && !displacing && !shifting;

  const shownBooked = selected ? selected.booked : 0;
  const shownCapacity = selected ? selected.capacity : checked.ok ? blockPlaces(proposed) : 0;
  const oldPlaces = base ? blockPlaces(base) : 0;
  const newPlaces = checked.ok ? blockPlaces(proposed) : oldPlaces;
  const delta = newPlaces - oldPlaces;

  let planTitle = "";
  let planLines: string[] = [];
  let planTone: "info" | "warn" = "info";
  if (past) {
    planTitle = "This session has finished";
    planLines = ["Past sessions are read-only."];
    planTone = "warn";
  } else if (!dirty) {
    planTitle = "How bookings are handled";
    planLines = [
      "Expand: appointments you already have stay exactly where they are. New open places appear at the edge you extend.",
      "Shrink: a visit that would fall outside the new hours stops the change. Move or cancel it first. Nothing is moved or cancelled for you.",
    ];
  } else if (!checked.ok) {
    planTitle = "This change needs a small adjustment";
    planLines = [checked.message];
    planTone = "warn";
  } else if (shift && shift.ok && shiftMoves.length > 0) {
    const n = shiftMoves.length;
    const names = new Map(props.visits.map((visit) => [visit.id, visit.patientName]));
    const dates = new Set(shift.starts.map((start) => start.date));
    const startTimes = [...new Set(shift.starts.map((start) => start.time))].join(" / ");
    planTitle = `Stream will start at ${startTimes}${dates.size > 1 ? ` on ${dates.size} days` : ""}; ${n} ${n === 1 ? "patient" : "patients"} will be moved`;
    planLines = shiftMoves.slice(0, 8).map(
      (move) => `${names.get(move.visitId) ?? "Patient"} · ${dates.size > 1 ? `${formatShortDate(move.date)} ` : ""}${move.fromTime} → ${move.toTime}`,
    );
    if (n > 8) planLines.push(`+ ${n - 8} more`);
    planLines.push("They keep their reference and get an email and text with the old and new time. Nothing changes until you confirm.");
    planTone = "warn";
  } else if (plan && !plan.ok) {
    planTitle = "That overlaps another session";
    planLines = [shift && !shift.ok ? `${shift.message} ${plan.message}` : plan.message];
    planTone = "warn";
  } else if (affected.length > 0) {
    const n = affected.length;
    planTitle = `${n} ${n === 1 ? "patient no longer fits" : "patients no longer fit"} this change`;
    planLines = affected.slice(0, 6).map((visit) => `${visit.patientName} · ${formatShortDate(visit.date)} ${visit.time}${visit.token ? ` · token ${visit.token}` : ""}`);
    if (n > 6) planLines.push(`+ ${n - 6} more`);
    planLines.push(
      "Move or cancel them first, or notify them: each patient is offered the nearest free times with you (held for 24 hours) and can pick one or cancel for a full refund. Nothing changes until you confirm.",
    );
    planTone = "warn";
  } else if (dirty) {
    planTitle = delta > 0 ? `Adds ${placesWord(delta)}` : delta < 0 ? `Removes ${placesWord(-delta)} (all open)` : "Shifts the session window";
    planLines = [
      reserved.length > 0
        ? `All ${reserved.length} existing ${reserved.length === 1 ? "appointment stays" : "appointments stay"} where ${reserved.length === 1 ? "it is" : "they are"}.`
        : "No appointments are affected.",
    ];
    if (plan && plan.ok && plan.notice) planLines.push(plan.notice);
  }

  const startNote = edgeNote(edit.startMin - (base ? toMinutes(base.startTime) : edit.startMin), edit, "start");
  const endNote = edgeNote(edit.endMin - (base ? toMinutes(base.endTime) : edit.endMin), edit, "end");

  const durationMinutes = Math.max(0, edit.endMin - edit.startMin);
  const durationText =
    durationMinutes % 60 === 0
      ? `${durationMinutes / 60}h`
      : durationMinutes > 60
        ? `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`
        : `${durationMinutes}m`;

  const applyPreset = (startTarget: number, endTarget: number) => {
    const startMin = Math.max(grid.min, Math.min(grid.max - step, startTarget));
    const units = Math.max(1, Math.round((endTarget - startMin) / step));
    const endMin = Math.min(grid.max, Math.max(startMin + step, startMin + units * step));
    props.setEdit({ ...edit, startMin, endMin });
  };

  return (
    <aside aria-label="Session editor" className="min-w-0 overflow-hidden rounded-[14px] border border-hairline bg-surface shadow-card">
      <div className="border-b border-hairline p-4">
        <div className="flex items-center justify-between gap-2">
          <span
            className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${
              base ? "border border-hairline bg-surface-2 text-muted" : "bg-accent-soft text-accent"
            }`}
          >
            {base ? "Editing session" : "New session"}
          </span>
          <span className="text-xs text-muted tabular-nums">
            {selected ? occurrenceLabel(selected.session, selected.date) : edit.date ? occurrenceLabel(proposed, edit.date) : "Choose a date"} ·{" "}
            {minutesLabel(edit.startMin)}–{minutesLabel(edit.endMin)}
          </span>
        </div>

        <label htmlFor="schedule-session-name" className="sr-only">
          Session name
        </label>
        <input
          id="schedule-session-name"
          aria-label="Session name"
          placeholder="e.g. Morning surgery"
          value={edit.label}
          disabled={!editable || past}
          onChange={(event) => props.setEdit({ ...edit, label: event.target.value.slice(0, 60) })}
          className="mt-2.5 h-11 w-full rounded-[10px] border border-hairline bg-surface-2 px-3 text-base font-semibold text-ink placeholder:text-muted focus:border-accent focus:outline-none disabled:opacity-50"
        />

        {!selected ? (
          <p className={`mt-2.5 rounded-[10px] border px-3 py-2 text-[13px] leading-snug ${bannerToneClass("info")}`}>
            {checked.ok ? "This session isn’t on the calendar for these dates yet. Check its days and dates." : checked.message}
          </p>
        ) : null}

        {editable ? (
          <div className="mt-3 rounded-[12px] border border-hairline bg-surface-2/60 p-3">
            <RepeatFields edit={edit} setEdit={props.setEdit} disabled={past} undated={keepOpenRange} today={props.today} />
          </div>
        ) : null}

        <div className="mt-3.5">
          <fieldset className="border-0 p-0">
            <legend className="text-xs font-semibold tracking-wider text-muted uppercase">Appointment style</legend>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              <TypeButton
                label="Stream"
                hint="Fixed 1-to-1 slots"
                pressed={edit.mode === "stream"}
                palette={props.palettes.stream}
                disabled={!editable || past}
                onClick={() => props.setEdit({ ...edit, mode: "stream", waveMinutes: null })}
              >
                <StreamIcon />
              </TypeButton>
              <TypeButton
                label="Wave"
                hint="Hourly arrival queue"
                pressed={edit.mode === "wave"}
                palette={props.palettes.wave}
                disabled={!editable || past}
                onClick={() => props.setEdit({ ...edit, mode: "wave", waveCapacity: edit.waveCapacity || 3 })}
              >
                <WaveIcon />
              </TypeButton>
            </div>
          </fieldset>

          {editable ? (
            <div className="mt-3 flex flex-col gap-3">
              <fieldset className="border-0 p-0">
                <legend className="text-xs font-semibold text-ink-2">
                  {edit.mode === "wave" ? "Wave interval" : "Slot length"}
                </legend>
                <div className="mt-1.5 flex gap-1.5">
                  {(edit.mode === "wave" ? waveChoices(edit.waveMinutes) : streamChoices(edit.slotMinutes)).map((choice) => {
                    const on = edit.mode === "wave" ? edit.waveMinutes === choice.value : edit.slotMinutes === choice.value;
                    return (
                      <button
                        key={choice.label}
                        type="button"
                        aria-pressed={on}
                        disabled={past}
                        onClick={() => props.setEdit(snapInterval(edit, choice.value))}
                        className={`min-h-10 flex-1 rounded-[10px] border text-xs font-semibold transition-colors disabled:opacity-40 ${choiceButton(on)}`}
                      >
                        {choice.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              {edit.mode === "wave" ? (
                <div className="flex items-center justify-between gap-3 rounded-[10px] border border-hairline bg-surface-2/60 px-3 py-2">
                  <span className="text-[13px] font-semibold text-ink">Patients per wave</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="One fewer patient per wave"
                      disabled={past || edit.waveCapacity <= 1}
                      onClick={() => props.setEdit({ ...edit, waveCapacity: Math.max(1, edit.waveCapacity - 1) })}
                      className={iconButton}
                    >
                      <MinusIcon />
                    </button>
                    <span className="min-w-10 text-center text-base font-bold text-ink tabular-nums">{edit.waveCapacity}</span>
                    <button
                      type="button"
                      aria-label="One more patient per wave"
                      disabled={past || edit.waveCapacity >= MAX_WAVE_CAPACITY}
                      onClick={() => props.setEdit({ ...edit, waveCapacity: Math.min(MAX_WAVE_CAPACITY, edit.waveCapacity + 1) })}
                      className={iconButton}
                    >
                      <PlusIcon />
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <form id="schedule-save" action={props.saveAction} className="contents">
        <SessionFields edit={edit} base={base} room={props.room} />
        <div className="p-4">
          <div className="grid grid-cols-3 gap-2 rounded-[12px] border border-hairline bg-surface-2/60 p-3">
            <Stat label="Booked" value={shownBooked} />
            <Stat label="Capacity" value={shownCapacity} />
            <Stat label="Open" value={Math.max(0, shownCapacity - shownBooked)} />
          </div>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-fill-strong">
            <div
              className="h-full rounded-full transition-all duration-200"
              style={{ width: `${shownCapacity ? Math.round((100 * shownBooked) / shownCapacity) : 0}%`, background: palette.dot }}
            />
          </div>

          {editable ? (
            <div className="mt-4 flex flex-col gap-3.5">
              {!past ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="mr-1 text-xs font-medium text-muted">Quick set:</span>
                  {[
                    { label: "09–12", start: 9 * 60, end: 12 * 60 },
                    { label: "14–17", start: 14 * 60, end: 17 * 60 },
                    { label: "09–17", start: 9 * 60, end: 17 * 60 },
                  ].map((preset) => {
                    const active = edit.startMin === preset.start && edit.endMin === preset.end;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => applyPreset(preset.start, preset.end)}
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium tabular-nums transition-colors ${
                          active
                            ? "border-ink bg-ink text-canvas"
                            : "border-hairline bg-surface-2 text-ink-2 hover:border-control hover:text-ink"
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                <TimeWheelPicker
                  label="Starts"
                  ariaLabel="Session start time"
                  valueText={`Starts at ${minutesLabel(edit.startMin)}`}
                  value={edit.startMin}
                  min={grid.min}
                  max={Math.max(grid.min, edit.endMin - step)}
                  step={step}
                  disabled={past || edit.endMin - step <= grid.min}
                  note={startNote}
                  palette={palette}
                  onChange={(startMin) => props.setEdit({ ...edit, startMin: Math.min(startMin, edit.endMin - step) })}
                />
                <TimeWheelPicker
                  label="Ends"
                  ariaLabel="Session end time"
                  valueText={`Ends at ${minutesLabel(edit.endMin)}`}
                  value={edit.endMin}
                  min={Math.min(grid.max, edit.startMin + step)}
                  max={grid.max}
                  step={step}
                  disabled={past || grid.max <= edit.startMin + step}
                  note={endNote}
                  palette={palette}
                  onChange={(endMin) => props.setEdit({ ...edit, endMin: Math.max(endMin, edit.startMin + step) })}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-hairline bg-surface-2/60 px-3 py-2 text-xs text-ink-2 tabular-nums">
                <span className="font-semibold">
                  {minutesLabel(edit.startMin)}–{minutesLabel(edit.endMin)} · {durationText}
                </span>
                <span>
                  {placesWord(newPlaces)}
                  {base && dirty && delta !== 0 ? (
                    <span className={`ml-1.5 font-semibold ${delta > 0 ? "text-success" : "text-warn"}`}>
                      ({delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`})
                    </span>
                  ) : null}
                </span>
              </div>

              {dirty || blocked || past || displacing || shifting ? (
                <div className={`rounded-[10px] border px-3 py-2.5 text-[13px] leading-snug ${bannerToneClass(planTone)}`}>
                  <p className="font-bold">{planTitle}</p>
                  {planLines.map((line) => (
                    <p key={line} className="mt-1">
                      {line}
                    </p>
                  ))}
                </div>
              ) : (
                <details className="rounded-[10px] border border-hairline px-3 py-2 text-xs text-muted">
                  <summary className="cursor-pointer font-medium text-ink-2 select-none">How schedule changes handle bookings</summary>
                  <div className="mt-1.5 flex flex-col gap-1 leading-relaxed">
                    {planLines.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>
                </details>
              )}

              {displacing ? (
                <div className="flex flex-col gap-2 rounded-[10px] border border-warn/35 bg-warn-soft p-3 text-[13px] text-ink">
                  <label htmlFor="schedule-displace-reason" className="font-semibold">
                    Message for the patients <span className="font-normal text-ink-2">(optional)</span>
                  </label>
                  <input
                    id="schedule-displace-reason"
                    name="displaceReason"
                    maxLength={200}
                    placeholder="For example: I am needed in theatre that morning."
                    className="h-11 rounded-[10px] border border-hairline bg-surface px-3 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none"
                  />
                  <input type="hidden" name="displaceCount" value={displaceCount} />
                  <PendingButton
                    name="displace"
                    value="confirm"
                    pendingLabel="Notifying…"
                    className="min-h-11 rounded-[10px] border border-danger/45 bg-surface px-3.5 text-sm font-semibold text-danger transition-colors hover:bg-danger-soft"
                  >
                    {`Apply and notify ${displaceCount === 1 ? "1 patient" : `${displaceCount} patients`} with new times`}
                  </PendingButton>
                </div>
              ) : null}

              {shifting ? (
                <div className="flex flex-col gap-2 rounded-[10px] border border-warn/35 bg-warn-soft p-3 text-[13px] text-ink">
                  <input type="hidden" name="shiftCount" value={shiftCount} />
                  <PendingButton
                    name="shift"
                    value="confirm"
                    pendingLabel="Moving…"
                    className="min-h-11 rounded-[10px] bg-ink px-3.5 text-sm font-semibold text-canvas transition-opacity hover:opacity-90"
                  >
                    {`Apply and move ${shiftCount === 1 ? "1 patient" : `${shiftCount} patients`} to later slots`}
                  </PendingButton>
                </div>
              ) : null}

              {dirty ? (
                <div className="flex flex-wrap gap-2">
                  <PendingButton
                    pendingLabel="Applying…"
                    disabled={!canApply}
                    className={`min-h-11 flex-[1_1_180px] rounded-[10px] border px-3.5 text-sm font-semibold transition-all disabled:cursor-not-allowed ${
                      canApply
                        ? "border-transparent bg-ink text-canvas hover:opacity-90"
                        : "border-hairline bg-fill text-muted opacity-70"
                    }`}
                  >
                    Apply change
                  </PendingButton>
                  <button
                    type="button"
                    onClick={() => {
                      if (base) props.setEdit(editorFrom(base, edit.key));
                      else props.onAdd();
                      props.onHint(null);
                    }}
                    className={`${textButton} px-4`}
                  >
                    Reset
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-[13px] leading-normal text-muted">
              {base ? `${base.startTime}–${base.endTime} · ${base.room}` : null}
            </p>
          )}
        </div>
      </form>

      {editable && base ? (
        <div className="flex items-center justify-between gap-3 border-t border-hairline bg-surface-2/40 px-4 py-3">
          <span className="text-xs text-muted">No longer needed?</span>
          <form action={archiveSession}>
            <input type="hidden" name="id" value={base.id} />
            <button
              type="submit"
              onClick={(event) => {
                if (past) {
                  event.preventDefault();
                  props.onHint("Past sessions are read-only.");
                  return;
                }
                if (reserved.length > 0 && !props.confirmDelete) {
                  event.preventDefault();
                  props.setConfirmDelete(true);
                  props.onHint(
                    `${reserved.length} booked ${reserved.length === 1 ? "visit uses" : "visits use"} this session. Move or cancel ${reserved.length === 1 ? "it" : "them"} from the appointments list, or press "Delete anyway" to choose whether to notify ${reserved.length === 1 ? "that patient" : "those patients"} and offer new times.`,
                  );
                  return;
                }
                if (!props.confirmDelete) {
                  event.preventDefault();
                  props.setConfirmDelete(true);
                }
              }}
              className="inline-flex min-h-9 items-center rounded-lg border border-danger/35 bg-danger-soft px-3 text-xs font-semibold text-danger transition-colors hover:bg-danger/15"
            >
              {props.confirmDelete ? (reserved.length === 0 ? "Confirm delete" : "Delete anyway…") : "Delete session"}
            </button>
          </form>
        </div>
      ) : null}
    </aside>
  );
}

function Appointments({
  selected,
  today,
  returnTo,
  openVisitId,
  setOpenVisitId,
  wavePalette,
}: {
  selected: DaySession;
  today: string;
  returnTo: string;
  openVisitId: string | null;
  setOpenVisitId: (id: string | null) => void;
  wavePalette: Palette;
}) {
  const open = Math.max(0, selected.capacity - selected.booked);
  const wave = selected.session.mode === "wave";
  const row = (visit: ScheduleVisit, lead: string) => (
    <VisitRow
      key={visit.id}
      visit={visit}
      lead={lead}
      today={today}
      returnTo={returnTo}
      open={openVisitId === visit.id}
      onToggle={() => setOpenVisitId(openVisitId === visit.id ? null : visit.id)}
      onClose={() => setOpenVisitId(null)}
    />
  );
  const label = selected.session.label || "Session";
  return (
    <section aria-labelledby="schedule-appointments" className="w-full rounded-[14px] border border-hairline bg-surface shadow-card min-[87.5rem]:min-h-full">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-4 pt-4 pb-3 min-[87.5rem]:flex-col">
        <h2 id="schedule-appointments" className="text-base font-bold text-ink">
          Appointments
          <span className="sr-only">
            {" "}
            · {label} · {occurrenceLabel(selected.session, selected.date)}
          </span>
        </h2>
        <p aria-hidden="true" className="text-[13px] text-muted min-[87.5rem]:-mt-0.5">
          {label} · {occurrenceLabel(selected.session, selected.date)}
        </p>
        <span className="text-[13px] text-muted tabular-nums">
          {selected.booked} booked · {open} open
        </span>
      </div>
      <div className="flex flex-col gap-3 px-4 pb-4">
        {selected.outside.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <p className={`rounded-[10px] border px-3 py-2 text-[13px] leading-snug ${bannerToneClass("warn")}`}>
              {selected.outside.length === 1 ? "1 visit sits" : `${selected.outside.length} visits sit`} outside these hours and{" "}
              {selected.outside.length === 1 ? "keeps its" : "keep their"} original time.
            </p>
            <div className={visitGrid}>{selected.outside.map((visit) => row(visit, visit.time))}</div>
          </div>
        ) : null}
        {wave
          ? selected.blocks.map((block, index) => {
              const taken = block.seats.filter((seat) => seat.visit);
              const free = block.seats.filter((seat) => !seat.visit);
              return (
                <div key={block.time} className="flex flex-col gap-2.5 rounded-[12px] border border-warn/30 bg-warn-soft p-3">
                  <div className="flex items-center justify-between px-0.5 text-xs font-bold tracking-wide text-warn uppercase tabular-nums">
                    <span>
                      Wave {index + 1} · {block.time}
                    </span>
                    <span>
                      {taken.length}/{block.places}
                    </span>
                  </div>
                  {taken.length > 0 ? <div className={visitGrid}>{taken.map((seat) => row(seat.visit!, `Seat ${seat.seat}`))}</div> : null}
                  {free.length > 0 ? (
                    <ul aria-label={`Open seats in wave ${index + 1}`} className={visitGrid}>
                      {free.map((seat) => (
                        <li key={`${block.time}-${seat.seat}`} className={openRow}>
                          <span aria-hidden="true" className={seatNumber} style={{ borderColor: wavePalette.bd, color: wavePalette.fg }}>
                            {seat.seat}
                          </span>
                          <span className="flex flex-col leading-snug">
                            <span className="text-[13.5px] font-semibold text-ink">Seat {seat.seat}</span>
                            <span className="text-xs text-muted tabular-nums">{block.time} · open</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              );
            })
          : null}
        {!wave && selected.booked === 0 && selected.blocks.some((block) => block.seats.some((seat) => !seat.visit)) ? (
          <p className="rounded-[10px] border border-hairline bg-surface-2/60 px-3 py-2 text-xs text-muted">
            No patients booked yet — patients can pick any open time below.
          </p>
        ) : null}
        {!wave && selected.blocks.some((block) => block.seats.some((seat) => block.seats.length > 0 && seat.visit)) ? (
          <div className={visitGrid}>
            {selected.blocks.flatMap((block) => block.seats.filter((seat) => seat.visit).map((seat) => row(seat.visit!, block.time)))}
          </div>
        ) : null}
        {!wave && selected.blocks.some((block) => block.seats.some((seat) => !seat.visit)) ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-0.5 text-xs">
              <span className="font-bold tracking-wide text-muted uppercase">Open slots</span>
              <span className="text-muted tabular-nums">{selected.session.slotMinutes ?? 15} min each</span>
            </div>
            <ul aria-label="Open slots" className="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-1.5">
              {selected.blocks
                .filter((block) => block.seats.some((seat) => !seat.visit))
                .map((block) => (
                  <li
                    key={block.time}
                    className="inline-flex min-h-8 items-center justify-center rounded-lg border border-hairline bg-surface-2 text-xs font-medium text-ink-2 tabular-nums"
                  >
                    {block.time}
                  </li>
                ))}
            </ul>
          </div>
        ) : null}
        {selected.blocks.length === 0 && selected.outside.length === 0 ? (
          <p className="text-[13px] text-muted">No places in this session.</p>
        ) : null}
      </div>
    </section>
  );
}

/** Visits and open seats: one column in the narrow left pane, more where the list sits under the calendar. */
const visitGrid = "grid gap-2 sm:grid-cols-2 xl:grid-cols-3 min-[87.5rem]:grid-cols-1";
const openRow =
  "flex min-h-[60px] items-center gap-3 rounded-[12px] border border-dashed border-control/50 bg-surface-2 px-3.5 py-2";
const seatNumber =
  "inline-flex size-[30px] shrink-0 items-center justify-center rounded-full border-[1.5px] bg-surface text-[13px] font-bold tabular-nums";

function VisitRow({
  visit,
  lead,
  today,
  returnTo,
  open,
  onToggle,
  onClose,
}: {
  visit: ScheduleVisit;
  lead: string;
  today: string;
  returnTo: string;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const upcoming = visit.date >= today && visit.status === "booked";
  const [confirmCancel, setConfirmCancel] = useState(false);
  return (
    <div
      className={`overflow-hidden rounded-[10px] border transition-colors ${
        open ? "border-accent bg-surface-2" : "border-hairline bg-surface-2 hover:border-control"
      }`}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex min-h-12 w-full items-center gap-2.5 bg-transparent px-3 py-1.5 text-left"
      >
        <span className="min-w-[52px] text-[13px] text-muted tabular-nums">{lead}</span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-semibold text-ink">{visit.patientName}</span>
          <span className="text-xs text-muted">
            {visit.reason}
            {visit.status === "completed" ? " · Completed" : visit.status === "pending_payment" ? " · Awaiting payment" : ""}
          </span>
        </span>
        <PencilIcon />
      </button>
      {open ? (
        <div className="flex flex-col gap-3 border-t border-hairline bg-surface p-3">
          <p className="text-[13px] text-muted">
            Reference <span className="font-semibold text-ink tabular-nums">{visit.reference}</span>
            {visit.token ? (
              <>
                {" "}
                · Token <span className="font-semibold text-ink tabular-nums">{visit.token}</span>
              </>
            ) : null}
          </p>
          {confirmCancel ? (
            <form
              action={updateVisit}
              role="alert"
              aria-labelledby={`cancel-${visit.id}`}
              className="flex flex-col gap-2 rounded-[10px] border border-danger/35 bg-danger-soft p-3 text-[13px] text-ink"
            >
              <p id={`cancel-${visit.id}`} className="font-semibold">
                Cancel {visit.patientName}&rsquo;s appointment on {formatShortDate(visit.date)} at {visit.time}?
              </p>
              <p className="text-ink-2">The place opens for others and the patient is told. A paid visit is refunded.</p>
              <input type="hidden" name="id" value={visit.id} />
              <input type="hidden" name="status" value="cancelled" />
              <input type="hidden" name="return" value={returnTo} />
              <div className="flex gap-2">
                <PendingButton
                  pendingLabel="Cancelling…"
                  className="min-h-11 flex-1 rounded-[10px] border border-transparent bg-danger text-[13px] font-semibold text-canvas transition-opacity hover:opacity-90"
                >
                  Yes, cancel it
                </PendingButton>
                <button
                  type="button"
                  onClick={() => setConfirmCancel(false)}
                  className="min-h-11 flex-1 rounded-[10px] border border-hairline bg-surface text-[13px] font-semibold text-ink transition-colors hover:bg-fill"
                >
                  Keep appointment
                </button>
              </div>
            </form>
          ) : null}
          <div className="flex gap-2">
            {(visit.status === "booked" || visit.status === "pending_payment") && !confirmCancel ? (
              <button
                type="button"
                onClick={() => setConfirmCancel(true)}
                className="min-h-11 flex-1 rounded-[10px] border border-danger/35 bg-danger-soft text-[13px] font-semibold text-danger transition-colors hover:bg-danger/15"
              >
                Cancel appointment
              </button>
            ) : null}
            {visit.status === "booked" ? (
              <form action={updateVisit} className="flex-1">
                <input type="hidden" name="id" value={visit.id} />
                <input type="hidden" name="status" value="completed" />
                <input type="hidden" name="return" value={returnTo} />
                <PendingButton
                  pendingLabel="Saving…"
                  className="min-h-11 w-full rounded-[10px] border border-success/35 bg-success-soft text-[13px] font-semibold text-success transition-colors hover:bg-success/15"
                >
                  Mark complete
                </PendingButton>
              </form>
            ) : null}
          </div>
          <div className="flex gap-2">
            {upcoming ? (
              <Link
                href={`/reschedule/${visit.id}?return=${encodeURIComponent(returnTo)}`}
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-[10px] border border-hairline bg-surface-2 text-[13px] font-semibold text-ink transition-colors hover:bg-fill"
              >
                Move to another time
              </Link>
            ) : null}
            <button type="button" onClick={onClose} className={`${solidButton} flex-1`}>
              Done
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** One-off on the chosen date, or weekly on chosen days between two dates (both required). */
function RepeatFields({
  edit,
  setEdit,
  disabled,
  undated,
  today,
}: {
  edit: EditorState;
  setEdit: (edit: EditorState) => void;
  disabled: boolean;
  /** The earliest date a one-off session can be put on. */
  today: string;
  /** A weekly session saved before dates were required: it may stay undated, but should get dates. */
  undated: boolean;
}) {
  const id = `repeat-${edit.key.replace(/[^a-zA-Z0-9-]/g, "-")}`;
  const dateInputClass =
    "h-11 rounded-[10px] border border-hairline bg-surface-2 px-2 text-sm font-normal text-ink tabular-nums focus:border-accent focus:outline-none disabled:opacity-50";
  const recurringBox = (
    <label
      htmlFor={`${id}-on`}
      className={`inline-flex min-h-11 items-center gap-2.5 font-semibold text-ink ${edit.recurring ? "text-sm" : "text-[13px] min-[87.5rem]:min-h-8"}`}
    >
      <input
        id={`${id}-on`}
        type="checkbox"
        checked={edit.recurring}
        disabled={disabled}
        onChange={(event) => {
          const recurring = event.target.checked;
          setEdit({
            ...edit,
            recurring,
            weekdays: edit.weekdays.length > 0 ? edit.weekdays : [weekdayIndex(edit.date || today)],
            startDate: edit.startDate || edit.date || today,
          });
        }}
        className={edit.recurring ? "size-5 accent-accent" : "size-[18px] accent-accent"}
      />
      Recurring every week
    </label>
  );
  return (
    <div className={`flex flex-col gap-2.5 ${edit.recurring ? "mt-3" : "mt-1.5"}`}>
      {edit.recurring ? recurringBox : null}
      {!edit.recurring ? (
        // A one-off: the weekly switch shares the Date label's line, so the editor stays short.
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center justify-between gap-x-3">
            <label htmlFor={`${id}-date`} className="text-[13px] font-semibold text-ink-2">
              Date
            </label>
            {recurringBox}
          </div>
          <input
            id={`${id}-date`}
            type="date"
            required
            min={today}
            value={edit.date}
            disabled={disabled}
            onChange={(event) => {
              const date = event.target.value;
              // A half-typed or cleared date is ignored, so the session stays where it was.
              if (!isIsoDate(date)) return;
              setEdit({ ...edit, date, weekdays: [weekdayIndex(date)] });
            }}
            className={dateInputClass}
          />
        </div>
      ) : null}
      {edit.recurring ? (
        <>
          <fieldset className="border-0 p-0">
            <legend className="text-[13px] font-semibold text-ink-2">Days</legend>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {WEEKDAY_NAMES.map((name, index) => {
                const day = index + 1;
                const on = edit.weekdays.includes(day);
                return (
                  <button
                    key={name}
                    type="button"
                    aria-label={name}
                    aria-pressed={on}
                    disabled={disabled}
                    onClick={() =>
                      setEdit({ ...edit, weekdays: on ? edit.weekdays.filter((item) => item !== day) : [...edit.weekdays, day].sort((a, b) => a - b) })
                    }
                    className={`min-h-11 min-w-11 rounded-[10px] border px-2 text-[13px] font-semibold transition-colors disabled:opacity-40 ${choiceButton(on)}`}
                  >
                    {name.slice(0, 3)}
                  </button>
                );
              })}
            </div>
          </fieldset>
          {undated && !edit.startDate && !edit.endDate ? (
            <p className={`rounded-[10px] border px-3 py-2 text-[13px] leading-snug ${bannerToneClass("info")}`}>
              This weekly session has no start or end date. Add both so patients see when it runs.
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <label htmlFor={`${id}-from`} className="flex flex-col gap-1 text-[13px] font-semibold text-ink-2">
              Start date
              <input
                id={`${id}-from`}
                type="date"
                required={!undated}
                value={edit.startDate}
                disabled={disabled}
                onChange={(event) => setEdit({ ...edit, startDate: event.target.value })}
                className={dateInputClass}
              />
            </label>
            <label htmlFor={`${id}-until`} className="flex flex-col gap-1 text-[13px] font-semibold text-ink-2">
              End date
              <input
                id={`${id}-until`}
                type="date"
                required={!undated}
                min={edit.startDate || undefined}
                value={edit.endDate}
                disabled={disabled}
                onChange={(event) => setEdit({ ...edit, endDate: event.target.value })}
                className={dateInputClass}
              />
            </label>
          </div>
        </>
      ) : null}
    </div>
  );
}

function SessionFields({ edit, base, room }: { edit: EditorState; base: ConsultSession | null; room: string }) {
  const once = !edit.recurring;
  return (
    <>
      <input type="hidden" name="id" value={base?.id ?? ""} />
      <input type="hidden" name="label" value={edit.label} />
      <input type="hidden" name="kind" value={once ? "once" : "recurring"} />
      <input type="hidden" name="onDate" value={once ? edit.date : ""} />
      <input type="hidden" name="startDate" value={once ? "" : edit.startDate} />
      <input type="hidden" name="endDate" value={once ? "" : edit.endDate} />
      {(once ? [] : edit.weekdays).map((day) => (
        <input key={day} type="hidden" name="weekdays" value={day} />
      ))}
      <input type="hidden" name="startTime" value={minutesLabel(edit.startMin)} />
      <input type="hidden" name="endTime" value={minutesLabel(edit.endMin)} />
      <input type="hidden" name="room" value={base?.room || room} />
      <input type="hidden" name="mode" value={edit.mode} />
      <input type="hidden" name="slotMinutes" value={edit.mode === "stream" ? edit.slotMinutes : ""} />
      <input type="hidden" name="waveMinutes" value={edit.mode === "wave" && edit.waveMinutes ? edit.waveMinutes : ""} />
      <input type="hidden" name="waveCapacity" value={edit.mode === "wave" ? edit.waveCapacity : ""} />
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-[28px] leading-tight font-bold text-ink tabular-nums">{value}</span>
    </div>
  );
}

function TypeButton({
  label,
  hint,
  pressed,
  palette,
  disabled,
  onClick,
  children,
}: {
  label: string;
  hint?: string;
  pressed: boolean;
  palette: Palette;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className="flex min-h-12 flex-col items-start gap-0.5 rounded-[10px] border px-3 py-2 text-left transition-colors disabled:opacity-40"
      style={{
        background: pressed ? palette.bg : "var(--v-surface-2)",
        color: pressed ? palette.fg : "var(--v-ink-2)",
        borderColor: pressed ? palette.bd : "var(--v-hairline)",
      }}
    >
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
        {children}
        {label}
      </span>
      {hint ? <span className="text-[11px] leading-tight opacity-80">{hint}</span> : null}
    </button>
  );
}

function openingEditor(sessions: ConsultSession[], visits: ScheduleVisit[], trims: SessionTrim[], today: string): EditorState | null {
  const week = buildWeek(sessions, visits, trims, weekMonday(today, 0), today);
  const item = week.days.find((day) => day.isToday)?.sessions[0] ?? week.days.flatMap((day) => day.sessions)[0] ?? null;
  return item ? editorFrom(item.session, item.key) : null;
}

function editorFrom(session: ConsultSession, key: string): EditorState {
  const date = key.slice(key.lastIndexOf("::") + 2);
  return {
    key,
    sessionId: session.id,
    date,
    label: session.label,
    mode: session.mode,
    startMin: toMinutes(session.startTime),
    endMin: toMinutes(session.endTime),
    slotMinutes: session.slotMinutes ?? 15,
    waveMinutes: session.waveMinutes,
    waveCapacity: session.waveCapacity ?? 6,
    recurring: !session.onDate,
    weekdays: session.onDate ? [weekdayIndex(date)] : [...session.weekdays],
    startDate: session.onDate ? date : (session.startDate ?? ""),
    endDate: session.onDate ? "" : (session.endDate ?? ""),
  };
}

function sameEditor(session: ConsultSession, edit: EditorState): boolean {
  return (
    session.label === edit.label &&
    session.mode === edit.mode &&
    !session.onDate === edit.recurring &&
    (edit.recurring || session.onDate === edit.date) &&
    (!edit.recurring ||
      ([...session.weekdays].sort().join(",") === [...edit.weekdays].sort().join(",") &&
        (session.startDate ?? "") === edit.startDate &&
        (session.endDate ?? "") === edit.endDate)) &&
    toMinutes(session.startTime) === edit.startMin &&
    toMinutes(session.endTime) === edit.endMin &&
    (edit.mode === "stream"
      ? (session.slotMinutes ?? 15) === edit.slotMinutes
      : session.waveMinutes === edit.waveMinutes && (session.waveCapacity ?? 6) === edit.waveCapacity)
  );
}

function toSession(edit: EditorState, base: ConsultSession | null, doctorId: string, room: string): ConsultSession {
  const once = !edit.recurring;
  return {
    id: base?.id ?? "__new__",
    doctorId: base?.doctorId ?? doctorId,
    label: edit.label,
    weekdays: once ? [] : [...edit.weekdays].sort((a, b) => a - b),
    startTime: fromMinutes(edit.startMin),
    endTime: fromMinutes(edit.endMin),
    room: base?.room || room,
    mode: edit.mode,
    slotMinutes: edit.mode === "stream" ? edit.slotMinutes : null,
    waveMinutes: edit.mode === "wave" ? edit.waveMinutes : null,
    waveCapacity: edit.mode === "wave" ? edit.waveCapacity : null,
    startDate: once ? null : edit.startDate || null,
    endDate: once ? null : edit.endDate || null,
    onDate: once ? edit.date || null : null,
    archivedAt: null,
    createdAt: base?.createdAt ?? "",
    updatedAt: base?.updatedAt ?? "",
  };
}

function toInput(edit: EditorState, base: ConsultSession | null, room: string): SessionInput {
  const once = !edit.recurring;
  return {
    label: edit.label,
    kind: once ? "once" : "recurring",
    onDate: once ? edit.date || null : null,
    startDate: once ? null : edit.startDate || null,
    endDate: once ? null : edit.endDate || null,
    weekdays: once ? [] : edit.weekdays,
    startTime: fromMinutes(edit.startMin),
    endTime: fromMinutes(edit.endMin),
    room: base?.room || room,
    mode: edit.mode,
    slotMinutes: edit.mode === "stream" ? edit.slotMinutes : null,
    waveMinutes: edit.mode === "wave" ? edit.waveMinutes : null,
    waveCapacity: edit.mode === "wave" ? edit.waveCapacity : null,
  };
}

function withDraft(sessions: readonly ConsultSession[], edit: EditorState | null, doctorId: string, room: string): ConsultSession[] {
  if (!edit) return [...sessions];
  const proposed = toSession(edit, edit.sessionId ? (sessions.find((session) => session.id === edit.sessionId) ?? null) : null, doctorId, room);
  if (!edit.sessionId) return [...sessions, proposed];
  return sessions.map((session) => (session.id === edit.sessionId ? proposed : session));
}

/** Weeks from this week to the week of `date` (Monday-based). */
function weekOffsetOf(today: string, date: string): number {
  const days = (Date.parse(`${mondayOf(date)}T00:00:00Z`) - Date.parse(`${mondayOf(today)}T00:00:00Z`)) / 86_400_000;
  return Math.round(days / 7);
}

/**
 * Where the calendar should show a draft after an edit: null when it still runs on the day it is
 * open on, else its first day from today (or its start date) within half a year.
 */
function locateDraft(
  sessions: readonly ConsultSession[],
  visits: readonly ScheduleVisit[],
  trims: readonly SessionTrim[],
  edit: EditorState,
  doctorId: string,
  room: string,
  today: string,
): { key: string; date: string; offset: number } | null {
  const id = edit.sessionId ?? "__new__";
  const roster = withDraft(sessions, edit, doctorId, room);
  const shownOn = (date: string) =>
    buildWeek(roster, visits, trims, mondayOf(date), today)
      .days.find((day) => day.date === date)
      ?.sessions.some((item) => item.key === `${id}::${date}`) ?? false;
  if (!edit.recurring) {
    if (!isIsoDate(edit.date) || edit.key === `${id}::${edit.date}`) return null;
    return { key: `${id}::${edit.date}`, date: edit.date, offset: weekOffsetOf(today, edit.date) };
  }
  if (isIsoDate(edit.date) && edit.key === `${id}::${edit.date}` && shownOn(edit.date)) return null;
  const from = isIsoDate(edit.startDate) && edit.startDate > today ? edit.startDate : today;
  for (let week = 0; week < 26; week += 1) {
    const monday = addDays(mondayOf(from), week * 7);
    const day = buildWeek(roster, visits, trims, monday, today)
      .days.find((item) => item.date >= from && item.sessions.some((session) => session.key === `${id}::${item.date}`));
    if (day) return { key: `${id}::${day.date}`, date: day.date, offset: weekOffsetOf(today, day.date) };
  }
  return null;
}

function blockPlaces(session: ConsultSession): number {
  const places = session.mode === "wave" ? Math.max(1, session.waveCapacity ?? 1) : 1;
  return sessionBlocks(session).length * places;
}

function placesWord(count: number): string {
  return `${count} ${count === 1 ? "place" : "places"}`;
}

function edgeNote(deltaMinutes: number, edit: EditorState, edge: "start" | "end"): string {
  if (deltaMinutes === 0) return "";
  const minutes = Math.abs(deltaMinutes);
  const when = `${minutes} min ${deltaMinutes < 0 ? "earlier" : "later"}`;
  if (edit.mode === "wave" && !edit.waveMinutes) return when;
  const step = edit.mode === "stream" ? edit.slotMinutes : (edit.waveMinutes ?? 1);
  const blocks = Math.max(1, Math.round(minutes / step));
  const places = blocks * (edit.mode === "wave" ? edit.waveCapacity : 1);
  const adds = edge === "start" ? deltaMinutes < 0 : deltaMinutes > 0;
  return `${when} · ${adds ? "adds" : "removes"} ${placesWord(places)}`;
}

function sliderGrid(anchor: number, step: number): { min: number; max: number } {
  const rem = ((anchor - CLINIC_START) % step + step) % step;
  const min = CLINIC_START + rem;
  const max = min + Math.floor((CLINIC_END - min) / step) * step;
  return { min, max };
}

function streamChoices(current: number): { label: string; value: number }[] {
  const values = new Set<number>(STREAM_SLOT_MINUTES);
  values.add(current);
  return [...values].sort((a, b) => a - b).map((value) => ({ label: `${value} min`, value }));
}

function waveChoices(current: number | null): { label: string; value: number | null }[] {
  const values = new Set<number>(WAVE_MINUTES);
  if (current) values.add(current);
  return [{ label: "Whole session", value: null }, ...[...values].sort((a, b) => a - b).map((value) => ({ label: `${value} min`, value }))];
}

function snapInterval(edit: EditorState, value: number | null): EditorState {
  if (edit.mode === "stream" && value) {
    const units = Math.max(1, Math.round((edit.endMin - edit.startMin) / value));
    const endMin = Math.min(CLINIC_END, edit.startMin + units * value);
    return { ...edit, slotMinutes: value, endMin: Math.max(edit.startMin + value, endMin) };
  }
  if (!value) return { ...edit, waveMinutes: null };
  const units = Math.max(1, Math.round((edit.endMin - edit.startMin) / value));
  const endMin = Math.min(CLINIC_END, edit.startMin + units * value);
  return { ...edit, waveMinutes: value, endMin: Math.max(edit.startMin + value, endMin) };
}

function occupying(visits: readonly ScheduleVisit[]) {
  return visits
    .filter((visit) => holdsPlace(visit.status))
    .map((visit) => ({ date: visit.date, time: visit.time, endTime: visit.endTime, sessionId: visit.sessionId }));
}

function bannerToneClass(tone: "info" | "warn"): string {
  return tone === "warn"
    ? "border-warn/35 bg-warn-soft text-ink"
    : "border-accent/25 bg-accent-soft text-ink";
}

const iconButton =
  "inline-flex size-11 items-center justify-center rounded-[10px] border border-hairline bg-surface-2 text-ink transition-colors hover:border-control hover:bg-fill disabled:opacity-40";
const textButton =
  "inline-flex min-h-11 items-center justify-center rounded-[10px] border border-hairline bg-surface-2 text-sm font-semibold text-ink transition-colors hover:border-control hover:bg-fill";
const solidButton =
  "inline-flex min-h-11 items-center justify-center rounded-[10px] border border-transparent bg-ink px-4 text-sm font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-40";
const choiceButton = (on: boolean) =>
  on
    ? "border-ink bg-ink text-canvas"
    : "border-hairline bg-surface-2 text-ink-2 hover:border-control hover:bg-fill hover:text-ink";

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d={direction === "left" ? "M10 3L5 8l5 5" : "M6 3l5 5-5 5"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function StreamIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
      <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="3" cy="8" r="1.8" fill="currentColor" />
      <circle cx="8" cy="8" r="1.8" fill="currentColor" />
      <circle cx="13" cy="8" r="1.8" fill="currentColor" />
    </svg>
  );
}

function WaveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="4" cy="4" r="1.5" fill="currentColor" />
      <circle cx="4" cy="8" r="1.5" fill="currentColor" />
      <circle cx="4" cy="12" r="1.5" fill="currentColor" />
      <circle cx="12" cy="4" r="1.5" fill="currentColor" />
      <circle cx="12" cy="8" r="1.5" fill="currentColor" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="shrink-0 text-muted">
      <path d="M11 2.5l2.5 2.5L5.5 13H3v-2.5L11 2.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
    </svg>
  );
}
