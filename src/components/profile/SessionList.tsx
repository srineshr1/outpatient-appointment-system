"use client";

import type { ConsultSession } from "@/lib/clinic-types";
import { describeSession } from "@/lib/sessions";
import { Button } from "@/components/ui/Button";
import { PendingButton } from "@/components/ui/PendingButton";
import { buttonClass } from "@/components/ui/button-styles";
import { archiveSession } from "@/server/profile-actions";

/**
 * The doctor's sessions as compact rows: one summary line each, with Edit and Remove.
 * Edit hands the session to the planner's form (below the calendar); Remove archives it.
 */
export function SessionList({
  sessions,
  selectedId = null,
  onEdit,
}: {
  sessions: readonly ConsultSession[];
  /** The session currently loaded in the planner form: its row is ringed. */
  selectedId?: string | null;
  onEdit: (session: ConsultSession) => void;
}) {
  if (sessions.length === 0) return null;
  return (
    <section aria-labelledby="your-sessions">
      <h2 id="your-sessions" className="text-title3 font-semibold text-ink">
        Your sessions
      </h2>
      <ul className="mt-3 grid gap-3">
        {sessions.map((session) => {
          const selected = session.id === selectedId;
          return (
            <li
              key={session.id}
              className={`rounded-card bg-surface p-4 shadow-card md:px-5 ${selected ? "ring-2 ring-accent" : ""}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-body font-semibold text-ink">
                    {session.label || "Consulting session"}
                    <span className="rounded-full bg-accent-soft px-2 py-0.5 text-caption font-semibold text-accent">
                      {session.mode === "wave" ? "Wave" : "Stream"}
                    </span>
                    {selected ? <span className="sr-only">, currently being edited</span> : null}
                  </p>
                  <p className="tabular mt-1 text-callout text-ink-2">{describeSession(session)}</p>
                  <p className="text-callout text-muted">{session.room}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="plain" size="md" onClick={() => onEdit(session)} aria-pressed={selected}>
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
