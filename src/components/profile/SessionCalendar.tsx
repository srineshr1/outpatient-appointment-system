import type { ConsultSession } from "@/lib/clinic-types";
import { addDays, mondayOf } from "@/lib/clock";
import { sessionCalendar } from "@/lib/sessions";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function monthStart(iso: string, shift: number): string {
  const [y, m] = iso.split("-").map(Number) as [number, number];
  const date = new Date(Date.UTC(y, m - 1 + shift, 1));
  return date.toISOString().slice(0, 10);
}

function monthTitle(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
}

/**
 * A month-by-month preview of when the doctor's sessions run. One-off sessions replace the weekly
 * sessions on their date, so replaced weekly sessions are shown struck through.
 */
export function SessionCalendar({
  sessions,
  draft = null,
  today,
  months = 2,
}: {
  sessions: readonly ConsultSession[];
  /** The session being added, previewed live (dashed outline). */
  draft?: ConsultSession | null;
  today: string;
  months?: number;
}) {
  const valid = draft && /^\d\d:\d\d$/.test(draft.startTime) && /^\d\d:\d\d$/.test(draft.endTime) && draft.startTime < draft.endTime;
  const all = valid ? [...sessions, draft] : sessions;
  const starts = Array.from({ length: months }, (_, index) => monthStart(today, index));
  return (
    <section aria-labelledby="session-calendar" className="rounded-card bg-surface p-5 shadow-card md:p-6">
      <h2 id="session-calendar" className="text-title3 font-semibold text-ink">
        Calendar preview
      </h2>
      <p className="mt-1 text-callout text-muted">
        How your sessions fall on the dates ahead, with the session you are adding shown live. A one-off session takes priority over weekly sessions on its date.
      </p>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-caption text-ink-2" aria-label="Key">
        <li className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-accent-soft ring-1 ring-accent/40" /> Stream</li>
        <li className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-amber-100 ring-1 ring-amber-500/50" /> Wave</li>
        <li className="flex items-center gap-1.5"><span className="font-bold">★</span> One date</li>
        <li className="flex items-center gap-1.5"><span>↻</span> Weekly</li>
        <li className="flex items-center gap-1.5"><span className="line-through">Replaced</span> by a one-off session</li>
        <li className="flex items-center gap-1.5"><span className="size-3 rounded-sm outline-2 outline-dashed outline-ink" /> New session (preview)</li>
      </ul>
      {starts.map((first) => {
        const last = addDays(monthStart(first, 1), -1);
        const gridStart = mondayOf(first);
        const days = sessionCalendar(all, first, last);
        const cells: string[] = [];
        for (let day = gridStart; day <= last || cells.length % 7 !== 0; day = addDays(day, 1)) cells.push(day);
        return (
          <div key={first} className="mt-5">
            <h3 className="text-body font-semibold text-ink">{monthTitle(first)}</h3>
            <div className="mt-2 grid grid-cols-7 gap-1 text-caption" role="grid" aria-label={monthTitle(first)}>
              {WEEKDAYS.map((name) => (
                <div key={name} className="px-1 font-semibold text-muted">{name}</div>
              ))}
              {cells.map((day) => {
                const inMonth = day >= first && day <= last;
                const entries = inMonth ? days.get(day) ?? [] : [];
                return (
                  <div
                    key={day}
                    data-date={day}
                    className={`min-h-16 rounded-field p-1 ${inMonth ? "bg-fill/50" : "opacity-30"} ${day === today ? "ring-2 ring-accent" : ""} ${day < today ? "opacity-60" : ""}`}
                  >
                    <div className="tabular text-muted">{Number(day.slice(8))}</div>
                    {entries.map(({ session, replaced }) => (
                      <div
                        key={session.id}
                        title={`${session.label || "Session"} ${session.startTime}–${session.endTime}${replaced ? " (replaced by a one-off session)" : ""}`}
                        className={`tabular mt-0.5 rounded-sm px-1 text-[11px] leading-tight break-words ${
                          session.mode === "wave" ? "bg-amber-100 text-amber-900" : "bg-accent-soft text-accent"
                        } ${replaced ? "line-through opacity-50" : ""} ${session.onDate ? "font-bold" : ""} ${
                          session.id === "__draft__" ? "outline-2 -outline-offset-2 outline-dashed outline-ink" : ""
                        }`}
                        data-draft={session.id === "__draft__" ? "true" : undefined}
                      >
                        {session.id === "__draft__" ? "New " : ""}{session.onDate ? "★" : "↻"} {session.startTime}–<wbr />{session.endTime}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </section>
  );
}
