"use client";

import { useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { PendingButton } from "@/components/ui/PendingButton";
import { buttonClass } from "@/components/ui/button-styles";
import type { ConsultSession } from "@/lib/clinic-types";
import { MAX_WAVE_CAPACITY, STREAM_SLOT_MINUTES, WEEKDAY_NAMES } from "@/lib/sessions";
import type { SessionDefaults } from "@/lib/session-defaults";
import { saveSession } from "@/server/profile-actions";

/** Add or change one consulting session: when it runs first, then how patients book, then the hours. */
/** Read the form as it stands into a draft session, for the live calendar preview. */
function draftFrom(form: HTMLFormElement, labelFallback: string): ConsultSession {
  const data = new FormData(form);
  const text = (key: string) => String(data.get(key) ?? "");
  const num = (key: string) => (text(key) ? Number(text(key)) : null);
  const once = text("kind") === "once";
  const mode = text("mode") === "wave" ? "wave" : "stream";
  const startTime = text("startTime");
  const endTime = text("endTime");
  // Incomplete or midnight-default times: leave blank so the calendar does not preview a bogus block.
  const timesReady = /^\d\d:\d\d$/.test(startTime) && /^\d\d:\d\d$/.test(endTime) && startTime < endTime && !(startTime === "00:00" && endTime === "00:00");
  return {
    id: "__draft__",
    doctorId: "",
    label: text("label") || labelFallback || "",
    weekdays: once ? [] : data.getAll("weekdays").map(Number),
    startTime: timesReady ? startTime : "",
    endTime: timesReady ? endTime : "",
    room: text("room"),
    mode,
    slotMinutes: mode === "stream" ? num("slotMinutes") : null,
    waveMinutes: null,
    waveCapacity: mode === "wave" ? num("waveCapacity") : null,
    startDate: once ? null : text("startDate") || null,
    endDate: once ? null : text("endDate") || null,
    onDate: once ? text("onDate") || null : null,
    archivedAt: null,
  } as ConsultSession;
}

export function SessionForm({
  defaults,
  submitLabel,
  onDraft,
  onCancel,
  fallbackLabel = "",
  guidance = null,
}: {
  defaults: SessionDefaults;
  submitLabel: string;
  /** Called with the draft whenever a field changes (live preview). */
  onDraft?: (draft: ConsultSession) => void;
  /** Drop back to add mode without saving (edit mode): shown beside the submit button. */
  onCancel?: () => void;
  /** Preview-bar name while the name field is empty (edit mode keeps the session's name). */
  fallbackLabel?: string;
  /** Live result of growing into the next session's free edge. */
  guidance?: { tone: "info" | "danger"; message: string } | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action] = useActionState(saveSession, null);
  const typedDays = state?.values?.weekdays ? state.values.weekdays.split(",").filter(Boolean).map(Number) : defaults.weekdays;
  const [mode, setMode] = useState<"stream" | "wave">(defaults.mode);
  const [kind, setKind] = useState<"recurring" | "once">(defaults.kind);
  const shownKind = state?.values?.kind === "once" || state?.values?.kind === "recurring" ? state.values.kind : kind;
  const shown = state?.values?.mode === "wave" || state?.values?.mode === "stream" ? state.values.mode : mode;
  const v = (key: string, fallback: string | number) => state?.values?.[key] ?? String(fallback);
  const idPrefix = `session-${defaults.id || "new"}`;
  // The week stays clear until the doctor actually picks days or hours. Pre-filled defaults are not a selection.
  const scheduleTouched = useRef(false);
  const lastDraft = useRef("");
  const report = (form: HTMLFormElement | null) => {
    if (!onDraft || !form || !scheduleTouched.current) return;
    const draft = draftFrom(form, fallbackLabel);
    const key = JSON.stringify(draft);
    if (key === lastDraft.current) return;
    lastDraft.current = key;
    onDraft(draft);
  };
  const onFormEdit = (event: FormEvent<HTMLFormElement>) => {
    const name = (event.target as HTMLInputElement).name;
    if (name === "kind" || name === "weekdays" || name === "onDate" || name === "startDate" || name === "endDate" || name === "startTime" || name === "endTime") {
      scheduleTouched.current = true;
    }
    report(event.currentTarget);
  };
  // Switching kind swaps fields after the change event, so read the form again once they exist.
  useEffect(() => report(formRef.current));

  return (
    <form ref={formRef} action={action} onInput={onFormEdit} onChange={onFormEdit} className="group grid gap-4 md:grid-cols-2">
      <input type="hidden" name="id" value={defaults.id} />
      {defaults.id ? <Notice className="md:col-span-2">
        Extend or reduce these hours to update new availability. Existing appointments and payment holds keep their original times, including visits outside reduced hours. Resized waves stay closed where they overlap existing reservations.
      </Notice> : null}
      {state && !state.ok ? (
        <Notice tone="danger" role="alert" className="md:col-span-2">
          {state.message}
        </Notice>
      ) : guidance ? (
        <Notice tone={guidance.tone} role={guidance.tone === "danger" ? "alert" : "status"} className="md:col-span-2">
          {guidance.message}
        </Notice>
      ) : null}
      <Field id={`${idPrefix}-label`} label="Name of the session" optional hint="For example Morning surgery." className="md:col-span-2">
        {({ id, describedBy }) => <input id={id} name="label" defaultValue={v("label", defaults.label)} aria-describedby={describedBy} maxLength={60} className="field" />}
      </Field>
      <fieldset className="md:col-span-2">
        <legend className="mb-2 text-callout font-semibold text-ink">When it runs</legend>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["recurring", "Weekly", "Every week on the chosen days, from the start date to the end date."],
              ["once", "One date", "A single date, for example an extra Saturday clinic."],
            ] as const
          ).map(([value, title, text]) => (
            <label key={value} className="relative" title={text}>
              <input type="radio" name="kind" value={value} checked={shownKind === value} onChange={() => setKind(value)} className="peer sr-only" />
              <span className="inline-flex min-h-11 cursor-pointer items-center rounded-full px-4 text-callout font-semibold text-accent shadow-[inset_0_0_0_1px_var(--color-hairline)] peer-checked:bg-accent peer-checked:text-white peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent/55">
                {title}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {shownKind === "once" ? (
        <Field id={`${idPrefix}-on`} label="Date" hint="Monday to Saturday. Slots are made for this date only." className="md:col-span-2">
          {({ id, describedBy }) => <input id={id} name="onDate" type="date" defaultValue={v("onDate", defaults.onDate)} aria-describedby={describedBy} className="field tabular" />}
        </Field>
      ) : (
        <>
      <fieldset className="md:col-span-2">
        <legend className="mb-2 text-callout font-semibold text-ink">Days</legend>
        <div className="flex flex-wrap gap-2">
          {WEEKDAY_NAMES.map((name, index) => (
            <label key={name} className="relative">
              <input type="checkbox" name="weekdays" value={index + 1} defaultChecked={typedDays.includes(index + 1)} className="peer sr-only" />
              <span className="inline-flex min-h-11 cursor-pointer items-center rounded-full px-4 text-callout font-medium text-accent shadow-[inset_0_0_0_1px_var(--color-hairline)] peer-checked:bg-accent peer-checked:text-white peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent/55">
                {name}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <Field id={`${idPrefix}-from`} label="From date" hint="The first day this session runs.">
        {({ id, describedBy }) => <input id={id} name="startDate" type="date" required defaultValue={v("startDate", defaults.startDate)} aria-describedby={describedBy} className="field tabular" />}
      </Field>
      <Field id={`${idPrefix}-until`} label="Until date" hint="The last day this session runs.">
        {({ id, describedBy }) => <input id={id} name="endDate" type="date" required defaultValue={v("endDate", defaults.endDate)} aria-describedby={describedBy} className="field tabular" />}
      </Field>
        </>
      )}
      <fieldset className="md:col-span-2">
        <legend className="mb-2 text-callout font-semibold text-ink">How patients book this session</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-stretch">
          {(
            [
              ["stream", "Stream", "One patient per fixed slot. Each slot can be booked once."],
              ["wave", "Wave", "The whole session is one wave. Up to a set number of patients, seen in token order."],
            ] as const
          ).map(([value, title, text]) => (
            <label key={value} className="relative flex h-full cursor-pointer">
              <input type="radio" name="mode" value={value} checked={shown === value} onChange={() => setMode(value)} className="peer sr-only" />
              <span className="flex h-full min-h-[6.75rem] w-full flex-col rounded-card p-4 shadow-[inset_0_0_0_1px_var(--color-hairline)] peer-checked:bg-accent-soft peer-checked:shadow-[inset_0_0_0_2px_var(--color-accent)] peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent/55">
                <span className="block text-body font-semibold text-ink">{title}</span>
                <span className="mt-1 line-clamp-3 text-callout text-ink-2">{text}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="md:col-span-2">
        <legend className="mb-2 text-callout font-semibold text-ink">Session hours</legend>
        <p className="mb-3 text-callout text-muted">When this clinic block runs that day — not the length of each patient visit.</p>
        <div className="grid gap-4 md:grid-cols-2">
          <Field id={`${idPrefix}-start`} label="Session starts" hint="Clinic block start (for example 09:00).">
            {({ id, describedBy }) => (
              <input
                id={id}
                name="startTime"
                type="time"
                step={300}
                required
                aria-describedby={describedBy}
                defaultValue={v("startTime", defaults.startTime || "09:00")}
                className="field tabular"
              />
            )}
          </Field>
          <Field id={`${idPrefix}-end`} label="Session ends" hint="Clinic block end (for example 12:00).">
            {({ id, describedBy }) => (
              <input
                id={id}
                name="endTime"
                type="time"
                step={300}
                required
                aria-describedby={describedBy}
                defaultValue={v("endTime", defaults.endTime || "12:00")}
                className="field tabular"
              />
            )}
          </Field>
        </div>
      </fieldset>
      {shown === "stream" ? (
        <Field
          id={`${idPrefix}-slot`}
          label="Patient slot length"
          hint="Splits the session hours into bookable slots (e.g. 09:00–12:00 with 20 min → 09:00, 09:20, …)."
          className="md:col-span-2"
        >
          {({ id, describedBy }) => (
            <select id={id} name="slotMinutes" defaultValue={v("slotMinutes", defaults.slotMinutes)} aria-describedby={describedBy} className="field">
              {STREAM_SLOT_MINUTES.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes} minutes
                </option>
              ))}
            </select>
          )}
        </Field>
      ) : (
        <Field id={`${idPrefix}-capacity`} label="Max patients" hint={`1 to ${MAX_WAVE_CAPACITY}. The whole session is one wave; each patient gets a token in booking order.`} className="md:col-span-2">
          {({ id, describedBy }) => (
            <input id={id} name="waveCapacity" type="number" min={1} max={MAX_WAVE_CAPACITY} inputMode="numeric" aria-describedby={describedBy} defaultValue={v("waveCapacity", defaults.waveCapacity)} className="field tabular" />
          )}
        </Field>
      )}
      <Field id={`${idPrefix}-room`} label="Room or clinic" className="md:col-span-2">
        {({ id }) => <input id={id} name="room" defaultValue={v("room", defaults.room)} maxLength={60} className="field" />}
      </Field>
      <div className="md:col-span-2">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <PendingButton pendingLabel="Saving…" className={buttonClass("primary", "lg", "group-has-[[aria-busy=true]]:pointer-events-none")}>
            {submitLabel}
          </PendingButton>
          {onCancel ? (
            <Button variant="plain" size="md" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
        </div>
      </div>
    </form>
  );
}
