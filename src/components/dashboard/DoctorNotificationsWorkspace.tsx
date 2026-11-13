"use client";

import { useActionState, useState } from "react";
import { Bell, Check, ClipboardList, UserCircle } from "@/components/icons";
import { useTheme } from "@/components/providers/ThemeProvider";
import { AnimatedList, AnimatedListItem } from "@/components/reactbits/AnimatedList";
import { CountUp } from "@/components/reactbits/CountUp";
import { SquishSwitch } from "@/components/reactbits/SquishSwitch";
import { ButtonLink } from "@/components/ui/Button";
import { buttonClass } from "@/components/ui/button-styles";
import { Card, Notice } from "@/components/ui/Card";
import { PendingButton } from "@/components/ui/PendingButton";
import type { DoctorNotifyPrefs } from "@/lib/notifications/doctor-prefs";
import { saveNotificationPrefs } from "@/server/notification-actions";

const OPTIONS: Array<{ key: keyof DoctorNotifyPrefs; label: string; hint: string }> = [
  {
    key: "booked",
    label: "New bookings",
    hint: "When a patient books a visit with you. A visit waiting for payment is sent once it is confirmed.",
  },
  {
    key: "cancelled",
    label: "Cancellations",
    hint: "When a patient or the practice cancels a visit on your book.",
  },
  {
    key: "rescheduled",
    label: "Rescheduled visits",
    hint: "When a patient or the practice moves a visit to another time.",
  },
  {
    key: "dailySummary",
    label: "Daily schedule",
    hint: "Each morning, a list of that day's appointments. Not sent on days with none.",
  },
];

export interface DoctorNotificationsWorkspaceProps {
  initial: DoctorNotifyPrefs;
  email: string;
  saved: boolean;
}

export function DoctorNotificationsWorkspace({
  initial,
  email,
  saved,
}: DoctorNotificationsWorkspaceProps) {
  const { theme } = useTheme();
  const [state, action] = useActionState(saveNotificationPrefs, null);
  const [enabled, setEnabled] = useState<DoctorNotifyPrefs>(initial);

  const isDark = theme === "dark";
  const hasActionError = Boolean(state && !state.ok);
  const enabledCount = OPTIONS.filter((option) => enabled[option.key]).length;

  const togglePref = (key: keyof DoctorNotifyPrefs, next: boolean) => {
    setEnabled((prev) => ({ ...prev, [key]: next }));
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-5 pt-6 pb-20 md:px-8 md:pt-10">
      {/* Hero header */}
      <Card className="rounded-sheet p-6 md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-hairline bg-surface-2 px-3.5 py-1.5 text-caption font-semibold text-ink">
              <Bell size={14} className="text-accent" />
              <span className="inline-flex items-center gap-1">
                <CountUp
                  to={enabledCount}
                  duration={0.4}
                  trigger="load"
                  className="font-bold text-ink"
                />
                <span>{`of ${OPTIONS.length} alerts enabled`}</span>
              </span>
            </span>

            <h1 className="mt-4 text-title2 font-semibold tracking-tight text-ink md:text-title1">
              Email notifications
            </h1>

            <p className="mt-2.5 max-w-prose text-body text-ink-2">
              Choose which emails we send to <span className="font-semibold text-ink">{email}</span>.
              Everything is on until you switch it off.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <ButtonLink href="/dashboard/profile" variant="secondary" size="md">
              <UserCircle size={18} />
              <span>Profile</span>
            </ButtonLink>
            <ButtonLink href="/dashboard" variant="secondary" size="md">
              <ClipboardList size={18} />
              <span>Clinic book</span>
            </ButtonLink>
          </div>
        </div>
      </Card>

      {/* Saved feedback notice */}
      {saved && !hasActionError ? (
        <output aria-live="polite" className="block">
          <Notice tone="success" className="flex items-center gap-2.5">
            <Check size={18} className="shrink-0 text-success" />
            <span>Preferences saved. Your email alert settings are active.</span>
          </Notice>
        </output>
      ) : null}

      {/* Form */}
      <Card className="rounded-sheet p-5 sm:p-6 md:p-7">
        <form action={action} className="group space-y-6">
          {hasActionError ? (
            <Notice tone="danger" role="alert">
              {state?.message}
            </Notice>
          ) : null}

          <AnimatedList className="gap-3.5">
            {OPTIONS.map((option, index) => {
              const isOn = enabled[option.key];
              const switchId = `notify-${option.key}`;
              return (
                <AnimatedListItem key={option.key} index={index} selected={isOn}>
                  <Card
                    className={`p-4 transition-colors sm:p-5 ${
                      isOn ? "border-accent/35 bg-surface-2" : "bg-surface"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <label
                            htmlFor={switchId}
                            className="cursor-pointer text-body font-semibold text-ink"
                          >
                            {option.label}
                          </label>
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-caption font-medium ${
                              isOn ? "bg-accent-soft text-accent" : "bg-fill text-muted"
                            }`}
                          >
                            {isOn ? "On" : "Off"}
                          </span>
                        </div>
                        <p className="mt-1 text-callout text-ink-2">{option.hint}</p>
                      </div>

                      <div className="shrink-0 pt-0.5">
                        <input
                          type="checkbox"
                          name={option.key}
                          checked={isOn}
                          readOnly
                          tabIndex={-1}
                          aria-hidden="true"
                          className="sr-only"
                        />
                        <SquishSwitch
                          id={switchId}
                          checked={isOn}
                          onChange={(next) => togglePref(option.key, next)}
                          ariaLabel={option.label}
                          width={56}
                          height={30}
                          radius={15}
                          trackColor={isDark ? "#27272a" : "#a1a1aa"}
                          trackOnColor={isDark ? "#38bdf8" : "#0369a1"}
                          thumbColor={isDark ? "#d4d4d8" : "#ffffff"}
                          thumbOnColor={isDark ? "#09090b" : "#ffffff"}
                        />
                      </div>
                    </div>
                  </Card>
                </AnimatedListItem>
              );
            })}
          </AnimatedList>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-hairline pt-4">
            <PendingButton
              pendingLabel="Saving…"
              className={buttonClass(
                "primary",
                "lg",
                "group-has-[[aria-busy=true]]:pointer-events-none",
              )}
            >
              Save preferences
            </PendingButton>
            <span className="text-caption text-muted">
              {enabledCount} of {OPTIONS.length} email alerts active
            </span>
          </div>
        </form>
      </Card>
    </div>
  );
}
