"use client";

import { useMemo, useState } from "react";
import type { ConsultSession } from "@/lib/clinic-types";
import { addDays, mondayOf } from "@/lib/clock";
import { sessionCalendar, toMinutes, weekHourBounds } from "@/lib/sessions";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const HOUR_PX = 44;
const DRAFT_ID = "__draft__";

function weekTitle(monday: string): string {
  const sunday = addDays(monday, 6);
  const start = new Date(`${monday}T00:00:00Z`);
  const end = new Date(`${sunday}T00:00:00Z`);
  const sameMonth = start.getUTCMonth() === end.getUTCMonth();
  const left = start.toLocaleDateString("en-IN", { month: "short", day: "numeric", timeZone: "UTC" });
  const right = end.toLocaleDateString("en-IN", {
    month: sameMonth ? undefined : "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${left} – ${right}`;
}

function barLabel(session: ConsultSession, draft: boolean): string {
  const name = draft ? `New ${session.mode === "wave" ? "Wave" : "Stream"}` : session.label || (session.mode === "wave" ? "Wave" : "Stream");
  const mark = session.onDate ? "★ " : "↻ ";
  return `${mark}${name} ${session.startTime}–${session.endTime}`;
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

  const valid =
    draft &&
    /^\d\d:\d\d$/.test(draft.startTime) &&
    /^\d\d:\d\d$/.test(draft.endTime) &&
    draft.startTime < draft.endTime;
  const all = useMemo(() => (valid && draft ? [...sessions, draft] : [...sessions]), [sessions, draft, valid]);
  const days = useMemo(() => sessionCalendar(all, monday, sunday), [all, monday, sunday]);

  const hours = useMemo(() => {
    const times: { startTime: string; endTime: string }[] = [];
    for (const entries of days.values()) {
      for (const { session } of entries) times.push(session);
    }
    return weekHourBounds(times);
  }, [days]);

  const hourList = useMemo(() => {
    const list: number[] = [];
    for (let hour = hours.startHour; hour <= hours.endHour; hour++) list.push(hour);
    return list;
  }, [hours]);

  const trackHeight = Math.max(1, hours.endHour - hours.startHour) * HOUR_PX;
  const origin = hours.startHour * 60;

  const barStyle = (startTime: string, endTime: string) => {
    const top = ((toMinutes(startTime) - origin) / 60) * HOUR_PX;
    const height = Math.max(22, ((toMinutes(endTime) - toMinutes(startTime)) / 60) * HOUR_PX);
    return { top, height };
  };

  return (
    <section aria-labelledby="session-calendar" className="rounded-card bg-surface p-4 shadow-card md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="session-calendar" className="text-title3 font-semibold text-ink">
            {weekTitle(monday)}
          </h2>
          <p className="mt-1 text-callout text-muted">
            Live week preview. A one-off session takes priority over weekly sessions on its date.
          </p>
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

      <div
        className="mt-4 grid gap-2 overflow-x-auto"
        style={{ gridTemplateColumns: `3.25rem repeat(7, minmax(4.5rem, 1fr))` }}
        role="grid"
        aria-label={`Week of ${weekTitle(monday)}`}
      >
        <div className="pt-[52px] text-caption text-muted" aria-hidden="true">
          {hourList.slice(0, -1).map((hour) => (
            <div key={hour} className="tabular" style={{ height: HOUR_PX }}>
              {String(hour).padStart(2, "0")}:00
            </div>
          ))}
        </div>
        {Array.from({ length: 7 }, (_, index) => {
          const day = addDays(monday, index);
          const entries = days.get(day) ?? [];
          const isToday = day === today;
          return (
            <div key={day} data-date={day} className="min-w-0">
              <div className={`flex h-[52px] flex-col items-center justify-center ${isToday ? "text-accent" : ""}`}>
                <span className="text-caption text-muted">{WEEKDAYS[index]}</span>
                <span className={`text-title3 font-semibold tabular ${isToday ? "text-accent" : "text-ink"}`}>
                  {Number(day.slice(8))}
                </span>
              </div>
              <div
                className="relative rounded-[10px] bg-[repeating-linear-gradient(#fff,#fff_43px,#f1f5f9_43px,#f1f5f9_44px)]"
                style={{ height: trackHeight }}
              >
                {entries.map(({ session, replaced }) => {
                  const isDraft = session.id === DRAFT_ID;
                  const wave = session.mode === "wave";
                  const label = barLabel(session, isDraft);
                  return (
                    <div
                      key={`${session.id}-${day}`}
                      title={replaced ? `${label} (replaced by a one-off session)` : label}
                      aria-label={replaced ? `${label}, replaced by a one-off session` : label}
                      data-draft={isDraft ? "true" : undefined}
                      data-replaced={replaced ? "true" : undefined}
                      className={`absolute right-1 left-1 overflow-hidden rounded-lg px-1.5 py-1 text-[11px] leading-tight ${
                        isDraft
                          ? wave
                            ? "z-[3] border-2 border-dashed border-amber-500 bg-amber-50 text-amber-900"
                            : "z-[3] border-2 border-dashed border-accent bg-accent-soft text-accent"
                          : wave
                            ? "z-[2] bg-amber-500 text-white"
                            : "z-[2] bg-accent text-white"
                      } ${replaced ? "z-[1] left-[30%] opacity-45 line-through" : ""}`}
                      style={barStyle(session.startTime, session.endTime)}
                    >
                      <span className="block truncate font-semibold">{isDraft ? "New " : ""}{session.onDate ? "★" : "↻"} {isDraft ? (wave ? "Wave" : "Stream") : session.label || (wave ? "Wave" : "Stream")}</span>
                      <span className="block truncate tabular opacity-90">
                        {session.startTime}–{session.endTime}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-hairline/70 pt-3 text-caption text-ink-2" aria-label="Key">
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-accent" aria-hidden="true" /> Stream
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-amber-500" aria-hidden="true" /> Wave
        </li>
        <li className="flex items-center gap-1.5">
          <span className="font-bold" aria-hidden="true">
            ★
          </span>{" "}
          One date
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true">↻</span> Weekly
        </li>
        <li className="flex items-center gap-1.5">
          <span className="rounded bg-fill px-1.5 py-0.5 text-muted line-through">struck</span> Replaced by one-off
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm border-2 border-dashed border-accent bg-accent-soft" aria-hidden="true" /> New draft
        </li>
      </ul>
    </section>
  );
}
