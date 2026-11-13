"use client";

import { useActionState, useState } from "react";
import { Bell, Check, ClipboardList, Eye, Pin } from "@/components/icons";
import { CountUp } from "@/components/reactbits/CountUp";
import { Stepper } from "@/components/reactbits/Stepper";
import { ButtonLink } from "@/components/ui/Button";
import { buttonClass } from "@/components/ui/button-styles";
import { Card, Notice } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { PendingButton } from "@/components/ui/PendingButton";
import { doctorTitle } from "@/lib/names";
import { parseFee } from "@/lib/profiles";
import { saveDoctorProfile } from "@/server/profile-actions";

export interface DoctorFormValues {
  name: string;
  specialty: string;
  qualification: string;
  years: string;
  room: string;
  fee: string;
  bio: string;
  languages: string;
}

export interface DoctorProfileWorkspaceProps {
  initial: DoctorFormValues;
  welcome: boolean;
  saved: boolean;
  visible: boolean;
  missingCount: number;
  sessionsCount: number;
}

function initialsOf(name: string): string {
  const parts = name
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  if (parts.length === 0) return "DR";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

function parseYears(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d{1,2}$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return parsed <= 70 ? parsed : null;
}

function parseLanguages(raw: string): string[] {
  const list = raw
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
  return list.length > 0 ? list : ["English"];
}

export function DoctorProfileWorkspace({
  initial,
  welcome,
  saved,
  visible,
  missingCount,
  sessionsCount,
}: DoctorProfileWorkspaceProps) {
  const [state, action] = useActionState(saveDoctorProfile, null);
  const [draft, setDraft] = useState<DoctorFormValues>(initial);

  const errors = state?.errors ?? {};
  const hasActionError = Boolean(state && !state.ok);

  const updateField = (key: keyof DoctorFormValues, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const displayName = draft.name.replace(/\s+/g, " ").trim();
  const displaySpecialty = draft.specialty.trim() || "General practice";
  const displayQualification = draft.qualification.trim() || "Add your qualifications";
  const displayRoom = draft.room.trim() || "Room or clinic pending";
  const displayBio =
    draft.bio.trim() || "Write a short bio so patients know what you focus on and how you consult.";
  const yearsNum = parseYears(draft.years);
  const feePence = parseFee(draft.fee);
  const languages = parseLanguages(draft.languages);

  const statusBadgeText = welcome
    ? "Onboarding · Step 1 of 2"
    : visible
      ? "Live on patient directory"
      : missingCount > 0
        ? `Draft · ${missingCount} ${missingCount === 1 ? "field" : "fields"} needed`
        : sessionsCount === 0
          ? "Profile complete · Add a session"
          : "Profile active";

  return (
    <div className="mx-auto max-w-[92rem] space-y-6 px-5 pt-6 pb-20 md:px-8 md:pt-10 xl:px-10">
      {/* Hero header */}
      <Card className="rounded-sheet p-6 md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-hairline bg-surface-2 px-3.5 py-1.5 text-caption font-semibold text-ink">
              <span
                className={`size-2 rounded-full ${
                  visible ? "bg-success" : "bg-accent"
                }`}
                aria-hidden="true"
              />
              <span>{statusBadgeText}</span>
            </span>

            <h1 className="mt-4 text-title2 font-semibold tracking-tight text-ink md:text-title1">
              {welcome ? "Welcome. Tell patients about you" : "Your profile"}
            </h1>

            <p className="mt-2.5 max-w-prose text-body text-ink-2">
              {welcome
                ? "Step 1 of 2. Patients see this when they choose a doctor. Next you set up your consulting sessions."
                : "Patients see this on your doctor page. Changes update your directory card immediately."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <ButtonLink href="/dashboard" variant="secondary" size="md">
              <ClipboardList size={18} />
              <span>Clinic book</span>
            </ButtonLink>
            <ButtonLink href="/dashboard/notifications" variant="secondary" size="md">
              <Bell size={18} />
              <span>Email alerts</span>
            </ButtonLink>
          </div>
        </div>
      </Card>

      {/* Welcome Stepper */}
      {welcome ? (
        <Card className="rounded-sheet p-4 sm:p-5">
          <Stepper
            activeStep={0}
            allowClickAhead={false}
            steps={[
              {
                id: "profile",
                title: "Doctor profile",
                subtitle: "Active · Specialty, credentials, room & fee",
                done: false,
              },
              {
                id: "sessions",
                title: "Consulting sessions",
                subtitle: "Next · Days, hours & booking mode",
                done: false,
              },
            ]}
          />
        </Card>
      ) : null}

      {/* Saved feedback notice */}
      {saved && !hasActionError ? (
        <output aria-live="polite" className="block">
          <Notice tone="success" className="flex items-center gap-2.5">
            <Check size={18} className="shrink-0 text-success" />
            <span>Profile saved. Your patient directory card reflects these details.</span>
          </Notice>
        </output>
      ) : null}

      {/* Two-column studio layout */}
      <div className="grid items-start gap-6 lg:grid-cols-12">
        {/* Left / Main: Profile Form */}
        <Card className="min-w-0 rounded-sheet p-5 sm:p-6 md:p-7 lg:col-span-7">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-2 border-b border-hairline pb-4">
              <div>
                <h2 className="text-title3 font-semibold text-ink">Practice details</h2>
                <p className="mt-0.5 text-callout text-muted">
                  Complete every required field so patients can discover and book you.
                </p>
              </div>
            </div>

            <form action={action} className="group grid gap-5 md:grid-cols-2">
              <input type="hidden" name="welcome" value={welcome ? "1" : ""} />

              {hasActionError ? (
                <Notice tone="danger" role="alert" className="md:col-span-2">
                  {state?.message}
                </Notice>
              ) : null}

              <Field
                id="name"
                label="Your name"
                hint="Patients see this as Dr followed by your name."
                error={errors.name}
                className="md:col-span-2"
              >
                {({ id, describedBy, invalid }) => (
                  <input
                    id={id}
                    name="name"
                    value={draft.name}
                    onChange={(event) => updateField("name", event.target.value)}
                    maxLength={100}
                    autoComplete="name"
                    aria-invalid={invalid}
                    aria-describedby={describedBy}
                    className="field"
                  />
                )}
              </Field>

              <Field id="specialty" label="Specialty" error={errors.specialty}>
                {({ id, describedBy, invalid }) => (
                  <input
                    id={id}
                    name="specialty"
                    value={draft.specialty}
                    onChange={(event) => updateField("specialty", event.target.value)}
                    placeholder="General practice"
                    maxLength={80}
                    aria-invalid={invalid}
                    aria-describedby={describedBy}
                    className="field"
                  />
                )}
              </Field>

              <Field id="qualification" label="Qualifications" error={errors.qualification}>
                {({ id, describedBy, invalid }) => (
                  <input
                    id={id}
                    name="qualification"
                    value={draft.qualification}
                    onChange={(event) => updateField("qualification", event.target.value)}
                    placeholder="MBBS, MD"
                    maxLength={80}
                    aria-invalid={invalid}
                    aria-describedby={describedBy}
                    className="field"
                  />
                )}
              </Field>

              <Field id="years" label="Years of experience" error={errors.years}>
                {({ id, describedBy, invalid }) => (
                  <input
                    id={id}
                    name="years"
                    inputMode="numeric"
                    value={draft.years}
                    onChange={(event) => updateField("years", event.target.value)}
                    placeholder="8"
                    maxLength={2}
                    aria-invalid={invalid}
                    aria-describedby={describedBy}
                    className="field tabular"
                  />
                )}
              </Field>

              <Field id="room" label="Room or clinic" error={errors.room}>
                {({ id, describedBy, invalid }) => (
                  <input
                    id={id}
                    name="room"
                    value={draft.room}
                    onChange={(event) => updateField("room", event.target.value)}
                    placeholder="Room 6"
                    maxLength={60}
                    aria-invalid={invalid}
                    aria-describedby={describedBy}
                    className="field"
                  />
                )}
              </Field>

              <Field
                id="fee"
                label="Consultation fee (₹)"
                optional
                hint="A flat fee for every visit with you. Enter 0 if you see patients free of charge. Leave blank to use the practice’s fees."
                error={errors.fee}
              >
                {({ id, describedBy, invalid }) => (
                  <input
                    id={id}
                    name="fee"
                    inputMode="decimal"
                    value={draft.fee}
                    onChange={(event) => updateField("fee", event.target.value)}
                    placeholder="450"
                    aria-invalid={invalid}
                    aria-describedby={describedBy}
                    className="field tabular"
                  />
                )}
              </Field>

              <Field
                id="languages"
                label="Languages"
                optional
                hint="Separate with commas."
                error={errors.languages}
              >
                {({ id, describedBy, invalid }) => (
                  <input
                    id={id}
                    name="languages"
                    value={draft.languages}
                    onChange={(event) => updateField("languages", event.target.value)}
                    placeholder="English, Hindi"
                    aria-invalid={invalid}
                    aria-describedby={describedBy}
                    className="field"
                  />
                )}
              </Field>

              <Field
                id="bio"
                label="Short bio"
                hint={`A sentence or two for patients choosing a doctor (${draft.bio.length}/600).`}
                error={errors.bio}
                className="md:col-span-2"
              >
                {({ id, describedBy, invalid }) => (
                  <textarea
                    id={id}
                    name="bio"
                    rows={4}
                    maxLength={600}
                    value={draft.bio}
                    onChange={(event) => updateField("bio", event.target.value)}
                    aria-invalid={invalid}
                    aria-describedby={describedBy}
                    className="field"
                  />
                )}
              </Field>

              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-hairline pt-4 md:col-span-2">
                <PendingButton
                  pendingLabel="Saving…"
                  className={buttonClass(
                    "primary",
                    "lg",
                    "group-has-[[aria-busy=true]]:pointer-events-none",
                  )}
                >
                  {welcome ? "Save and set up sessions" : "Save profile"}
                </PendingButton>
                <span className="text-caption text-muted">
                  Updates preview live as you type
                </span>
              </div>
            </form>
          </Card>

          {/* Right Rail: Live Patient Card Preview + Notifications Link */}
          <div className="min-w-0 space-y-5 lg:sticky lg:top-24 lg:col-span-5">
            <div className="flex items-center justify-between px-1">
              <span className="inline-flex items-center gap-2 text-callout font-semibold text-ink">
                <Eye size={16} className="text-accent" />
                <span>Live patient card preview</span>
              </span>
              <span className="text-caption text-muted">As patients see you</span>
            </div>

            <Card className="rounded-sheet p-5 text-left sm:p-6">
              <div className="space-y-5">
                {/* Doctor identity */}
                <div className="flex items-start gap-4">
                  <div
                    aria-hidden="true"
                    className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-accent/25 bg-accent-soft text-title3 font-semibold text-accent"
                  >
                    {initialsOf(displayName.replace(/^(dr|doctor)\.?\s+/i, ""))}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-title3 font-semibold text-ink">
                      {doctorTitle(displayName, "Dr Your Name")}
                    </h3>
                    <div className="mt-1.5 inline-flex items-center rounded-full border border-accent/20 bg-accent-soft px-3 py-0.5 text-caption font-semibold text-accent">
                      {displaySpecialty}
                    </div>
                    <p className="mt-2 truncate text-callout text-ink-2">
                      {displayQualification}
                    </p>
                  </div>
                </div>

                {/* Experience & Fee metrics */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-field border border-hairline bg-surface-2 p-3.5">
                    <span className="block text-caption text-muted">Experience</span>
                    <div className="mt-1 text-title3 font-semibold text-ink">
                      {yearsNum !== null ? (
                        <CountUp
                          to={yearsNum}
                          duration={0.45}
                          trigger="load"
                          suffix={yearsNum === 1 ? " yr" : " yrs"}
                          className="tabular"
                        />
                      ) : (
                        <span className="text-callout font-medium text-muted">—</span>
                      )}
                    </div>
                  </div>

                  <div className="rounded-field border border-hairline bg-surface-2 p-3.5">
                    <span className="block text-caption text-muted">Consultation fee</span>
                    <div className="mt-1 text-title3 font-semibold text-ink">
                      {feePence === undefined ? (
                        <span className="text-callout font-medium text-danger">Invalid fee</span>
                      ) : feePence === null ? (
                        <span className="text-callout font-semibold text-ink-2">Practice default</span>
                      ) : feePence === 0 ? (
                        <span className="text-callout font-semibold text-success">Free</span>
                      ) : (
                        <CountUp
                          to={feePence / 100}
                          prefix="₹"
                          decimals={feePence % 100 === 0 ? 0 : 2}
                          duration={0.45}
                          trigger="load"
                          className="tabular"
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* Room */}
                <div className="flex items-center gap-2 rounded-field border border-hairline bg-surface-2 px-3.5 py-2.5 text-callout text-ink-2">
                  <Pin size={16} className="shrink-0 text-accent" />
                  <span className="truncate font-medium text-ink">{displayRoom}</span>
                </div>

                {/* Languages */}
                <div>
                  <span className="block text-caption font-medium text-muted">Languages</span>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {languages.map((lang) => (
                      <span
                        key={lang}
                        className="inline-flex items-center rounded-full border border-hairline bg-fill px-2.5 py-1 text-caption font-medium text-ink-2"
                      >
                        {lang}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Bio */}
                <div className="border-t border-hairline pt-4">
                  <span className="block text-caption font-medium text-muted">About</span>
                  <p
                    className={`mt-1.5 text-callout leading-relaxed ${
                      draft.bio.trim() ? "text-ink-2" : "italic text-muted"
                    }`}
                  >
                    {displayBio}
                  </p>
                </div>
              </div>
            </Card>

            {/* Compact link card to Email Notification Preferences */}
            <Card className="rounded-sheet p-5">
              <div className="flex items-start gap-3.5">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-hairline bg-surface-2 text-accent">
                  <Bell size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-body font-semibold text-ink">Email notifications</h3>
                  <p className="mt-1 text-callout text-ink-2">
                    Choose which booking, cancellation, and morning summary emails we send you.
                  </p>
                  <div className="mt-3.5">
                    <ButtonLink href="/dashboard/notifications" variant="secondary" size="md">
                      <span>Manage email alerts</span>
                    </ButtonLink>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
    </div>
  );
}
