"use client";

import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ConsultSession, SessionTrim } from "@/lib/clinic-types";
import { addDays, mondayOf } from "@/lib/clock";
import {
  firstRunDate,
  hoursOnDate,
  sessionCalendar,
  sessionRunsOn,
  shortDate,
  timesLookSet,
  toMinutes,
  weekHourBounds,
  weekRangeTitle,
} from "@/lib/sessions";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const HOUR_PX = 56;
const HEAD_PX = 64;
const DRAFT_ID = "__draft__";

type BarBounds = { startTime: string; endTime: string };

type DayBar = {
  session: ConsultSession;
  replaced: boolean;
  bounds: BarBounds;
  lane: number;
  laneCount: number;
};

/** Side-by-side lanes for blocks that overlap, so a short neighbour does not squash the rest of the day. */
function layoutBars(items: { session: ConsultSession; replaced: boolean; bounds: BarBounds }[]): DayBar[] {
  const sorted = items
    .map((item) => ({ ...item, start: toMinutes(item.bounds.startTime), end: toMinutes(item.bounds.endTime) }))
    .sort((a, b) => a.start - b.start || b.end - a.end);
  type Node = (typeof sorted)[number] & { lane: number };
  const clusters: Node[][] = [];
  let cluster: Node[] = [];
  let clusterEnd = -1;
  for (const item of sorted) {
    const node: Node = { ...item, lane: 0 };
    if (cluster.length > 0 && node.start >= clusterEnd) {
      clusters.push(cluster);
      cluster = [];
      clusterEnd = -1;
    }
    cluster.push(node);
    clusterEnd = Math.max(clusterEnd, node.end);
  }
  if (cluster.length > 0) clusters.push(cluster);

  const placed: DayBar[] = [];
  for (const group of clusters) {
    const laneEnds: number[] = [];
    for (const node of group) {
      let lane = laneEnds.findIndex((end) => end <= node.start);
      if (lane < 0) {
        lane = laneEnds.length;
        laneEnds.push(node.end);
      } else {
        laneEnds[lane] = node.end;
      }
      node.lane = lane;
    }
    const laneCount = Math.max(1, laneEnds.length);
    for (const node of group) {
      placed.push({ session: node.session, replaced: node.replaced, bounds: node.bounds, lane: node.lane, laneCount });
    }
  }
  return placed;
}

function barLabel(session: ConsultSession, draft: boolean, startTime: string, endTime: string): string {
  const name = draft ? session.label || `New ${session.mode === "wave" ? "Wave" : "Stream"}` : session.label || (session.mode === "wave" ? "Wave" : "Stream");
  const kind = session.onDate ? "One date" : "Weekly";
  return `${name} ${startTime}–${endTime} (${kind})`;
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

/** Days and hours, ignoring the name: two sessions with this key draw the same bar. */
function blockKey(session: ConsultSession): string {
  const days = [...session.weekdays].sort((a, b) => a - b).join(",");
  return [session.mode, session.startTime, session.endTime, session.onDate ?? "", session.startDate ?? "", session.endDate ?? "", days].join("|");
}

function sameHours(a: ConsultSession, b: ConsultSession): boolean {
  return a.mode === b.mode && a.startTime === b.startTime && a.endTime === b.endTime;
}

/**
 * Compact week preview of when the doctor's sessions run. One-off sessions replace weekly ones
 * on their date (shown struck through). The session being added appears as a dashed draft bar.
 * Saved sessions can be selected (click a bar to edit it); the selected one is ringed.
 */
function SessionCalendarBase({
  sessions,
  draft = null,
  draftOf = null,
  today,
  selectedId = null,
  onSelect,
  picking = false,
  composing = false,
  trims = [],
  roster,
  toolbar,
}: {
  sessions: readonly ConsultSession[];
  /** The session being added or edited, previewed once days and hours are chosen (dashed outline). */
  draft?: ConsultSession | null;
  /** The session the draft edits (edit mode): when the draft hasn't changed a day yet, that day keeps the saved bar only. */
  draftOf?: string | null;
  today: string;
  /** The session selected for editing: its bars are ringed. */
  selectedId?: string | null;
  /** Clicking a saved session's bar opens it for editing. Passed only while choosing or editing. */
  onSelect?: (session: ConsultSession) => void;
  /** Edit mode before a session is chosen: mark every saved block as editable. */
  picking?: boolean;
  /** Add or edit form is open, so the caption can say when the preview will appear. */
  composing?: boolean;
  /** Free-edge cuts, including a live preview of a save that has not landed yet. */
  trims?: readonly SessionTrim[];
  /** Sessions used to decide which cuts still apply. Defaults to `sessions`. */
  roster?: readonly ConsultSession[];
  /** Add / Edit actions, kept with the week so the calendar is the first thing on the page. */
  toolbar?: ReactNode;
}) {
  const boundsRoster = roster ?? sessions;
  const thisMonday = mondayOf(today);
  const [weekOffset, setWeekOffset] = useState(0);
  const monday = addDays(thisMonday, weekOffset * 7);
  const sunday = addDays(monday, 6);

  const valid = Boolean(draft && timesLookSet(draft.startTime, draft.endTime));
  const previewDraft = valid ? draft : null;
  // The saved session the draft edits (edit mode), to know when the draft still matches it.
  const original = useMemo(() => {
    if (!previewDraft || !draftOf) return null;
    return sessions.find((session) => session.id === draftOf) ?? null;
  }, [sessions, draftOf, previewDraft]);
  // An unchanged form copies a bar that is already saved (just added, or opened for editing).
  // Drawing it again covers that bar and steals the click.
  const shownDraft = useMemo(() => {
    if (!previewDraft) return null;
    const key = blockKey(previewDraft);
    return sessions.some((session) => blockKey(session) === key) ? null : previewDraft;
  }, [sessions, previewDraft]);
  const all = useMemo(() => (shownDraft ? [...sessions, shownDraft] : [...sessions]), [sessions, shownDraft]);
  const days = useMemo(() => {
    const built = sessionCalendar(all, monday, sunday);
    if (!original || !shownDraft) return built;
    // New hours replace the saved block in place, so the week does not draw the old bar beside the preview.
    if (!sameHours(original, shownDraft)) {
      for (const [day, entries] of built) {
        const kept = entries.filter((entry) => entry.session.id !== original.id);
        if (kept.length === 0) built.delete(day);
        else built.set(day, kept);
      }
      return built;
    }
    // Same hours, fewer or different days: keep the saved bar on days that have not moved.
    for (const [day, entries] of built) {
      const liveOriginal = entries.some((entry) => entry.session.id === original.id && !entry.replaced);
      if (!liveOriginal) continue;
      const kept = entries.filter((entry) => entry.session.id !== DRAFT_ID);
      if (kept.length === 0) built.delete(day);
      else built.set(day, kept);
    }
    return built;
  }, [all, monday, sunday, original, shownDraft]);

  const draftFirst = useMemo(() => (previewDraft ? firstRunDate(previewDraft, today) : null), [previewDraft, today]);
  const draftMonday = draftFirst ? mondayOf(draftFirst) : null;
  const draftOnThisWeek = Boolean(shownDraft && Array.from({ length: 7 }, (_, i) => addDays(monday, i)).some((day) => sessionRunsOn(shownDraft, day)));
  const draftKeyNow = draftKey(previewDraft);
  const lastFocusedKey = useRef("");

  useEffect(() => {
    if (!draftFirst || !draftMonday || draftKeyNow === lastFocusedKey.current) return;
    lastFocusedKey.current = draftKeyNow;
    const offset = Math.round((Date.parse(`${draftMonday}T00:00:00Z`) - Date.parse(`${thisMonday}T00:00:00Z`)) / (7 * 86400000));
    setWeekOffset(offset);
  }, [draftFirst, draftMonday, draftKeyNow, thisMonday]);

  // Selecting a session for editing jumps to a week it runs, so its bars are in view.
  const selectedSession = useMemo(() => {
    if (!selectedId) return null;
    return sessions.find((session) => session.id === selectedId) ?? null;
  }, [sessions, selectedId]);
  const lastJumped = useRef("");
  useEffect(() => {
    if (!selectedSession || lastJumped.current === selectedSession.id) return;
    const run = firstRunDate(selectedSession, today);
    lastJumped.current = selectedSession.id;
    if (!run) return;
    const monday = mondayOf(run);
    setWeekOffset(Math.round((Date.parse(`${monday}T00:00:00Z`) - Date.parse(`${thisMonday}T00:00:00Z`)) / (7 * 86400000)));
  }, [selectedSession, thisMonday, today]);

  const hours = useMemo(() => {
    const times: { startTime: string; endTime: string }[] = [];
    for (const entries of days.values()) {
      for (const { session } of entries) times.push(session);
    }
    // Include draft times even if they fall on another week, so the axis stays stable while jumping.
    if (shownDraft) times.push(shownDraft);
    return weekHourBounds(times);
  }, [days, shownDraft]);

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
      const has = (days.get(day) ?? []).length > 0 || (shownDraft ? sessionRunsOn(shownDraft, day) : false);
      if (has) end = Math.max(end, index);
    }
    return Array.from({ length: end + 1 }, (_, index) => index);
  }, [monday, days, shownDraft]);

  const weekHasEntries = dayIndexes.some((index) => (days.get(addDays(monday, index)) ?? []).length > 0);
  const title = weekRangeTitle(monday);

  const barBox = (startTime: string, endTime: string, lane: number, laneCount: number) => {
    const top = ((toMinutes(startTime) - origin) / 60) * HOUR_PX + 3;
    const height = Math.max(28, ((toMinutes(endTime) - toMinutes(startTime)) / 60) * HOUR_PX - 6);
    const gap = 4;
    const span = `(100% - ${(laneCount + 1) * gap}px) / ${laneCount}`;
    return {
      top,
      height,
      width: `calc(${span})`,
      left: `calc(${gap}px + ${lane} * (${span} + ${gap}px))`,
    };
  };

  const jumpToDraft = () => {
    if (!draftMonday) return;
    const offset = Math.round((Date.parse(`${draftMonday}T00:00:00Z`) - Date.parse(`${thisMonday}T00:00:00Z`)) / (7 * 86400000));
    setWeekOffset(offset);
  };

  const caption = picking
    ? "Highlighted blocks can be edited. Select one."
    : shownDraft
      ? "Dashed blocks are the hours you just chose. They are not saved yet."
      : composing
        ? "The week stays as it is until you choose the days, the dates, and the hours."
        : "A one-off session takes the place of the weekly session on that date.";

  return (
    <section aria-labelledby="session-calendar" className="rounded-card bg-surface p-4 shadow-card md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 id="session-calendar" className="text-title3 font-semibold text-ink">
            {title}
          </h2>
          <p className="mt-1 max-w-prose text-callout text-muted">{caption}</p>
          {shownDraft && draftFirst && !draftOnThisWeek ? (
            <p className="mt-2 text-callout text-ink-2">
              That session starts on {shortDate(draftFirst)}.{" "}
              <button type="button" onClick={jumpToDraft} className="font-semibold text-accent underline-offset-2 hover:underline">
                Jump to that week
              </button>
            </p>
          ) : null}
          {shownDraft && !draftFirst ? (
            <p className="mt-2 text-callout text-warn">No days in range for this choice — check the weekdays and from/until dates.</p>
          ) : null}
          {!weekHasEntries ? (
            <p className="mt-2 text-callout text-ink-2" role="status">
              No sessions this week. Move to another week, or add one.
            </p>
          ) : null}
        </div>
        {toolbar ? <div className="flex flex-wrap items-center gap-2">{toolbar}</div> : null}
      </div>
      <nav className="mt-4 flex flex-wrap gap-1.5" aria-label="Week navigation">
        <button
          type="button"
          aria-label="Previous week"
          onClick={() => setWeekOffset((value) => value - 1)}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-field border border-hairline px-2 text-body text-ink hover:bg-fill"
        >
          ‹
        </button>
        <button
          type="button"
          aria-current={weekOffset === 0 ? "date" : undefined}
          onClick={() => setWeekOffset(0)}
          className={`inline-flex min-h-11 items-center justify-center rounded-field border px-3 text-callout font-medium ${
            weekOffset === 0 ? "border-accent/40 bg-accent-soft text-accent" : "border-hairline text-ink hover:bg-fill"
          }`}
        >
          This week
        </button>
        <button
          type="button"
          aria-label="Next week"
          onClick={() => setWeekOffset((value) => value + 1)}
          className="inline-flex min-h-11 items-center justify-center rounded-field border border-hairline px-3 text-callout text-ink hover:bg-fill"
        >
          Next week ›
        </button>
      </nav>

      <div
        className="mt-4 grid gap-x-2 overflow-x-auto pb-1"
        style={{ gridTemplateColumns: `3.25rem repeat(${dayIndexes.length}, minmax(9.25rem, 1fr))` }}
        role="grid"
        aria-label={`Week of ${title}`}
      >
        <div className="relative text-right text-caption text-muted" style={{ paddingTop: HEAD_PX }} aria-hidden="true">
          {hourList.slice(0, -1).map((hour) => (
            <div key={hour} className="relative tabular" style={{ height: HOUR_PX }}>
              <span className="absolute -top-2 right-1 leading-none">{String(hour).padStart(2, "0")}:00</span>
            </div>
          ))}
        </div>
        {dayIndexes.map((index) => {
          const day = addDays(monday, index);
          const entries = days.get(day) ?? [];
          const drawn = layoutBars(
            entries.flatMap(({ session, replaced }) => {
              const bounds = replaced
                ? { startTime: session.startTime, endTime: session.endTime }
                : hoursOnDate(session, day, trims, boundsRoster);
              return bounds ? [{ session, replaced, bounds }] : [];
            }),
          );
          const isToday = day === today;
          return (
            <div key={day} data-date={day} className="min-w-0">
              <div className="flex flex-col items-center justify-center gap-0.5" style={{ height: HEAD_PX }}>
                <span className={`text-caption font-semibold uppercase tracking-wide ${isToday ? "text-accent" : "text-muted"}`}>{WEEKDAYS[index]}</span>
                <span
                  className={`grid size-8 place-items-center rounded-full text-body font-semibold tabular ${
                    isToday ? "bg-accent text-white" : "text-ink"
                  }`}
                >
                  {Number(day.slice(8))}
                </span>
              </div>
              <div
                className={`relative rounded-xl border ${isToday ? "border-accent/25 bg-accent-soft/35" : drawn.length === 0 ? "border-hairline/40 bg-fill/40" : "border-hairline/50 bg-white"}`}
                style={{
                  height: trackHeight,
                  backgroundImage: `linear-gradient(to bottom, rgba(210, 210, 215, 0.85) 1px, transparent 1px)`,
                  backgroundSize: `100% ${HOUR_PX}px`,
                }}
              >
                {drawn.map(({ session, replaced, bounds, lane, laneCount }) => {
                  const isDraft = session.id === DRAFT_ID;
                  const clickable = Boolean(onSelect) && !isDraft;
                  const selected = !isDraft && session.id === selectedId;
                  const editable = picking && !isDraft;
                  const wave = session.mode === "wave";
                  const label = barLabel(session, isDraft, bounds.startTime, bounds.endTime);
                  const box = barBox(bounds.startTime, bounds.endTime, lane, laneCount);
                  const name = isDraft
                    ? session.label || `New ${wave ? "wave" : "stream"}`
                    : session.label || (wave ? "Wave" : "Stream");
                  const crowded = laneCount >= 3 || box.height < 46;
                  const tone = isDraft
                    ? wave
                      ? "pointer-events-none z-[3] border-2 border-dashed border-amber-600 bg-amber-50 text-amber-950"
                      : "pointer-events-none z-[3] border-2 border-dashed border-accent bg-white text-accent"
                    : wave
                      ? "z-[2] border border-amber-200 border-l-[3px] border-l-amber-600 bg-amber-50 text-amber-950"
                      : "z-[2] border border-[#d3e4f7] border-l-[3px] border-l-accent bg-[#e7f1fb] text-ink";
                  const mark = selected || editable ? "shadow-[inset_0_0_0_3px_#0066cc] bg-white" : "shadow-sm";
                  const classes = `absolute overflow-hidden rounded-lg px-2 py-1 text-left text-[12px] leading-tight ${tone} ${mark} ${
                    replaced ? "z-[1] opacity-60 line-through" : ""
                  } ${clickable ? "cursor-pointer hover:brightness-[0.98] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent/55" : ""}`;
                  const inner = (
                    <>
                      <span className="block truncate font-semibold tabular">
                        {crowded ? bounds.startTime : `${bounds.startTime}–${bounds.endTime}`}
                      </span>
                      {crowded ? null : (
                        <span className="mt-0.5 block truncate font-medium opacity-80">
                          {name}
                          {session.onDate ? " · One date" : ""}
                        </span>
                      )}
                      {editable && !crowded ? (
                        <span className="mt-1 inline-flex w-fit rounded-full bg-accent px-1.5 text-[10px] font-semibold leading-4 text-white">Edit</span>
                      ) : null}
                    </>
                  );
                  const selection = selected ? ", being edited" : editable ? ", editable" : "";
                  return clickable ? (
                    <button
                      key={`${session.id}-${day}`}
                      type="button"
                      title={label}
                      aria-label={`${label}${selection}`}
                      aria-pressed={selected || undefined}
                      data-session={session.id}
                      data-editable={editable ? "true" : undefined}
                      data-replaced={replaced ? "true" : undefined}
                      onClick={() => onSelect?.(session)}
                      className={classes}
                      style={box}
                    >
                      {inner}
                    </button>
                  ) : (
                    <div
                      key={`${session.id}-${day}`}
                      title={replaced ? `${label} (replaced by a one-off session)` : label}
                      aria-label={replaced ? `${label}, replaced by a one-off session` : label}
                      data-draft={isDraft ? "true" : undefined}
                      data-replaced={replaced ? "true" : undefined}
                      className={classes}
                      style={box}
                    >
                      {inner}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <ul className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-caption text-muted" aria-label="Key">
        <li className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border-l-[3px] border-accent bg-[#e7f1fb]" aria-hidden="true" /> Stream
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border-l-[3px] border-amber-600 bg-amber-50" aria-hidden="true" /> Wave
        </li>
        {shownDraft ? (
          <li className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded border-2 border-dashed border-accent bg-white" aria-hidden="true" /> Not saved yet
          </li>
        ) : null}
        <li className="line-through">Replaced by a one-off</li>
        {picking ? <li className="font-medium text-accent">Highlighted blocks can be edited</li> : null}
      </ul>
    </section>
  );
}

/** Memoised: the form streams draft updates while typing, so the grid only redraws on settled drafts. */
export const SessionCalendar = memo(SessionCalendarBase);

