"use client";

import Link from "next/link";
import { useActionState, useMemo, useState, type ReactNode } from "react";
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
  sessionBlocks,
  STREAM_SLOT_MINUTES,
  toMinutes,
  WAVE_MINUTES,
  WEEKDAY_NAMES,
  type SessionInput,
} from "@/lib/sessions";
import { archiveSession, saveSession } from "@/server/profile-actions";
import { updateVisit } from "@/server/booking-actions";
import {
  buildWeek,
  CLINIC_END,
  CLINIC_START,
  clinicWeekday,
  firstFreeHour,
  holdsPlace,
  HOUR_PX,
  minutesLabel,
  occurrenceLabel,
  sessionIsPast,
  todayTitle,
  weekMonday,
  weekTag,
  weekTitle,
  type DaySession,
  type ScheduleVisit,
} from "./schedule-model";

const STREAM = { bg: "#E3F0F8", bd: "#0B6E99", fg: "#083F59", dot: "#0B6E99", soft: "#F7FBFD" };
const WAVE = { bg: "#FDF0E0", bd: "#B45309", fg: "#64300A", dot: "#B45309", soft: "#FFFAF3" };

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

  function addNew() {
    const date = week.days.map((day) => day.date).find((day) => day >= today) ?? null;
    if (!date || !clinicWeekday(date)) {
      setHint("This week is over. Move to a later week to add a session.");
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
    setHint(`A one-hour stream is ready at ${minutesLabel(start)}. Set when it ends, switch it to a wave, or rename it, then apply.`);
  }

  const util = week.capacity ? Math.round((100 * week.booked) / week.capacity) : 0;
  const banner = saveState && !saveState.ok ? saveState.message : (hint ?? notice);
  const bannerWarn = Boolean((saveState && !saveState.ok) || hint);

  return (
    <div className="bg-[#F4F6F5] text-[#14201F]">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-5 px-4 py-6 md:px-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <PageHeading className="text-[28px] leading-tight font-bold tracking-tight">Schedule</PageHeading>
            <p className="mt-1.5 text-sm text-[#4F605C]">
              {doctorName} · Outpatient clinic · {todayTitle(today)}
            </p>
          </div>
          {editHref ? (
            <Link
              href={editHref}
              className="inline-flex min-h-11 items-center rounded-[10px] bg-[#14201F] px-4 text-sm font-semibold text-white"
            >
              Edit schedule
            </Link>
          ) : null}
        </header>

        {banner ? (
          <div
            role={bannerWarn ? "alert" : "status"}
            className="rounded-[10px] border px-3 py-2.5 text-[13px] leading-snug"
            style={
              bannerWarn
                ? { background: "#FFF1DC", color: "#5E2C05", borderColor: "#E3B079" }
                : { background: "#E3F0F8", color: "#083F59", borderColor: "#9CC9DE" }
            }
          >
            {banner}
          </div>
        ) : null}

        <section aria-label="Week summary" className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col justify-center gap-2 rounded-xl border border-[#E3E8E6] bg-white p-4">
            <span className="text-xs font-semibold tracking-wider text-[#4F605C] uppercase">Booked this week</span>
            <span className="flex items-baseline gap-2">
              <span className="text-[30px] leading-none font-bold tabular-nums">{week.booked}</span>
              <span className="text-sm text-[#4F605C]">
                of {week.capacity} places · {util}%
              </span>
            </span>
            <div className="h-2 max-w-sm rounded-[3px] bg-[#E3E8E6]">
              <div className="h-2 rounded-[3px] bg-[#14201F]" style={{ width: `${util}%` }} />
            </div>
          </div>
        </section>

        <div className="flex flex-wrap items-start gap-5">
          <div className="flex min-w-0 flex-[999_1_640px] flex-col gap-5">
            <Calendar
              week={week}
              monday={monday}
              weekOffset={weekOffset}
              nowMinutes={nowMinutes}
              selectedKey={edit?.key ?? null}
              onSelect={choose}
              onWeek={setWeekOffset}
            />
            {selected ? (
              <Appointments
                selected={selected}
                today={today}
                returnTo={returnTo}
                openVisitId={openVisitId}
                setOpenVisitId={setOpenVisitId}
              />
            ) : null}
          </div>
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
            saveAction={saveAction}
            saveState={saveState}
          />
        </div>
      </div>
    </div>
  );
}

function Calendar({
  week,
  monday,
  weekOffset,
  nowMinutes,
  selectedKey,
  onSelect,
  onWeek,
}: {
  week: ReturnType<typeof buildWeek>;
  monday: string;
  weekOffset: number;
  nowMinutes: number;
  selectedKey: string | null;
  onSelect: (item: DaySession) => void;
  onWeek: (offset: number) => void;
}) {
  const hours = [];
  for (let hour = 8; hour < 18; hour += 1) hours.push(minutesLabel(hour * 60));
  const columnHeight = ((CLINIC_END - CLINIC_START) / 60) * HOUR_PX;

  return (
    <section aria-label="Weekly calendar" className="w-full min-w-0 overflow-hidden rounded-[14px] border border-[#E3E8E6] bg-white">
      <div className="flex flex-wrap items-center gap-2 p-4">
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
          <span className="text-base font-bold">{weekTitle(monday)}</span>
          <span className="text-xs text-[#4F605C]">{weekTag(weekOffset)}</span>
        </div>
      </div>
      <div className="overflow-x-auto border-t border-[#E3E8E6]">
        <div className="min-w-[780px]">
          <div className="grid grid-cols-[56px_repeat(6,minmax(0,1fr))]">
            <div className="border-b border-[#E3E8E6]" />
            {week.days.map((day) => (
              <div key={day.date} className="flex flex-col gap-1 border-b border-l border-[#E3E8E6] px-2 pt-2 pb-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold tracking-wider text-[#4F605C] uppercase">{day.dow}</span>
                  <span
                    className="inline-flex h-[26px] min-w-[26px] items-center justify-center rounded-[13px] text-sm font-bold"
                    style={{ background: day.isToday ? "#14201F" : "transparent", color: day.isToday ? "#FFFFFF" : "#14201F" }}
                  >
                    {day.num}
                  </span>
                </div>
                <span className="text-xs text-[#4F605C] tabular-nums">{day.summary}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-[56px_repeat(6,minmax(0,1fr))]">
            <div>
              {hours.map((label) => (
                <div key={label} className="box-border h-16 pr-2 pt-0.5 text-right text-[11px] text-[#5B6B68] tabular-nums">
                  {label}
                </div>
              ))}
            </div>
            {week.days.map((day) => (
              <div
                key={day.date}
                className="relative border-l border-[#E3E8E6]"
                style={{
                  height: columnHeight,
                  backgroundColor: day.isToday ? "#F7FAF9" : "#FFFFFF",
                  backgroundImage: "repeating-linear-gradient(to bottom, #E3E8E6 0, #E3E8E6 1px, transparent 1px, transparent 64px)",
                }}
              >
                {day.sessions.map((item) => (
                  <SessionBlock key={item.key} item={item} selected={item.key === selectedKey} onSelect={onSelect} />
                ))}
                {day.isToday && nowMinutes >= CLINIC_START && nowMinutes <= CLINIC_END ? (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute right-0 left-0 h-0.5 bg-[#14201F]"
                    style={{ top: ((nowMinutes - CLINIC_START) * HOUR_PX) / 60 }}
                  />
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function SessionBlock({ item, selected, onSelect }: { item: DaySession; selected: boolean; onSelect: (item: DaySession) => void }) {
  const palette = item.session.mode === "wave" ? WAVE : STREAM;
  const height = Math.max(44, ((item.endMin - item.startMin) * HOUR_PX) / 60 - 2);
  const top = ((item.startMin - CLINIC_START) * HOUR_PX) / 60 + 1;
  const many = item.lanes > 1;
  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      aria-pressed={selected}
      aria-label={`${item.session.label || (item.session.mode === "wave" ? "Wave" : "Stream")}, ${item.session.mode} session, ${minutesLabel(item.startMin)} to ${minutesLabel(item.endMin)}, ${item.booked} of ${item.capacity} booked`}
      className="absolute box-border flex flex-col gap-1 overflow-hidden rounded-lg border px-1.5 py-1.5 text-left"
      style={{
        top,
        height,
        left: many ? `calc(${(item.lane * 100) / item.lanes}% + 3px)` : 3,
        right: many ? undefined : 3,
        width: many ? `calc(${100 / item.lanes}% - 6px)` : undefined,
        background: palette.bg,
        borderColor: palette.bd,
        color: palette.fg,
        boxShadow: selected ? "0 0 0 2px #14201F" : "0 1px 0 rgba(20,32,31,0.08)",
      }}
    >
      <span className="flex items-center justify-between gap-1 text-xs font-bold">
        <span className="inline-flex items-center gap-1">
          {item.session.mode === "wave" ? <WaveIcon /> : <StreamIcon />}
          {item.session.mode === "wave" ? "Wave" : "Stream"}
        </span>
        <span className="tabular-nums">
          {item.booked}/{item.capacity}
        </span>
      </span>
      {height >= 100 ? <span className="truncate text-xs font-semibold">{item.session.label}</span> : null}
      <span className="text-[11px] font-medium tabular-nums">
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
              border: `1px solid ${item.session.mode === "wave" ? palette.bd : "transparent"}`,
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
  saveAction: (formData: FormData) => void;
  saveState: FormState;
}) {
  const { edit, selected, base, editable, past, saveState } = props;
  if (!edit) {
    return (
      <aside aria-label="Session editor" className="min-w-0 flex-[1_1_380px] overflow-hidden rounded-[14px] border border-[#E3E8E6] bg-white">
        <div className="flex flex-col gap-2 p-6">
          <span className="text-base font-bold">No session selected</span>
          <span className="text-sm leading-normal text-[#4F605C]">
            Pick a session in the calendar to see its type, capacity and appointments
            {editable ? ", or add a new one" : ""}.
          </span>
          {editable ? (
            <button type="button" onClick={props.onAdd} className={`${solidButton} mt-2 self-start`}>
              Add session
            </button>
          ) : null}
        </div>
      </aside>
    );
  }

  const palette = edit.mode === "wave" ? WAVE : STREAM;
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
  const blocked = past || !checked.ok || Boolean(plan && !plan.ok);
  const displacing = !blocked && dirty && affected.length > 0;
  const displaceCount = saveState?.displace?.count ?? affected.length;
  const canApply = editable && dirty && !blocked && !displacing;

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
  } else if (plan && !plan.ok) {
    planTitle = "That overlaps another session";
    planLines = [plan.message];
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

  return (
    <aside aria-label="Session editor" className="min-w-0 flex-[1_1_380px] overflow-hidden rounded-[14px] border border-[#E3E8E6] bg-white">
      <div className="border-b border-[#E3E8E6] p-4">
        <span className="text-xs font-semibold tracking-wider text-[#4F605C] uppercase">Edit session</span>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            aria-label="Session name"
            value={edit.label}
            disabled={!editable || past}
            onChange={(event) => props.setEdit({ ...edit, label: event.target.value.slice(0, 60) })}
            className="h-11 w-full rounded-[10px] border border-[#C9D2CF] bg-white px-3 text-base font-semibold text-[#14201F]"
          />
          {editable && base ? (
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
                className="min-h-11 max-w-[140px] rounded-[10px] border border-[#8C1D18] bg-[#8C1D18] px-3 text-[13px] font-semibold text-white"
              >
                {props.confirmDelete ? (reserved.length === 0 ? "Confirm delete" : "Delete anyway…") : "Delete session"}
              </button>
            </form>
          ) : null}
          {editable ? (
            <button type="button" onClick={props.onAdd} className={`${solidButton} w-[115px] shrink-0`}>
              Add session
            </button>
          ) : null}
        </div>
        <div className="mt-2 text-[13px] text-[#4F605C] tabular-nums">
          {selected ? occurrenceLabel(selected.session, selected.date) : edit.date ? occurrenceLabel(proposed, edit.date) : "Choose a date"} ·{" "}
          {minutesLabel(edit.startMin)}–{minutesLabel(edit.endMin)}
        </div>
        {!selected ? (
          <p className="mt-2 rounded-[10px] border border-[#9CC9DE] bg-[#E3F0F8] px-3 py-2 text-[13px] leading-snug text-[#083F59]">
            {checked.ok ? "This session isn’t on the calendar for these dates yet. Check its days and dates." : checked.message}
          </p>
        ) : null}
        {editable ? <RepeatFields edit={edit} setEdit={props.setEdit} disabled={past} undated={keepOpenRange} today={props.today} /> : null}
        <fieldset className="mt-3 border-0 p-0">
          <legend className="sr-only">Scheduling type</legend>
          <div className="flex gap-2">
          <TypeButton
            label="Stream"
            pressed={edit.mode === "stream"}
            palette={STREAM}
            disabled={!editable || past}
            onClick={() => props.setEdit({ ...edit, mode: "stream", waveMinutes: null })}
          >
            <StreamIcon />
          </TypeButton>
          <TypeButton
            label="Wave"
            pressed={edit.mode === "wave"}
            palette={WAVE}
            disabled={!editable || past}
            onClick={() => props.setEdit({ ...edit, mode: "wave", waveCapacity: edit.waveCapacity || 3 })}
          >
            <WaveIcon />
          </TypeButton>
          </div>
        </fieldset>
        <p className="mt-2.5 text-[13px] leading-normal text-[#4F605C]">
          {edit.mode === "wave"
            ? "Several patients share a start time and are seen in token order. Drag Starts or Ends to lengthen or shorten the wave."
            : "One patient per slot, evenly spaced. Drag Starts or Ends to add or remove slots."}
        </p>
      </div>

      <form id="schedule-save" action={props.saveAction} className="contents">
        <SessionFields edit={edit} base={base} room={props.room} />
        <div className="border-b border-[#E3E8E6] p-4">
          <div className="flex items-end gap-6">
            <Stat label="Booked" value={shownBooked} />
            <Stat label="Capacity" value={shownCapacity} />
            <Stat label="Open" value={Math.max(0, shownCapacity - shownBooked)} />
          </div>
          <div className="mt-3 h-2 rounded bg-[#E3E8E6]">
            <div
              className="h-2 rounded"
              style={{ width: `${shownCapacity ? Math.round((100 * shownBooked) / shownCapacity) : 0}%`, background: palette.dot }}
            />
          </div>

          {editable ? (
            <div className="mt-4 flex flex-col gap-4">
              <Slider
                label="Starts"
                text={`Starts at ${minutesLabel(edit.startMin)}`}
                value={edit.startMin}
                min={grid.min}
                max={Math.max(grid.min, edit.endMin - step)}
                step={step}
                disabled={past || edit.endMin - step <= grid.min}
                note={startNote}
                color={palette.dot}
                onChange={(startMin) => props.setEdit({ ...edit, startMin: Math.min(startMin, edit.endMin - step) })}
              />
              <Slider
                label="Ends"
                text={`Ends at ${minutesLabel(edit.endMin)}`}
                value={edit.endMin}
                min={Math.min(grid.max, edit.startMin + step)}
                max={grid.max}
                step={step}
                disabled={past || grid.max <= edit.startMin + step}
                note={endNote}
                color={palette.dot}
                onChange={(endMin) => props.setEdit({ ...edit, endMin: Math.max(endMin, edit.startMin + step) })}
              />
              <div className="text-[13px] font-semibold tabular-nums">
                {base
                  ? `${base.startTime}–${base.endTime} → ${minutesLabel(edit.startMin)}–${minutesLabel(edit.endMin)} · capacity ${oldPlaces} → ${newPlaces}${delta === 0 ? "" : ` (${delta > 0 ? "+" : "−"}${Math.abs(delta)})`}`
                  : `Window ${minutesLabel(edit.startMin)}–${minutesLabel(edit.endMin)} · capacity ${newPlaces}`}
              </div>
              <div className="rounded-[10px] border px-3 py-2.5 text-[13px] leading-snug" style={planStyle(planTone)}>
                <p className="font-bold">{planTitle}</p>
                {planLines.map((line) => (
                  <p key={line} className="mt-1">
                    {line}
                  </p>
                ))}
              </div>
              {displacing ? (
                <div className="flex flex-col gap-2 rounded-[10px] border border-[#E3B079] bg-[#FFF1DC] p-3 text-[13px] text-[#5E2C05]">
                  <label htmlFor="schedule-displace-reason" className="font-semibold">
                    Message for the patients <span className="font-normal">(optional)</span>
                  </label>
                  <input
                    id="schedule-displace-reason"
                    name="displaceReason"
                    maxLength={200}
                    placeholder="For example: I am needed in theatre that morning."
                    className="h-11 rounded-[10px] border border-[#C9D2CF] bg-white px-3 text-sm text-[#14201F]"
                  />
                  <input type="hidden" name="displaceCount" value={displaceCount} />
                  <PendingButton
                    name="displace"
                    value="confirm"
                    pendingLabel="Notifying…"
                    className="min-h-11 rounded-[10px] bg-[#8C1D18] px-3.5 text-sm font-semibold text-white"
                  >
                    {`Apply and notify ${displaceCount === 1 ? "1 patient" : `${displaceCount} patients`} with new times`}
                  </PendingButton>
                </div>
              ) : null}
              {dirty ? (
                <div className="flex flex-wrap gap-2">
                  <PendingButton
                    pendingLabel="Applying…"
                    disabled={!canApply}
                    className="min-h-11 flex-[1_1_180px] rounded-[10px] px-3.5 text-sm font-semibold text-white disabled:opacity-50"
                    style={{ background: canApply ? "#14201F" : "#8A938F", border: "1px solid transparent" }}
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
                    className={`${textButton} border-[#14201F] px-4`}
                  >
                    Reset
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-[13px] leading-normal text-[#4F605C]">
              {base ? `${base.startTime}–${base.endTime} · ${base.room}` : null}
            </p>
          )}
        </div>

        {editable ? (
          <div className="flex flex-col gap-3.5 border-b border-[#E3E8E6] p-4">
            <fieldset className="border-0 p-0">
              <legend className="text-sm font-semibold">{edit.mode === "wave" ? "Wave interval" : "Slot length"}</legend>
              <div className="mt-2 flex gap-1.5">
                {(edit.mode === "wave" ? waveChoices(edit.waveMinutes) : streamChoices(edit.slotMinutes)).map((choice) => {
                  const on = edit.mode === "wave" ? edit.waveMinutes === choice.value : edit.slotMinutes === choice.value;
                  return (
                    <button
                      key={choice.label}
                      type="button"
                      aria-pressed={on}
                      disabled={past}
                      onClick={() => props.setEdit(snapInterval(edit, choice.value))}
                      className="min-h-11 flex-1 rounded-[10px] border text-[13px] font-semibold disabled:opacity-40"
                      style={{
                        borderColor: "#14201F",
                        background: on ? "#14201F" : "#FFFFFF",
                        color: on ? "#FFFFFF" : "#14201F",
                      }}
                    >
                      {choice.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            {edit.mode === "wave" ? (
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold">Patients per wave</span>
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
                  <span className="min-w-14 text-center text-base font-bold tabular-nums">{edit.waveCapacity}</span>
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
      </form>
    </aside>
  );
}

function Appointments({
  selected,
  today,
  returnTo,
  openVisitId,
  setOpenVisitId,
}: {
  selected: DaySession;
  today: string;
  returnTo: string;
  openVisitId: string | null;
  setOpenVisitId: (id: string | null) => void;
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
  return (
    <section aria-labelledby="schedule-appointments" className="w-full rounded-[14px] border border-[#E3E8E6] bg-white">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 pt-4 pb-2">
        <h2 id="schedule-appointments" className="text-base font-bold">
          Appointments
          <span className="ml-2 text-[13px] font-normal text-[#4F605C]">
            {selected.session.label || "Session"} · {occurrenceLabel(selected.session, selected.date)}
          </span>
        </h2>
        <span className="text-[13px] text-[#4F605C] tabular-nums">
          {selected.booked} booked · {open} open
        </span>
      </div>
      <div className="flex flex-col gap-3 px-4 pb-4">
        {selected.outside.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <p className="rounded-[10px] border border-[#E3B079] bg-[#FFF1DC] px-3 py-2 text-[13px] leading-snug text-[#5E2C05]">
              {selected.outside.length === 1 ? "1 visit sits" : `${selected.outside.length} visits sit`} outside these hours and{" "}
              {selected.outside.length === 1 ? "keeps its" : "keep their"} original time.
            </p>
            <div className="grid gap-1.5 md:grid-cols-2">{selected.outside.map((visit) => row(visit, visit.time))}</div>
          </div>
        ) : null}
        {selected.blocks.map((block, index) => {
          const taken = block.seats.filter((seat) => seat.visit);
          const free = block.seats.filter((seat) => !seat.visit);
          return (
            <div key={block.time} className="flex flex-col gap-1.5">
              {wave ? (
                <div className="flex items-center justify-between px-0.5 pt-1 text-xs font-bold tracking-wide text-[#64300A] uppercase tabular-nums">
                  <span>
                    Wave {index + 1} · {block.time}
                  </span>
                  <span>
                    {taken.length}/{block.places}
                  </span>
                </div>
              ) : null}
              {taken.length > 0 ? (
                <div className="grid gap-1.5 md:grid-cols-2">
                  {taken.map((seat) => row(seat.visit!, wave ? `Seat ${seat.seat}` : block.time))}
                </div>
              ) : null}
              {free.length > 0 && wave ? (
                <ul aria-label={`Open seats in wave ${index + 1}`} className="flex flex-wrap gap-1.5">
                  {free.map((seat) => (
                    <li
                      key={`${block.time}-${seat.seat}`}
                      className="inline-flex min-h-8 items-center rounded-full border border-dashed border-[#9AA8A4] px-2.5 text-xs text-[#4F605C] tabular-nums"
                    >
                      Seat {seat.seat} · open
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          );
        })}
        {!wave && selected.blocks.some((block) => block.seats.some((seat) => !seat.visit)) ? (
          <div className="flex flex-col gap-1.5">
            <span className="px-0.5 text-xs font-bold tracking-wide text-[#4F605C] uppercase">Open slots</span>
            <ul aria-label="Open slots" className="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-1.5">
              {selected.blocks
                .filter((block) => block.seats.some((seat) => !seat.visit))
                .map((block) => (
                  <li
                    key={block.time}
                    className="inline-flex min-h-8 items-center justify-center rounded-full border border-dashed border-[#9AA8A4] text-xs text-[#4F605C] tabular-nums"
                  >
                    {block.time}
                  </li>
                ))}
            </ul>
          </div>
        ) : null}
        {selected.blocks.length === 0 && selected.outside.length === 0 ? (
          <p className="text-[13px] text-[#4F605C]">No places in this session.</p>
        ) : null}
      </div>
    </section>
  );
}

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
    <div className="overflow-hidden rounded-[10px] border" style={{ borderColor: open ? "#14201F" : "#E3E8E6", background: open ? "#F7F9F8" : "#FFFFFF" }}>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex min-h-12 w-full items-center gap-2.5 bg-transparent px-3 py-1.5 text-left"
      >
        <span className="min-w-[52px] text-[13px] text-[#4F605C] tabular-nums">{lead}</span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-semibold">{visit.patientName}</span>
          <span className="text-xs text-[#4F605C]">
            {visit.reason}
            {visit.status === "completed" ? " · Completed" : visit.status === "pending_payment" ? " · Awaiting payment" : ""}
          </span>
        </span>
        <PencilIcon />
      </button>
      {open ? (
        <div className="flex flex-col gap-3 border-t border-[#E3E8E6] bg-white p-3">
          <p className="text-[13px] text-[#4F605C]">
            Reference <span className="font-semibold text-[#14201F] tabular-nums">{visit.reference}</span>
            {visit.token ? (
              <>
                {" "}
                · Token <span className="font-semibold text-[#14201F] tabular-nums">{visit.token}</span>
              </>
            ) : null}
          </p>
          {confirmCancel ? (
            <form
              action={updateVisit}
              role="alert"
              aria-labelledby={`cancel-${visit.id}`}
              className="flex flex-col gap-2 rounded-[10px] border border-[#B3261E] bg-[#FDECEA] p-3 text-[13px] text-[#8C1D18]"
            >
              <p id={`cancel-${visit.id}`} className="font-semibold">
                Cancel {visit.patientName}&rsquo;s appointment on {formatShortDate(visit.date)} at {visit.time}?
              </p>
              <p>The place opens for others and the patient is told. A paid visit is refunded.</p>
              <input type="hidden" name="id" value={visit.id} />
              <input type="hidden" name="status" value="cancelled" />
              <input type="hidden" name="return" value={returnTo} />
              <div className="flex gap-2">
                <PendingButton pendingLabel="Cancelling…" className="min-h-11 flex-1 rounded-[10px] bg-[#8C1D18] text-[13px] font-semibold text-white">
                  Yes, cancel it
                </PendingButton>
                <button
                  type="button"
                  onClick={() => setConfirmCancel(false)}
                  className="min-h-11 flex-1 rounded-[10px] border border-[#14201F] bg-white text-[13px] font-semibold text-[#14201F]"
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
                className="min-h-11 flex-1 rounded-[10px] border border-[#B3261E] bg-[#FDECEA] text-[13px] font-semibold text-[#8C1D18]"
              >
                Cancel appointment
              </button>
            ) : null}
            {visit.status === "booked" ? (
              <form action={updateVisit} className="flex-1">
                <input type="hidden" name="id" value={visit.id} />
                <input type="hidden" name="status" value="completed" />
                <input type="hidden" name="return" value={returnTo} />
                <PendingButton pendingLabel="Saving…" className="min-h-11 w-full rounded-[10px] border border-[#14201F] bg-white text-[13px] font-semibold text-[#14201F]">
                  Mark complete
                </PendingButton>
              </form>
            ) : null}
          </div>
          <div className="flex gap-2">
            {upcoming ? (
              <Link
                href={`/reschedule/${visit.id}?return=${encodeURIComponent(returnTo)}`}
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-[10px] border border-[#C9D2CF] bg-[#F7F9F8] text-[13px] font-semibold"
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
  return (
    <div className="mt-3 flex flex-col gap-2.5">
      <label htmlFor={`${id}-on`} className="inline-flex min-h-11 items-center gap-2.5 text-sm font-semibold">
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
          className="size-5 accent-[#14201F]"
        />
        Recurring every week
      </label>
      {!edit.recurring ? (
        <label htmlFor={`${id}-date`} className="flex flex-col gap-1 text-[13px] font-semibold">
          Date
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
            className="h-11 rounded-[10px] border border-[#C9D2CF] bg-white px-2 text-sm font-normal text-[#14201F] tabular-nums"
          />
        </label>
      ) : null}
      {edit.recurring ? (
        <>
          <fieldset className="border-0 p-0">
            <legend className="text-[13px] font-semibold">Days</legend>
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
                    className="min-h-11 min-w-11 rounded-[10px] border px-2 text-[13px] font-semibold disabled:opacity-40"
                    style={{ borderColor: "#14201F", background: on ? "#14201F" : "#FFFFFF", color: on ? "#FFFFFF" : "#14201F" }}
                  >
                    {name.slice(0, 3)}
                  </button>
                );
              })}
            </div>
          </fieldset>
          {undated && !edit.startDate && !edit.endDate ? (
            <p className="rounded-[10px] border border-[#9CC9DE] bg-[#E3F0F8] px-3 py-2 text-[13px] leading-snug text-[#083F59]">
              This weekly session has no start or end date. Add both so patients see when it runs.
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <label htmlFor={`${id}-from`} className="flex flex-col gap-1 text-[13px] font-semibold">
              Start date
              <input
                id={`${id}-from`}
                type="date"
                required={!undated}
                value={edit.startDate}
                disabled={disabled}
                onChange={(event) => setEdit({ ...edit, startDate: event.target.value })}
                className="h-11 rounded-[10px] border border-[#C9D2CF] bg-white px-2 text-sm font-normal text-[#14201F] tabular-nums"
              />
            </label>
            <label htmlFor={`${id}-until`} className="flex flex-col gap-1 text-[13px] font-semibold">
              End date
              <input
                id={`${id}-until`}
                type="date"
                required={!undated}
                min={edit.startDate || undefined}
                value={edit.endDate}
                disabled={disabled}
                onChange={(event) => setEdit({ ...edit, endDate: event.target.value })}
                className="h-11 rounded-[10px] border border-[#C9D2CF] bg-white px-2 text-sm font-normal text-[#14201F] tabular-nums"
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

function Slider({
  label,
  text,
  value,
  min,
  max,
  step,
  disabled,
  note,
  color,
  onChange,
}: {
  label: string;
  text: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled: boolean;
  note: string;
  color: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-[22px] leading-none font-bold tabular-nums">{minutesLabel(value)}</span>
      </div>
      <input
        type="range"
        aria-label={label === "Starts" ? "Session start time" : "Session end time"}
        aria-valuetext={text}
        min={min}
        max={max}
        step={step}
        value={Math.min(max, Math.max(min, value))}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="m-0 h-11 w-full"
        style={{ accentColor: color }}
      />
      <div className="flex justify-between gap-2 text-xs text-[#4F605C] tabular-nums">
        <span>{minutesLabel(min)}</span>
        <span className="text-center font-semibold text-[#14201F]">{note}</span>
        <span>{minutesLabel(max)}</span>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-[#4F605C]">{label}</span>
      <span className="text-[28px] leading-tight font-bold tabular-nums">{value}</span>
    </div>
  );
}

function TypeButton({
  label,
  pressed,
  palette,
  disabled,
  onClick,
  children,
}: {
  label: string;
  pressed: boolean;
  palette: typeof STREAM;
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
      className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-[10px] border text-sm font-semibold disabled:opacity-40"
      style={{
        background: pressed ? palette.bg : "#FFFFFF",
        color: pressed ? palette.fg : "#14201F",
        borderColor: pressed ? palette.bd : "#C9D2CF",
      }}
    >
      {children}
      {label}
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
  if (deltaMinutes === 0) return edge === "start" ? "Original start" : "Original end";
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

function planStyle(tone: "info" | "warn"): { background: string; color: string; borderColor: string } {
  return tone === "warn"
    ? { background: "#FFF1DC", color: "#5E2C05", borderColor: "#E3B079" }
    : { background: "#E3F0F8", color: "#083F59", borderColor: "#9CC9DE" };
}

const iconButton =
  "inline-flex size-11 items-center justify-center rounded-[10px] border border-[#C9D2CF] bg-white text-[#14201F] disabled:opacity-40";
const textButton =
  "inline-flex min-h-11 items-center justify-center rounded-[10px] border border-[#C9D2CF] bg-white text-sm font-semibold text-[#14201F]";
const solidButton =
  "inline-flex min-h-11 items-center justify-center rounded-[10px] border border-[#14201F] bg-[#14201F] px-4 text-sm font-semibold text-white";

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
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="shrink-0 text-[#4F605C]">
      <path d="M11 2.5l2.5 2.5L5.5 13H3v-2.5L11 2.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
    </svg>
  );
}
