"use client";

import { useActionState } from "react";
import { Notice } from "@/components/ui/Card";
import { PendingButton } from "@/components/ui/PendingButton";
import { buttonClass } from "@/components/ui/button-styles";
import type { DoctorNotifyPrefs } from "@/lib/notifications/doctor-prefs";
import { saveNotificationPrefs } from "@/server/notification-actions";

const OPTIONS: Array<{ key: keyof DoctorNotifyPrefs; label: string; hint: string }> = [
  { key: "booked", label: "New bookings", hint: "When a patient books a visit with you. A visit waiting for payment is sent once it is confirmed." },
  { key: "cancelled", label: "Cancellations", hint: "When a patient or the practice cancels a visit on your book." },
  { key: "rescheduled", label: "Rescheduled visits", hint: "When a patient or the practice moves a visit to another time." },
  { key: "dailySummary", label: "Daily schedule", hint: "Each morning, a list of that day's appointments. Not sent on days with none." },
];

export function NotificationPrefsForm({ initial }: { initial: DoctorNotifyPrefs }) {
  const [state, action] = useActionState(saveNotificationPrefs, null);
  return (
    <form action={action} className="mt-8 grid gap-4 rounded-card bg-surface p-5 shadow-card md:p-6">
      {state && !state.ok ? (
        <Notice tone="danger" role="alert">
          {state.message}
        </Notice>
      ) : null}
      {OPTIONS.map((option) => (
        <label key={option.key} className="flex items-start gap-3">
          <input type="checkbox" name={option.key} defaultChecked={initial[option.key]} className="mt-1 size-5 accent-accent" />
          <span>
            <span className="block text-body font-semibold text-ink">{option.label}</span>
            <span className="block text-callout text-ink-2">{option.hint}</span>
          </span>
        </label>
      ))}
      <div>
        <PendingButton pendingLabel="Saving…" className={buttonClass("primary")}>
          Save
        </PendingButton>
      </div>
    </form>
  );
}
