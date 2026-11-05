"use client";

import { useActionState, useState } from "react";
import { Notice } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { PendingButton } from "@/components/ui/PendingButton";
import { buttonClass } from "@/components/ui/button-styles";
import type { ConsultSession } from "@/lib/clinic-types";
import { MAX_WAVE_CAPACITY, STREAM_SLOT_MINUTES, WEEKDAY_NAMES } from "@/lib/sessions";
import type { SessionDefaults } from "@/lib/session-defaults";
import { saveSession } from "@/server/profile-actions";

/** Add or change one consulting session: when it runs first, then how patients book, then the hours. */
export function SessionForm({ defaults, submitLabel }: { defaults: SessionDefaults; submitLabel: string }) {
  const [state, action] = useActionState(saveSession, null);
  const typedDays = state?.values?.weekdays ? state.values.weekdays.split(",").filter(Boolean).map(Number) : defaults.weekdays;
  const [mode, setMode] = useState<"stream" | "wave">(defaults.mode);
  const [kind, setKind] = useState<"recurring" | "once">(defaults.kind);
  const shownKind = state?.values?.kind === "once" || state?.values?.kind === "recurring" ? state.values.kind : kind;
  const shown = state?.values?.mode === "wave" || state?.values?.mode === "stream" ? state.values.mode : mode;
  const v = (key: string, fallback: string | number) => state?.values?.[key] ?? String(fallback);
  const idPrefix = `session-${defaults.id || "new"}`;

  return (
    <form action={action} className="group grid gap-5 md:grid-cols-2">
      <input type="hidden" name="id" value={defaults.id} />
      {state && !state.ok ? (
        <Notice tone="danger" role="alert" className="md:col-span-2">
          {state.message}
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
              ["recurring", "Recurring", "Every week on chosen days, optionally between two dates."],
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
      <Field id={`${idPrefix}-from`} label="From date" optional hint="Leave empty to start now.">
        {({ id, describedBy }) => <input id={id} name="startDate" type="date" defaultValue={v("startDate", defaults.startDate)} aria-describedby={describedBy} className="field tabular" />}
      </Field>
      <Field id={`${idPrefix}-until`} label="Until date" optional hint="Leave empty to repeat every week.">
        {({ id, describedBy }) => <input id={id} name="endDate" type="date" defaultValue={v("endDate", defaults.endDate)} aria-describedby={describedBy} className="field tabular" />}
      </Field>
        </>
      )}
      <fieldset className="md:col-span-2">
        <legend className="mb-2 text-callout font-semibold text-ink">How patients book this session</legend>
        <div className="grid gap-3 md:grid-cols-2">
          {(
            [
              ["stream", "Stream", "One patient per fixed slot. Each slot can be booked once."],
              ["wave", "Wave", "The whole session is one wave. Up to a set number of patients, seen in token order."],
            ] as const
          ).map(([value, title, text]) => (
            <label key={value} className="relative block cursor-pointer">
              <input type="radio" name="mode" value={value} checked={shown === value} onChange={() => setMode(value)} className="peer sr-only" />
              <span className="block rounded-card p-4 shadow-[inset_0_0_0_1px_var(--color-hairline)] peer-checked:bg-accent-soft peer-checked:shadow-[inset_0_0_0_2px_var(--color-accent)] peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent/55">
                <span className="block text-body font-semibold text-ink">{title}</span>
                <span className="mt-1 block text-callout text-ink-2">{text}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {shown === "stream" ? (
        <Field id={`${idPrefix}-slot`} label="Slot length" className="md:col-span-2">
          {({ id }) => (
            <select id={id} name="slotMinutes" defaultValue={v("slotMinutes", defaults.slotMinutes)} className="field">
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
      <Field id={`${idPrefix}-start`} label="Starts">
        {({ id }) => <input id={id} name="startTime" type="time" step={300} defaultValue={v("startTime", defaults.startTime)} className="field tabular" />}
      </Field>
      <Field id={`${idPrefix}-end`} label="Ends">
        {({ id }) => <input id={id} name="endTime" type="time" step={300} defaultValue={v("endTime", defaults.endTime)} className="field tabular" />}
      </Field>
      <Field id={`${idPrefix}-room`} label="Room or clinic" className="md:col-span-2">
        {({ id }) => <input id={id} name="room" defaultValue={v("room", defaults.room)} maxLength={60} className="field" />}
      </Field>
      <div className="md:col-span-2">
        <PendingButton pendingLabel="Saving…" className={buttonClass("primary", "lg", "group-has-[[aria-busy=true]]:pointer-events-none")}>
          {submitLabel}
        </PendingButton>
      </div>
    </form>
  );
}
