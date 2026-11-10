"use client";

import { useCallback, useDeferredValue, useMemo, useRef, useState } from "react";
import type { ConsultSession } from "@/lib/clinic-types";
import { defaultsFor, type SessionDefaults } from "@/lib/session-defaults";
import { SessionCalendar } from "./SessionCalendar";
import { SessionForm } from "./SessionForm";
import { SessionList } from "./SessionList";

/**
 * The session workspace: the form on the left (add, or edit the picked session), the week
 * calendar beside it as the live preview, and the saved sessions as compact rows. Editing a
 * session loads it back into the form; the calendar highlights and jumps to it.
 */
export function SessionPlanner({
  sessions,
  defaults,
  today,
  addTitle,
}: {
  sessions: readonly ConsultSession[];
  /** Defaults for a brand-new session (carries the doctor's default room). */
  defaults: SessionDefaults;
  today: string;
  /** Heading for the form: "Add your first session" until there is one. */
  addTitle: string;
}) {
  const [target, setTarget] = useState<ConsultSession | null>(null);
  const [draft, setDraft] = useState<ConsultSession | null>(null);
  const formAreaRef = useRef<HTMLElement | null>(null);

  // A session removed while it was being edited drops the form back to add mode, same paint.
  const editing = target && sessions.some((session) => session.id === target.id) ? target : null;

  const beginEdit = useCallback((session: ConsultSession) => {
    setTarget(session);
    setDraft(null);
    const rail = formAreaRef.current;
    if (rail && typeof rail.scrollIntoView === "function") {
      const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
      rail.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    }
  }, []);

  const editingDefaults = useMemo(() => (editing ? defaultsFor(editing, defaults.room) : defaults), [editing, defaults]);

  // Typing updates the form straight away; the calendar redraws on a settled draft.
  const deferredDraft = useDeferredValue(draft);

  return (
    <div
      className={`mt-8 grid items-start gap-5 [grid-template-areas:'list'_'form'_'calendar'] lg:grid-cols-[minmax(20rem,23rem)_minmax(0,1fr)] lg:gap-6 lg:[grid-template-areas:'form_calendar'_'form_list'] xl:grid-cols-[minmax(22rem,25rem)_minmax(0,1fr)]`}
    >
      <section
        ref={formAreaRef}
        aria-labelledby="add-session"
        className="rounded-card bg-surface p-4 shadow-card [grid-area:form] md:p-5 lg:sticky lg:top-[calc(var(--header-h)_+_0.5rem)]"
      >
        <h2 id="add-session" className="text-title3 font-semibold text-ink">
          {editing ? `Editing ${editing.label || "consulting session"}` : addTitle}
        </h2>
        <div className="mt-4">
          <SessionForm
            key={editing?.id ?? "new"}
            defaults={editingDefaults}
            submitLabel={editing ? "Save changes" : "Add session"}
            fallbackLabel={editing?.label}
            onDraft={setDraft}
            onCancel={editing ? () => setTarget(null) : undefined}
          />
        </div>
      </section>
      <div className="min-w-0 [grid-area:calendar]">
        <SessionCalendar
          sessions={sessions}
          draft={deferredDraft}
          draftOf={editing?.id ?? null}
          today={today}
          selectedId={editing?.id ?? null}
          onSelect={beginEdit}
        />
      </div>
      <div className="min-w-0 [grid-area:list]">
        <SessionList sessions={sessions} selectedId={editing?.id ?? null} onEdit={beginEdit} />
      </div>
    </div>
  );
}
