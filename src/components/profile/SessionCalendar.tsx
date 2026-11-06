"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ConsultSession } from "@/lib/clinic-types";
import { addDays, mondayOf } from "@/lib/clock";
import {
  firstRunDate,
  sessionCalendar,
  sessionRunsOn,
  shortDate,
  timesLookSet,
  toMinutes,
  weekHourBounds,
  weekRangeTitle,
} from "@/lib/sessions";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const HOUR_PX = 60;
const HEAD_PX = 56;
const DRAFT_ID = "__draft__";

function barLabel(session: ConsultSession, draft: boolean): string {
  const name = draft ? `New ${session.mode === "wave" ? "Wave" : "Stream"}` : session.label || (session.mode === "wave" ? "Wave" : "Stream");
  const kind = session.onDate ? "One date" : "Weekly";
  return `${name} ${session.startTime}–${session.endTime} (${kind})`;
}

function draftKey(draft: ConsultSession | null): string {
  if (!draft) return "";
  return JSON.stringify({
    weekdays: draft.weekdays,
    startDate: draft.startDate,
    endDate: draft.endDate,
    onDate: draft.onDate,
    startTime: draft.startTime,
    endTime: draft.endTime,
    mode: draft.mode,
  });
}

/**
 * Compact week preview of when the doctor's sessions run. One-off sessions replace weekly ones
 * on their date (shown struck through). The session being added appears as a dashed draft bar.
 */
export function SessionCalendar({
  sessions,
  draft = null,
  today,
}: {
  sessions: readonly ConsultSession[];
  /** The session being added, previewed live (dashed outline). */
  draft?: ConsultSession | null;
  today: string;
}) {
  const thisMonday = mondayOf(today);
  const [weekOffset, setWeekOffset] = useState(0);
  const monday = addDays(thisMonday, weekOffset * 7);
  const sunday = addDays(monday, 6);

  const valid = Boolean(draft && timesLookSet(draft.startTime, draft.endTime));
  const previewDraft = valid ? draft : null;
  const all = useMemo(() => (previewDraft ? [...sessions, previewDraft] : [...sessions]), [sessions, previewDraft]);
  const days = useMemo(() => sessionCalendar(all, monday, sunday), [all, monday, sunday]);

  const draftFirst = useMemo(() => (previewDraft ? firstRunDate(previewDraft, today) : null), [previewDraft, today]);
  const draftMonday = draftFirst ? mondayOf(draftFirst) : null;
  const draftOnThisWeek = Boolean(previewDraft && Array.from({ length: 7 }, (_, i) => addDays(monday, i)).some((day) => sessionRunsOn(previewDraft, day)));
  const draftKeyNow = draftKey(previewDraft);
  const lastFocusedKey = useRef("");

  useEffect(() => {
    if (!draftFirst || !draftMonday || draftKeyNow === lastFocusedKey.current) return;
    lastFocusedKey.current = draftKeyNow;
    const offset = Math.round((Date.parse(`${draftMonday}T00:00:00Z`) - Date.parse(`${thisMonday}T00:00:00Z`)) / (7 * 86400000));
    setWeekOffset(offset);
  }, [draftFirst, draftMonday, draftKeyNow, thisMonday]);

  const hours = useMemo(() => {
    const times: { startTime: string; endTime: string }[] = [];
    for (const entries of days.values()) {
      for (const { session } of entries) times.push(session);
    }
    // Include draft times even if they fall on another week, so the axis stays stable while jumping.
    if (previewDraft) times.push(previewDraft);
    return weekHourBounds(times);
  }, [days, previewDraft]);

  const hourList = useMemo(() => {
    const list: number[] = [];
    for (let hour = hours.startHour; hour <= hours.endHour; hour++) list.push(hour);
    return list;
  }, [hours]);

  const trackHeight = Math.max(1, hours.endHour - hours.startHour) * HOUR_PX;
  const origin = hours.startHour * 60;

  const dayIndexes = useMemo(() => {
    // Keep at least Mon–Fri; extend through Sat/Sun only when this week (or the draft) uses them.
    let end = 4;
    for (let index = 0; index <= 6; index++) {
      const day = addDays(monday, index);
      const has = (days.get(day) ?? []).length > 0 || (previewDraft ? sessionRunsOn(previewDraft, day) : false);
      if (has) end = Math.max(end, index);
    }
    return Array.from({ length: end + 1 }, (_, index) => index);
  }, [monday, days, previewDraft]);

  const weekHasEntries = dayIndexes.some((index) => (days.get(addDays(monday, index)) ?? []).length > 0);
  const title = weekRangeTitle(monday);

  const barStyle = (startTime: string, endTime: string) => {
    const top = ((toMinutes(startTime) - origin) / 60) * HOUR_PX + 2;
    const height = Math.max(34, ((toMinutes(endTime) - toMinutes(startTime)) / 60) * HOUR_PX);
    return { top, height };
  };

  const jumpToDraft = () => {
    if (!draftMonday) return;
    const offset = Math.round((Date.parse(`${draftMonday}T00:00:00Z`) - Date.parse(`${thisMonday}T00:00:00Z`)) / (7 * 86400000));
    setWeekOffset(offset);
  };

  return (
    <section aria-labelledby="session-calendar" className="rounded-card bg-surface p-4 shadow-card md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="session-calendar" className="text-title3 font-semibold text-ink">
            {title}
          </h2>
          <p className="mt-1 text-callout text-muted">
            Live week preview. A one-off session takes priority over weekly sessions on its date.
          </p>
          {previewDraft && draftFirst && !draftOnThisWeek ? (
            <p className="mt-2 text-callout text-ink-2">
              Draft starts on {shortDate(draftFirst)}.{" "}
              <button type="button" onClick={jumpToDraft} className="font-semibold text-accent underline-offset-2 hover:underline">
                Jump to that week
              </button>
            </p>
          ) : null}
          {previewDraft && !draftFirst ? (
            <p className="mt-2 text-callout text-warn">No days in range for this draft — check the weekdays and from/until dates.</p>
          ) : null}
        </div>
        <nav className="flex flex-wrap gap-1.5" aria-label="Week navigation">
          <button
            type="button"
            aria-label="Previous week"
            onClick={() => setWeekOffset((value) => value - 1)}
            className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-field border border-hairline px-2 text-callout text-ink hover:bg-fill"
          >
            ‹
          </button>
          <button
            type="button"
            aria-current={weekOffset === 0 ? "date" : undefined}
            onClick={() => setWeekOffset(0)}
            className={`inline-flex min-h-9 items-center justify-center rounded-field border px-3 text-callout font-medium ${
              weekOffset === 0 ? "border-accent/40 bg-accent-soft text-accent" : "border-hairline text-ink hover:bg-fill"
            }`}
          >
            This week
          </button>
          <button
            type="button"
            aria-label="Next week"
            onClick={() => setWeekOffset((value) => value + 1)}
            className="inline-flex min-h-9 items-center justify-center rounded-field border border-hairline px-3 text-callout text-ink hover:bg-fill"
          >
            Next week ›
          </button>
        </nav>
      </div>

      {!weekHasEntries ? (
        <div className="mt-5 rounded-xl bg-fill/50 px-4 py-12 text-center" role="status">
          <p className="text-body font-semibold text-ink">No sessions this week</p>
          <p className="mt-1 text-callout text-muted">Pick days and hours on the left to preview, or jump to a week that has sessions.</p>
        </div>
      ) : (
      <div
        className="mt-5 grid gap-x-2 overflow-x-auto"
        style={{ gridTemplateColumns: `3rem repeat(${dayIndexes.length}, minmax(7.5rem, 1fr))` }}
        role="grid"
        aria-label={`Week of ${title}`}
      >
        <div className="relative text-right text-caption text-muted" style={{ paddingTop: HEAD_PX }} aria-hidden="true">
          {hourList.slice(0, -1).map((hour) => (
            <div key={hour} className="tabular -translate-y-2 pr-1 leading-none" style={{ height: HOUR_PX }}>
              {String(hour).padStart(2, "0")}:00
            </div>
          ))}
        </div>
        {dayIndexes.map((index) => {
          const day = addDays(monday, index);
          const entries = days.get(day) ?? [];
          const isToday = day === today;
          return (
            <div key={day} data-date={day} className="min-w-0">
              <div className="flex items-center justify-center gap-1.5" style={{ height: HEAD_PX }}>
                <span className={`text-caption font-medium uppercase tracking-wide ${isToday ? "text-accent" : "text-muted"}`}>{WEEKDAYS[index]}</span>
                <span
                  className={`grid size-8 place-items-center rounded-full text-body font-semibold tabular ${
                    isToday ? "bg-accent text-white" : "text-ink"
                  }`}
                >
                  {Number(day.slice(8))}
                </span>
              </div>
              <div
                className={`relative rounded-xl border border-hairline/50 ${isToday ? "bg-accent-soft/30" : entries.length === 0 ? "bg-fill/40" : "bg-white"}`}
                style={{
                  height: trackHeight,
                  backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${HOUR_PX - 1}px, rgba(148,163,184,0.18) ${HOUR_PX - 1}px, rgba(148,163,184,0.18) ${HOUR_PX}px)`,
                }}
              >
                {entries.map(({ session, replaced }) => {
                  const isDraft = session.id === DRAFT_ID;
                  // When the draft lands on a day that already has a session, nudge it right so both stay readable.
                  const shareDay = isDraft && entries.some((entry) => entry.session.id !== DRAFT_ID && !entry.replaced);
                  const wave = session.mode === "wave";
                  const label = barLabel(session, isDraft);
                  return (
                    <div
                      key={`${session.id}-${day}`}
                      title={replaced ? `${label} (replaced by a one-off session)` : label}
                      aria-label={replaced ? `${label}, replaced by a one-off session` : label}
                      data-draft={isDraft ? "true" : undefined}
                      data-replaced={replaced ? "true" : undefined}
                      className={`absolute right-1 overflow-hidden rounded-xl px-2.5 py-1.5 text-[12px] leading-snug ${
                        isDraft
                          ? wave
                            ? "z-[3] border border-dashed border-amber-400 bg-amber-50/95 text-amber-900 shadow-sm"
                            : "z-[3] border border-dashed border-accent/60 bg-white/95 text-accent shadow-sm"
                          : wave
                            ? "z-[2] border-l-4 border-amber-500 bg-amber-100 text-amber-950 shadow-sm"
                            : "z-[2] border-l-4 border-accent bg-accent-soft text-ink shadow-sm"
                      } ${replaced ? "z-[1] left-[30%] opacity-50 line-through" : ""} ${shareDay ? "left-[40%]" : replaced ? "" : "left-1"}`}
                      style={barStyle(session.startTime, session.endTime)}
                    >
                      <span className="block truncate font-semibold">
                        {isDraft ? `New ${wave ? "Wave" : "Stream"}` : session.label || (wave ? "Wave" : "Stream")}
                      </span>
                      <span className="block truncate tabular opacity-80">
                        {session.startTime}–{session.endTime}
                        {session.onDate ? " · One date" : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      )}

      <ul className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-muted" aria-label="Key">
        <li className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border-l-4 border-accent bg-accent-soft" aria-hidden="true" /> Stream
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border-l-4 border-amber-500 bg-amber-100" aria-hidden="true" /> Wave
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-dashed border-accent/60 bg-white" aria-hidden="true" /> Draft
        </li>
        <li className="line-through">Replaced by a one-off</li>
      </ul>
    </section>
  );
}

