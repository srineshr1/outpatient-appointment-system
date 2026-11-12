"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { ConsultSession, SessionTrim } from "@/lib/clinic-types";
import { defaultsFor, type SessionDefaults } from "@/lib/session-defaults";
import { planAbsorption, timesLookSet, type OccupyingVisit } from "@/lib/sessions";
import { Button } from "@/components/ui/Button";
import { SessionCalendar } from "./SessionCalendar";
import { SessionForm } from "./SessionForm";
import { SessionList } from "./SessionList";

function shapeKey(session: ConsultSession): string {
  const days = [...session.weekdays].sort((a, b) => a - b).join(",");
  return [session.mode, session.slotMinutes ?? "", session.waveMinutes ?? "", session.startTime, session.endTime, session.onDate ?? "", session.startDate ?? "", session.endDate ?? "", days].join("|");
}

type PlannerMode = "browse" | "add" | "pick" | "edit";

/**
 * The session workspace opens on the week alone. Add and Edit are explicit: Edit highlights
 * the sessions that can be changed, and the dashed preview appears only after the doctor
 * picks days and hours.
 */
export function SessionPlanner({
  sessions,
  defaults,
  today,
  addTitle,
  visits = [],
  trims = [],
}: {
  sessions: readonly ConsultSession[];
  /** Defaults for a brand-new session (carries the doctor's default room). */
  defaults: SessionDefaults;
  today: string;
  /** Heading for the form: "Add your first session" until there is one. */
  addTitle: string;
  /** Future visits that still occupy time. No patient names. */
  visits?: readonly OccupyingVisit[];
  /** Free-edge minutes already lent between this doctor's sessions. */
  trims?: readonly SessionTrim[];
}) {
  const [requested, setRequested] = useState<PlannerMode>("browse");
  const [target, setTarget] = useState<ConsultSession | null>(null);
  const [draft, setDraft] = useState<ConsultSession | null>(null);
  const formAreaRef = useRef<HTMLElement | null>(null);

  // A session removed while it was being edited drops the form back to the week.
  const editing = target && sessions.some((session) => session.id === target.id) ? target : null;
  const mode: PlannerMode = requested === "edit" && !editing ? "browse" : requested;
  const showForm = mode === "add" || mode === "edit";

  const beginEdit = useCallback((session: ConsultSession) => {
    setRequested("edit");
    setTarget(session);
    setDraft(null);
  }, []);

  const beginAdd = useCallback(() => {
    setRequested("add");
    setTarget(null);
    setDraft(null);
  }, []);

  const beginPick = useCallback(() => {
    setDraft(null);
    setTarget(null);
    setRequested((current) => (current === "pick" ? "browse" : "pick"));
  }, []);

  const close = useCallback(() => {
    setRequested("browse");
    setTarget(null);
    setDraft(null);
  }, []);

  useEffect(() => {
    if (mode === "browse") return;
    // On a wide screen the form opens beside the calendar, so the week does not need to scroll away.
    if (typeof matchMedia === "function" && matchMedia("(min-width: 64rem)").matches) return;
    const rail = formAreaRef.current;
    if (!rail || typeof rail.scrollIntoView !== "function") return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    rail.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" });
  }, [mode, editing?.id]);

  const editingDefaults = useMemo(() => (editing ? defaultsFor(editing, defaults.room) : defaults), [editing, defaults]);

  // Typing updates the form straight away; the calendar redraws on a settled draft.
  const deferredDraft = useDeferredValue(draft);
  const preview = useMemo(() => {
    if (!deferredDraft || !timesLookSet(deferredDraft.startTime, deferredDraft.endTime)) return null;
    if (!deferredDraft.onDate && deferredDraft.weekdays.length === 0) return null;
    if (!deferredDraft.onDate && (!deferredDraft.startDate || !deferredDraft.endDate)) return null;
    return deferredDraft;
  }, [deferredDraft]);
  const candidate = useMemo(() => {
    if (!preview) return null;
    return { ...preview, id: editing?.id ?? preview.id, doctorId: editing?.doctorId || preview.doctorId };
  }, [preview, editing]);
  const shapeChanged = Boolean(candidate && (!editing || shapeKey(editing) !== shapeKey(candidate)));
  const plan = useMemo(() => {
    if (!candidate || !shapeChanged) return null;
    return planAbsorption(candidate, sessions.filter((session) => session.id !== candidate.id), visits, today, trims);
  }, [candidate, shapeChanged, sessions, visits, today, trims]);
  const guidance = !plan ? null : plan.ok
    ? (plan.notice ? { tone: "info" as const, message: plan.notice } : null)
    : { tone: "danger" as const, message: plan.message };
  const previewTrims = useMemo(() => {
    if (!candidate || !shapeChanged || !plan?.ok) return trims;
    return [...trims.filter((trim) => trim.absorbedBy !== candidate.id), ...plan.trims];
  }, [trims, candidate, shapeChanged, plan]);
  const roster = useMemo(() => {
    if (!candidate || !shapeChanged || !plan?.ok) return sessions;
    return [...sessions.filter((session) => session.id !== candidate.id), candidate];
  }, [sessions, candidate, shapeChanged, plan]);

  const canEdit = sessions.length > 0;
  const toolbar = useMemo(
    () => (
      <>
        <Button type="button" variant={mode === "add" ? "primary" : "secondary"} onClick={beginAdd} aria-pressed={mode === "add"}>
          Add a session
        </Button>
        <Button
          type="button"
          variant={mode === "pick" || mode === "edit" ? "primary" : "secondary"}
          onClick={beginPick}
          disabled={!canEdit}
          aria-pressed={mode === "pick"}
        >
          Edit a session
        </Button>
        {mode !== "browse" ? (
          <Button type="button" variant="plain" onClick={close}>
            Done
          </Button>
        ) : null}
      </>
    ),
    [mode, canEdit, beginAdd, beginPick, close],
  );

  const railOpen = mode !== "browse";

  return (
    <div className="mt-8">
      <div className="flex flex-col lg:flex-row lg:items-start">
        <div
          className={`min-w-0 lg:flex-1 ${
            railOpen
              ? "lg:sticky lg:top-[calc(var(--header-h)+0.75rem)] lg:max-h-[calc(100dvh-var(--header-h)-1.5rem)] lg:self-start lg:overflow-y-auto"
              : ""
          }`}
        >
          <SessionCalendar
            sessions={sessions}
            draft={preview}
            draftOf={editing?.id ?? null}
            today={today}
            selectedId={editing?.id ?? null}
            onSelect={mode === "pick" || mode === "edit" ? beginEdit : undefined}
            picking={mode === "pick"}
            composing={showForm}
            trims={previewTrims}
            roster={roster}
            toolbar={toolbar}
          />
        </div>
        <aside
          ref={formAreaRef}
          inert={railOpen ? undefined : true}
          className={`min-w-0 overflow-hidden motion-reduce:transition-none lg:shrink-0 lg:transition-[width,opacity,transform] lg:duration-500 lg:ease-[cubic-bezier(0.22,1,0.36,1)] max-lg:transition-[height,opacity] max-lg:duration-500 ${
            railOpen
              ? "mt-6 h-auto opacity-100 lg:mt-0 lg:w-[26rem] lg:translate-x-0"
              : "pointer-events-none mt-0 h-0 opacity-0 lg:h-auto lg:w-0 lg:translate-x-8"
          }`}
        >
          <div className="lg:w-[26rem] lg:pl-6">
            {showForm ? (
              <section aria-labelledby="add-session" className="rounded-card border border-hairline bg-surface p-4 shadow-card md:p-5">
                <h2 id="add-session" className="text-title3 font-semibold text-ink">
                  {editing ? `Editing ${editing.label || "consulting session"}` : addTitle}
                </h2>
                <p className="mt-1 text-callout text-zinc-400">
                  Choose the days, the dates, and the hours. The week stays beside you and draws the new block after that.
                </p>
                <div className="mt-4">
                  <SessionForm
                    key={editing?.id ?? "new"}
                    defaults={editingDefaults}
                    submitLabel={editing ? "Save changes" : "Add session"}
                    fallbackLabel={editing?.label}
                    onDraft={setDraft}
                    onCancel={close}
                    guidance={guidance}
                  />
                </div>
              </section>
            ) : (
              <section aria-labelledby="pick-session" className="rounded-card border border-hairline bg-surface p-4 shadow-card md:p-5">
                <h2 id="pick-session" className="text-title3 font-semibold text-ink">
                  Edit a session
                </h2>
                <p className="mt-2 text-callout text-ink-2">
                  Select a highlighted block on the week. Its hours open here.
                </p>
                <Button type="button" variant="plain" className="mt-4" onClick={close}>
                  Done
                </Button>
              </section>
            )}
          </div>
        </aside>
      </div>
      <div className="mt-6">
        <SessionList
          sessions={sessions}
          selectedId={editing?.id ?? null}
          onEdit={beginEdit}
          trims={trims}
          picking={mode === "pick"}
        />
      </div>
    </div>
  );
}
