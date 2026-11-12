"use client";

import type { ConsultSession, SessionTrim } from "@/lib/clinic-types";
import { daysLabel, modeSummary } from "@/lib/sessions";
import { Button } from "@/components/ui/Button";
import { PendingButton } from "@/components/ui/PendingButton";
import { buttonClass } from "@/components/ui/button-styles";
import { archiveSession } from "@/server/profile-actions";

/** Row accent colour per booking mode, matching the calendar legend. */
const modeStrip: Record<string, string> = {
  stream: "bg-cyan-400",
  wave: "bg-amber-400",
};

/**
 * The doctor's sessions as tidy rows: labelled badge chips up top, the schedule on one line,
 * the booking detail muted below, and Edit / Remove always right-aligned. Edit hands the
 * session to the planner's form; Remove archives it.
 */
export function SessionList({
  sessions,
  selectedId = null,
  onEdit,
  trims = [],
  picking = false,
}: {
  sessions: readonly ConsultSession[];
  /** The session currently loaded in the planner form: its row is ringed. */
  selectedId?: string | null;
  onEdit: (session: ConsultSession) => void;
  /** Free-edge cuts already saved. */
  trims?: readonly SessionTrim[];
  /** Edit mode: every saved session can be chosen, so each row is marked. */
  picking?: boolean;
}) {
  if (sessions.length === 0) return null;
  return (
    <section aria-labelledby="your-sessions">
      <h2 id="your-sessions" className="text-title3 font-semibold text-ink">
        Your sessions{" "}
        <span className="rounded-full border border-white/10 bg-fill px-2 py-0.5 align-middle text-caption font-semibold text-zinc-200">
          {sessions.length}
        </span>
      </h2>
      <ul className="mt-3 grid gap-3">
        {sessions.map((session) => {
          const selected = session.id === selectedId;
          const wave = session.mode === "wave";
          const lends = trims.some((trim) => trim.sessionId === session.id);
          const borrows = trims.some((trim) => trim.absorbedBy === session.id);
          return (
            <li
              key={session.id}
              data-editable={picking ? "true" : undefined}
              className={`rounded-card border border-hairline bg-surface shadow-card ${selected ? "ring-2 ring-accent" : picking ? "ring-2 ring-accent/70" : ""}`}
            >
              <div className="flex items-center gap-4 px-4 py-3.5 md:px-5">
                <span
                  aria-hidden="true"
                  className={`w-1.5 self-stretch rounded-full ${modeStrip[session.mode] ?? "bg-cyan-400"}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-body font-semibold text-ink">
                    {session.label || "Consulting session"}
                    <span
                      className={`rounded-full px-2 py-0.5 text-caption font-semibold ${
                        wave
                          ? "border border-amber-400/25 bg-amber-400/12 text-amber-300"
                          : "border border-cyan-400/25 bg-cyan-400/12 text-cyan-300"
                      }`}
                    >
                      {wave ? "Wave" : "Stream"}
                    </span>
                    {session.room ? (
                      <span className="rounded-full border border-white/10 bg-fill px-2 py-0.5 text-caption font-medium text-zinc-200">
                        Room {session.room}
                      </span>
                    ) : null}
                    {selected ? <span className="sr-only">, currently being edited</span> : null}
                  </p>
                  <p className="tabular mt-1 text-callout text-ink-2">
                    <span className="font-medium text-ink">{session.startTime}–{session.endTime}</span>
                    <span aria-hidden="true"> · </span>
                    {daysLabel(session)}
                  </p>
                  <p className="text-callout text-zinc-400">{modeSummary(session)}</p>
                  {lends ? <p className="text-callout text-zinc-400">Gives its free edge to another session on some days. Booked patients stay.</p> : null}
                  {borrows ? <p className="text-callout text-zinc-400">Uses free time from the next session on some days. Nothing was cancelled.</p> : null}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant={picking ? "secondary" : "plain"} size="md" onClick={() => onEdit(session)} aria-pressed={selected}>
                    Edit
                  </Button>
                  <form action={archiveSession} className="group">
                    <input type="hidden" name="id" value={session.id} />
                    <PendingButton
                      pendingLabel="Removing…"
                      className={buttonClass("plain", "md", "group-has-[[aria-busy=true]]:pointer-events-none")}
                    >
                      Remove
                    </PendingButton>
                  </form>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
