import { useState } from "react";
import { practice, reasons } from "./data";
import { addMinutes, ageLabel, formatFull, validatePatient } from "./format";
import { IconCheck } from "./icons";
import { Button, Field } from "./ui";

function controlClass(invalid) {
  return `w-full rounded-sm border bg-well px-3 py-3 text-body text-ink disabled:text-muted ${
    invalid ? "border-danger" : "border-line"
  }`;
}

const emptyErrors = {};

export function Details({ doctor, slot, form, submitting, onChange, onBack, onConfirm }) {
  const [errors, setErrors] = useState(emptyErrors);
  const reason = reasons.find((item) => item.id === form.reasonId) ?? null;
  const end = reason ? addMinutes(slot.time, reason.minutes) : null;
  const dobValid = form.dob && !validatePatient({ ...form, reasonId: form.reasonId || "new" }).dob;

  function update(partial) {
    onChange({ ...form, ...partial });
  }

  function submit(event) {
    event.preventDefault();
    if (form.isNew || submitting) return;
    const nextErrors = validatePatient(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      const first = Object.keys(nextErrors)[0];
      const target = first === "reasonId" ? "reason" : first;
      document.getElementById(target)?.focus({ focusVisible: true });
      return;
    }
    onConfirm();
  }

  return (
    <div className="mx-auto grid max-w-page grid-cols-12 gap-x-4 gap-y-8 px-4 md:gap-x-6 md:px-8 xl:gap-x-12">
      <aside className="col-span-12 xl:sticky xl:top-8 xl:col-span-5 xl:self-start">
        <p className="text-label text-muted uppercase">You are booking</p>
        <p className="mt-2 font-display text-title font-medium text-ink">{doctor.name}</p>
        <p className="mt-2 text-ui text-ink-soft">
          {doctor.qualification} · {doctor.interest} · {doctor.room}
        </p>
        <p className="mt-6 font-display text-numeral font-medium text-ink tabular-nums">{slot.time}</p>
        <p className="mt-3 max-w-prose text-body text-ink">{formatFull(slot.date)}</p>
        <h1 className="mt-8 font-display text-title font-medium text-ink">Who is attending</h1>
        <p className="mt-2 max-w-prose text-ui text-ink-soft">
          These details are yours. The visit itself is with {doctor.short}.
        </p>
        <dl className="mt-6 border-t border-line">
          <Fact term="Clinician" value={`${doctor.name}, ${doctor.room}`} />
          <Fact term="Length" value={reason ? `${reason.minutes} minutes, until ${end}` : "Set by the reason"} />
          <Fact term="Visit" value={reason ? reason.label : "Not chosen yet"} />
        </dl>
        <Button variant="quiet" className="mt-6" onClick={onBack}>
          Choose another time
        </Button>
        <p className="mt-3 text-ui text-ink-soft">Esc also returns to the book.</p>
      </aside>

      <form className="col-span-12 min-w-0 xl:col-span-7" onSubmit={submit} aria-busy={submitting} noValidate>
        <p className="text-label text-muted uppercase">2 of 3</p>
        {Object.keys(errors).length > 0 ? (
          <div role="alert" className="mt-4 border border-danger px-4 py-3">
            <p className="text-body text-danger">Check the highlighted fields.</p>
            <ul className="mt-2 grid gap-2">
              {Object.entries(errors).map(([key, message]) => (
                <li key={key}>
                  <a href={`#${key === "reasonId" ? "reason" : key}`} className="text-ui text-ink underline">
                    {message}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-6 grid grid-cols-1 gap-x-4 gap-y-6 md:grid-cols-2">
          <div className="md:col-span-2">
            <Field id="name" label="Full name" error={errors.name} hint="The person who will be seen.">
              {({ describedBy, invalid }) => (
                <input
                  id="name"
                  name="name"
                  autoComplete="name"
                  value={form.name}
                  aria-invalid={invalid}
                  aria-describedby={describedBy}
                  onChange={(event) => update({ name: event.target.value })}
                  className={controlClass(invalid)}
                />
              )}
            </Field>
          </div>

          <Field
            id="dob"
            label="Date of birth"
            error={errors.dob}
            hint={dobValid ? ageLabel(form.dob) : "We use this to find the record."}
          >
            {({ describedBy, invalid }) => (
              <input
                id="dob"
                name="bday"
                type="date"
                autoComplete="bday"
                min="1900-01-01"
                max="2026-10-26"
                value={form.dob}
                aria-invalid={invalid}
                aria-describedby={describedBy}
                onChange={(event) => update({ dob: event.target.value })}
                className={controlClass(invalid)}
              />
            )}
          </Field>

          <Field id="mobile" label="Mobile" error={errors.mobile} hint="We text if the clinic is running late.">
            {({ describedBy, invalid }) => (
              <input
                id="mobile"
                name="tel"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={form.mobile}
                aria-invalid={invalid}
                aria-describedby={describedBy}
                onChange={(event) => update({ mobile: event.target.value })}
                className={`${controlClass(invalid)} tabular-nums`}
              />
            )}
          </Field>

          <div className="md:col-span-2">
            <Field id="chi" label="CHI number, optional" error={errors.chi} hint="10 digits, beginning with the date of birth.">
              {({ describedBy, invalid }) => (
                <input
                  id="chi"
                  name="chi"
                  inputMode="numeric"
                  autoComplete="off"
                  spellCheck={false}
                  value={form.chi}
                  aria-invalid={invalid}
                  aria-describedby={describedBy}
                  onChange={(event) => update({ chi: event.target.value })}
                  className={`${controlClass(invalid)} tabular-nums`}
                />
              )}
            </Field>
          </div>

          <fieldset
            id="reason"
            tabIndex={-1}
            aria-invalid={Boolean(errors.reasonId)}
            aria-describedby={errors.reasonId ? "reason-error" : undefined}
            className="md:col-span-2"
          >
            <legend className="text-label text-muted uppercase">Reason</legend>
            <div className="mt-3 border-t border-line">
              {reasons.map((item) => {
                const checked = form.reasonId === item.id;
                return (
                  <label key={item.id} className="relative block border-b border-line">
                    <input
                      id={`reason-${item.id}`}
                      type="radio"
                      name="reason"
                      value={item.id}
                      checked={checked}
                      onChange={() => update({ reasonId: item.id })}
                      className="peer sr-only"
                    />
                    <span
                      className={`flex items-baseline justify-between gap-4 border-l-2 px-3 py-3 transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus ${
                        checked ? "border-accent bg-well" : "border-transparent hover:bg-well"
                      }`}
                    >
                      <span className="text-body text-ink">{item.label}</span>
                      <span className="text-ui text-ink-soft tabular-nums">{item.minutes} min</span>
                    </span>
                  </label>
                );
              })}
            </div>
            {errors.reasonId ? (
              <p id="reason-error" className="mt-2 text-ui text-danger" role="alert">
                {errors.reasonId}
              </p>
            ) : null}
          </fieldset>

          <div className="md:col-span-2">
            <Field id="note" label="Note for the clinician, optional" error={errors.note}>
              {({ describedBy, invalid }) => (
                <>
                  <textarea
                    id="note"
                    name="note"
                    rows={4}
                    maxLength={200}
                    value={form.note}
                    aria-invalid={invalid}
                    aria-describedby={`${describedBy ?? ""} note-count`.trim()}
                    onChange={(event) => update({ note: event.target.value })}
                    placeholder="Where it is, and how long it has been going on."
                    className={controlClass(invalid)}
                  />
                  <p
                    id="note-count"
                    className={`mt-2 text-ui tabular-nums ${form.note.length >= 200 ? "text-danger" : form.note.length >= 180 ? "text-warn" : "text-muted"}`}
                  >
                    {form.note.length} / 200
                  </p>
                </>
              )}
            </Field>
          </div>
        </div>

        <div className="mt-6 border-t border-line pt-6">
          <label className="relative flex items-start gap-3">
            <input
              id="isNew"
              type="checkbox"
              checked={form.isNew}
              onChange={(event) => update({ isNew: event.target.checked })}
              className="peer sr-only"
            />
            <span className="mt-1 h-4 w-4 shrink-0 rounded-sm border border-line bg-paper peer-checked:border-accent peer-checked:bg-accent peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus" />
            <IconCheck className="pointer-events-none absolute top-1 left-0 hidden h-4 w-4 text-accent-ink peer-checked:block" />
            <span>
              <span className="block text-body text-ink">I am new to this practice</span>
              <span className="mt-1 block max-w-prose text-ui text-ink-soft">
                Tick this if you are not yet on our list.
              </span>
            </span>
          </label>
          {form.isNew ? (
            <p role="status" className="mt-4 border border-line bg-well px-4 py-3 text-body text-ink">
              New patients register by phone. Call{" "}
              <a href={practice.phoneHref} className="tabular-nums underline">
                {practice.phoneDisplay}
              </a>
              . This book is for people already on the list.
            </p>
          ) : null}
        </div>

        <div className="mt-6 flex flex-col items-stretch justify-between gap-4 border-t border-line pt-6 md:flex-row md:items-center">
          <p className="text-ui text-ink-soft">NHS visit. No fee.</p>
          <Button type="submit" disabled={form.isNew || submitting}>
            {submitting ? "Confirming…" : "Confirm booking"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Fact({ term, value }) {
  return (
    <div className="grid grid-cols-12 gap-4 border-b border-line py-3">
      <dt className="col-span-4 text-label text-muted uppercase">{term}</dt>
      <dd className="col-span-8 text-body text-ink tabular-nums">{value}</dd>
    </div>
  );
}
