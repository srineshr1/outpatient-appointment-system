"use client";

import { useActionState, useState } from "react";
import { Notice } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { PendingButton } from "@/components/ui/PendingButton";
import { buttonClass } from "@/components/ui/button-styles";
import type { ConsultSession } from "@/lib/clinic-types";
import { MAX_WAVE_CAPACITY, STREAM_SLOT_MINUTES, WAVE_MINUTES, WEEKDAY_NAMES } from "@/lib/sessions";
import { saveSession } from "@/server/profile-actions";

export interface SessionDefaults {
  id: string;
  label: string;
  weekdays: number[];
  startTime: string;
  endTime: string;
  room: string;
  mode: "stream" | "wave";
  slotMinutes: number;
  waveMinutes: number;
  waveCapacity: number;
}

export function defaultsFor(session: ConsultSession | null, room: string): SessionDefaults {
  return {
    id: session?.id ?? "",
    label: session?.label ?? "",
    weekdays: session?.weekdays ?? [1, 2, 3, 4, 5],
    startTime: session?.startTime ?? "09:00",
    endTime: session?.endTime ?? "12:00",
    room: session?.room ?? room,
    mode: session?.mode ?? "stream",
    slotMinutes: session?.slotMinutes ?? 20,
    waveMinutes: session?.waveMinutes ?? 60,
    waveCapacity: session?.waveCapacity ?? 6,
  };
}

/** Add or change one consulting session. The mode choice decides which timing fields show. */
export function SessionForm({ defaults, submitLabel }: { defaults: SessionDefaults; submitLabel: string }) {
  const [state, action] = useActionState(saveSession, null);
  const typedDays = state?.values?.weekdays ? state.values.weekdays.split(",").filter(Boolean).map(Number) : defaults.weekdays;
  const [mode, setMode] = useState<"stream" | "wave">(defaults.mode);
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
      <Field id={`${idPrefix}-start`} label="Starts">
        {({ id }) => <input id={id} name="startTime" type="time" step={300} defaultValue={v("startTime", defaults.startTime)} className="field tabular" />}
      </Field>
      <Field id={`${idPrefix}-end`} label="Ends">
        {({ id }) => <input id={id} name="endTime" type="time" step={300} defaultValue={v("endTime", defaults.endTime)} className="field tabular" />}
      </Field>
      <Field id={`${idPrefix}-room`} label="Room or clinic" className="md:col-span-2">
        {({ id }) => <input id={id} name="room" defaultValue={v("room", defaults.room)} maxLength={60} className="field" />}
      </Field>
      <fieldset className="md:col-span-2">
        <legend className="mb-2 text-callout font-semibold text-ink">How patients book this session</legend>
        <div className="grid gap-3 md:grid-cols-2">
          {(
            [
              ["stream", "Stream", "One patient per fixed slot. Each slot can be booked once."],
              ["wave", "Wave", "The session is split into waves. Each wave takes several patients, seen in token order."],
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
        <>
          <Field id={`${idPrefix}-wave`} label="Wave length">
            {({ id }) => (
              <select id={id} name="waveMinutes" defaultValue={v("waveMinutes", defaults.waveMinutes)} className="field">
                {WAVE_MINUTES.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes} minutes
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field id={`${idPrefix}-capacity`} label="Patients per wave" hint={`1 to ${MAX_WAVE_CAPACITY}. Each gets a token in booking order.`}>
            {({ id, describedBy }) => (
              <input id={id} name="waveCapacity" type="number" min={1} max={MAX_WAVE_CAPACITY} inputMode="numeric" aria-describedby={describedBy} defaultValue={v("waveCapacity", defaults.waveCapacity)} className="field tabular" />
            )}
          </Field>
        </>
      )}
      <div className="md:col-span-2">
        <PendingButton pendingLabel="Saving…" className={buttonClass("primary", "lg", "group-has-[[aria-busy=true]]:pointer-events-none")}>
          {submitLabel}
        </PendingButton>
      </div>
    </form>
  );
}
