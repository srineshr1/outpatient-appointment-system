"use client";

import type { ConsultSession, SessionTrim } from "@/lib/clinic-types";
import { daysLabel, modeSummary } from "@/lib/sessions";
import { Button } from "@/components/ui/Button";
import { PendingButton } from "@/components/ui/PendingButton";
import { buttonClass } from "@/components/ui/button-styles";
import { archiveSession } from "@/server/profile-actions";

/** Row accent colour per booking mode, matching the calendar legend. */
const modeStrip: Record<string, string> = {
  stream: "bg-accent",
  wave: "bg-warn",
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
        <span className="rounded-full border border-hairline bg-fill px-2 py-0.5 align-middle text-caption font-semibold text-ink-2">
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
                  className={`w-1.5 self-stretch rounded-full ${modeStrip[session.mode] ?? "bg-accent"}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-body font-semibold text-ink">
                    {session.label || "Consulting session"}
                    <span
                      className={`rounded-full px-2 py-0.5 text-caption font-semibold ${
                        wave
                          ? "border border-warn/30 bg-warn-soft text-warn"
                          : "border border-accent/30 bg-accent-soft text-accent"
                      }`}
                    >
                      {wave ? "Wave" : "Stream"}
                    </span>
                    {session.room ? (
                      <span className="rounded-full border border-hairline bg-fill px-2 py-0.5 text-caption font-medium text-ink-2">
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
                  <p className="text-callout text-muted">{modeSummary(session)}</p>
                  {lends ? <p className="text-callout text-muted">Gives its free edge to another session on some days. Booked patients stay.</p> : null}
                  {borrows ? <p className="text-callout text-muted">Uses free time from the next session on some days. Nothing was cancelled.</p> : null}
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
