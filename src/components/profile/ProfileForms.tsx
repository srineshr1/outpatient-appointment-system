"use client";

import { useActionState } from "react";
import { Notice } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { PendingButton } from "@/components/ui/PendingButton";
import { buttonClass } from "@/components/ui/button-styles";
import type { FormState } from "@/lib/form-state";
import { GENDERS } from "@/lib/profiles";
import { PHONE_HINT, PHONE_PLACEHOLDER } from "@/lib/phone";
import { saveDoctorProfile, savePatientProfile } from "@/server/profile-actions";

function Problem({ state }: { state: FormState }) {
  if (!state || state.ok) return null;
  return (
    <Notice tone="danger" role="alert" className="md:col-span-2">
      {state.message}
    </Notice>
  );
}

export function PatientProfileForm({
  initial,
  welcome,
  next,
  today,
}: {
  initial: { name: string; mobile: string; dob: string; gender: string };
  welcome: boolean;
  next: string;
  today: string;
}) {
  const [state, action] = useActionState(savePatientProfile, null);
  const v = (key: keyof typeof initial) => state?.values?.[key] ?? initial[key];
  const e = state?.errors ?? {};
  return (
    <form action={action} className="group mt-8 grid gap-5 rounded-card bg-surface p-5 shadow-card md:grid-cols-2 md:p-6">
      <input type="hidden" name="welcome" value={welcome ? "1" : ""} />
      <input type="hidden" name="next" value={next} />
      <Problem state={state} />
      <Field id="name" label="Full name" error={e.name} className="md:col-span-2">
        {({ id, describedBy, invalid }) => (
          <input id={id} name="name" autoComplete="name" defaultValue={v("name")} maxLength={100} aria-invalid={invalid} aria-describedby={describedBy} className="field" />
        )}
      </Field>
      <Field id="mobile" label="Mobile number" hint={PHONE_HINT} error={e.mobile}>
        {({ id, describedBy, invalid }) => (
          <input id={id} name="mobile" type="tel" inputMode="tel" autoComplete="tel" placeholder={PHONE_PLACEHOLDER} defaultValue={v("mobile")} aria-invalid={invalid} aria-describedby={describedBy} className="field tabular" />
        )}
      </Field>
      <Field id="dob" label="Date of birth" optional error={e.dob}>
        {({ id, describedBy, invalid }) => (
          <input id={id} name="dob" type="date" min="1900-01-01" max={today} defaultValue={v("dob")} aria-invalid={invalid} aria-describedby={describedBy} className="field tabular" />
        )}
      </Field>
      <Field id="gender" label="Gender" optional error={e.gender}>
        {({ id, describedBy, invalid }) => (
          <select id={id} name="gender" defaultValue={v("gender")} aria-invalid={invalid} aria-describedby={describedBy} className="field">
            <option value="">Prefer not to say</option>
            {GENDERS.filter((item) => item.id !== "prefer-not").map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        )}
      </Field>
      <div className="md:col-span-2">
        <PendingButton pendingLabel="Saving…" className={buttonClass("primary", "lg", "group-has-[[aria-busy=true]]:pointer-events-none")}>
          {welcome ? "Save and continue" : "Save profile"}
        </PendingButton>
      </div>
    </form>
  );
}

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

export function DoctorProfileForm({ initial, welcome }: { initial: DoctorFormValues; welcome: boolean }) {
  const [state, action] = useActionState(saveDoctorProfile, null);
  const v = (key: keyof DoctorFormValues) => state?.values?.[key] ?? initial[key];
  const e = state?.errors ?? {};
  const text = (id: keyof DoctorFormValues, label: string, extra: { hint?: string; optional?: boolean; wide?: boolean; placeholder?: string; inputMode?: "numeric" | "decimal" } = {}) => (
    <Field id={id} label={label} hint={extra.hint} optional={extra.optional} error={e[id]} className={extra.wide ? "md:col-span-2" : ""}>
      {({ id: fieldId, describedBy, invalid }) => (
        <input id={fieldId} name={id} defaultValue={v(id)} placeholder={extra.placeholder} inputMode={extra.inputMode} aria-invalid={invalid} aria-describedby={describedBy} className="field" />
      )}
    </Field>
  );
  return (
    <form action={action} className="group mt-8 grid gap-5 rounded-card bg-surface p-5 shadow-card md:grid-cols-2 md:p-6">
      <input type="hidden" name="welcome" value={welcome ? "1" : ""} />
      <Problem state={state} />
      {text("name", "Your name", { hint: "Patients see this as Dr followed by your name.", wide: true })}
      {text("specialty", "Specialty", { placeholder: "General practice" })}
      {text("qualification", "Qualifications", { placeholder: "MBBS, MD" })}
      {text("years", "Years of experience", { inputMode: "numeric", placeholder: "8" })}
      {text("room", "Room or clinic", { placeholder: "Room 6" })}
      {text("fee", "Consultation fee (₹)", { optional: true, inputMode: "decimal", hint: "A flat fee for every visit with you. Enter 0 if you see patients free of charge. Leave blank to use the practice’s fees." })}
      {text("languages", "Languages", { optional: true, placeholder: "English, Hindi", hint: "Separate with commas." })}
      <Field id="bio" label="Short bio" hint="A sentence or two for patients choosing a doctor." error={e.bio} className="md:col-span-2">
        {({ id, describedBy, invalid }) => (
          <textarea id={id} name="bio" rows={4} maxLength={600} defaultValue={v("bio")} aria-invalid={invalid} aria-describedby={describedBy} className="field" />
        )}
      </Field>
      <div className="md:col-span-2">
        <PendingButton pendingLabel="Saving…" className={buttonClass("primary", "lg", "group-has-[[aria-busy=true]]:pointer-events-none")}>
          {welcome ? "Save and set up sessions" : "Save profile"}
        </PendingButton>
      </div>
    </form>
  );
}
