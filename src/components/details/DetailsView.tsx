"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { AppointmentSummary } from "@/components/booking/AppointmentSummary";
import { Alert, Check, Lock } from "@/components/icons";
import { useBooking } from "@/components/providers/BookingProvider";
import { useClock } from "@/components/providers/ClockProvider";
import { PageHeading } from "@/components/shell/PageHeading";
import { Button } from "@/components/ui/Button";
import { Card, Notice } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Switch } from "@/components/ui/Switch";
import { mondayOf } from "@/lib/clock";
import { practice, reasons, type Doctor } from "@/lib/data";
import { feeFor, formatMoney } from "@/lib/fees";
import { ageLabel, formatWhen } from "@/lib/format";
import { spring } from "@/lib/motion";
import { bookAppointment } from "@/server/booking-actions";
import { FIELD_ORDER, NOTE_LIMIT, validateDob, validatePatient, type PatientErrors, type PatientForm } from "@/lib/validate";

const FIELD_TARGET: Partial<Record<keyof PatientForm, string>> = { reasonId: `reason-${reasons[0]!.id}` };

function targetId(key: keyof PatientForm): string {
  return FIELD_TARGET[key] ?? key;
}

export interface BookingAccount {
  name: string;
  dob: string;
  mobile: string;
  email: string;
}

export function DetailsView({ doctors, account }: { doctors: Doctor[]; account: BookingAccount }) {
  const router = useRouter();
  const { state, dispatch, ready } = useBooking();
  const { window } = useClock();
  const [errors, setErrors] = useState<PatientErrors>({});
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  /** Demo payments: pay now with a pretend card, or at the desk on the day. */
  const [payNow, setPayNow] = useState(true);
  const leaving = useRef(false);
  const prefilled = useRef(false);

  const { held, form } = state;
  const doctor = held ? (doctors.find((item) => item.id === held.doctorId) ?? null) : null;
  const reason = reasons.find((item) => item.id === form.reasonId) ?? null;
  const fee = reason ? feeFor(reason.id) : 0;
  const backHref = held ? `/doctors/${held.doctorId}?week=${mondayOf(held.date)}` : "/book";

  // Nothing held (fresh tab, or the booking just finished): start from the directory.
  useEffect(() => {
    if (ready && (!held || !doctor) && !leaving.current) router.replace("/book");
  }, [ready, held, doctor, router]);

  useEffect(() => {
    if (!ready || prefilled.current) return;
    prefilled.current = true;
    const patch: Partial<PatientForm> = {};
    if (!form.name && account.name) patch.name = account.name;
    if (!form.dob && account.dob) patch.dob = account.dob;
    if (!form.mobile && account.mobile) patch.mobile = account.mobile;
    if (Object.keys(patch).length > 0) dispatch({ type: "updateForm", patch });
  }, [ready, account, form.name, form.dob, form.mobile, dispatch]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      // An open header menu closes on Escape first, and marks the key as handled.
      if (event.key !== "Escape" || event.defaultPrevented || target?.closest("input, textarea, select")) return;
      router.push(backHref);
    }
    globalThis.addEventListener("keydown", onKey);
    return () => globalThis.removeEventListener("keydown", onKey);
  }, [backHref, router]);

  if (!ready || !held || !doctor) {
    return (
      <div className="mx-auto max-w-page px-5 pt-10 md:px-8" aria-busy="true">
        <div className="h-10 w-64 animate-pulse rounded-field bg-fill" />
        <p className="sr-only" role="status">
          Loading your appointment
        </p>
      </div>
    );
  }

  const heldSlot = held;
  const heldDoctor = doctor;

  function update(patch: Partial<PatientForm>) {
    dispatch({ type: "updateForm", patch });
    if (attempted) setErrors(validatePatient({ ...form, ...patch }, window.today));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (form.isNew || submitting) return;
    setAttempted(true);
    setFailure(null);
    const nextErrors = validatePatient(form, window.today);
    setErrors(nextErrors);
    const first = FIELD_ORDER.find((key) => nextErrors[key]);
    if (first) {
      document.getElementById(targetId(first))?.focus();
      return;
    }

    setSubmitting(true);
    try {
      const result = await bookAppointment({
        slot: heldSlot,
        reasonId: form.reasonId,
        patientName: form.name,
        patientDob: form.dob,
        patientMobile: form.mobile,
        patientChi: form.chi,
        note: form.note,
        payNow,
      });
      if (!result.ok) {
        if (result.reason === "signed-out") {
          // The session ended while the form was open. The held time is still in sessionStorage.
          leaving.current = true;
          router.push(`/sign-in?next=${encodeURIComponent("/book/details")}`);
          return;
        }
        if (result.reason === "invalid" || result.reason === "staff") {
          setSubmitting(false);
          setFailure(result.message);
          return;
        }
        leaving.current = true;
        const what = result.reason === "past" ? "has closed for online booking" : "was just booked by someone else";
        dispatch({ type: "slotLost", slot: heldSlot, message: `${formatWhen(heldSlot, window.today)} ${what}.` });
        router.push(backHref);
        return;
      }
      leaving.current = true;
      dispatch({
        type: "confirmed",
        booking: {
          reference: result.reference,
          doctorId: heldDoctor.id,
          slot: heldSlot,
          reasonId: form.reasonId,
          patient: form,
          payment: result.payment ?? undefined,
        },
      });
      router.push("/book/confirmed");
    } catch {
      setSubmitting(false);
      setFailure("We couldn’t reach the booking system. Nothing has been booked. Please try again.");
    }
  }

  const errorEntries = FIELD_ORDER.filter((key) => errors[key]).map((key) => [key, errors[key]!] as const);
  const dobHint = form.dob && !validateDob(form.dob, window.today) ? ageLabel(form.dob, window.today) : "As on your NHS record.";

  return (
    <div className="mx-auto max-w-page px-5 pt-8 pb-20 md:px-8 md:pt-12">
      <PageHeading className="text-title2 font-semibold text-ink md:text-title1">Your details</PageHeading>
      <p className="mt-2 max-w-prose text-body text-ink-2">
        Tell us who’s coming in, so we can find the right record.
      </p>
      <Notice tone="info" className="mt-6">
        Signed in as {account.name}. This visit is saved to your appointments and to {heldDoctor.short}’s clinic book.
      </Notice>

      <div className="mt-8 grid gap-6 lg:grid-cols-12 lg:gap-10">
        <aside className="lg:sticky lg:top-[calc(var(--header-h)+1.5rem)] lg:order-2 lg:col-span-5 lg:self-start">
          <AppointmentSummary
            doctor={heldDoctor}
            slot={heldSlot}
            reason={reason}
            footer={
              <Link href={backHref} className="inline-flex min-h-11 items-center text-body text-accent hover:underline underline-offset-4">
                Change time
              </Link>
            }
          />
        </aside>

        <form noValidate onSubmit={submit} aria-busy={submitting} className="grid gap-6 lg:order-1 lg:col-span-7">
          <AnimatePresence initial={false}>
            {errorEntries.length > 0 ? (
              <motion.div
                key="summary"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={spring.gentle}
              >
                <Notice tone="danger" role="alert" aria-labelledby="error-summary-title">
                  <p id="error-summary-title" className="flex items-center gap-2 font-semibold">
                    <Alert size={20} className="text-danger" />
                    {errorEntries.length === 1 ? "There’s 1 thing to fix" : `There are ${errorEntries.length} things to fix`}
                  </p>
                  <ul className="mt-2 grid gap-1 pl-7">
                    {errorEntries.map(([key, message]) => (
                      <li key={key}>
                        <a
                          href={`#${targetId(key)}`}
                          onClick={(event) => {
                            event.preventDefault();
                            document.getElementById(targetId(key))?.focus();
                          }}
                          className="text-danger underline underline-offset-4"
                        >
                          {message}
                        </a>
                      </li>
                    ))}
                  </ul>
                </Notice>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <Card className="grid gap-5 p-5 md:grid-cols-2 md:p-6">
            <h2 className="text-title3 font-semibold text-ink md:col-span-2">Who’s attending</h2>
            <Field id="name" label="Full name" error={errors.name} className="md:col-span-2">
              {({ id, describedBy, invalid }) => (
                <input
                  id={id}
                  name="name"
                  autoComplete="name"
                  value={form.name}
                  maxLength={100}
                  aria-invalid={invalid}
                  aria-describedby={describedBy}
                  aria-required="true"
                  onChange={(event) => update({ name: event.target.value })}
                  className="field"
                />
              )}
            </Field>
            <Field id="dob" label="Date of birth" hint={dobHint} error={errors.dob}>
              {({ id, describedBy, invalid }) => (
                <input
                  id={id}
                  name="bday"
                  type="date"
                  autoComplete="bday"
                  min="1900-01-01"
                  max={window.today}
                  value={form.dob}
                  aria-invalid={invalid}
                  aria-describedby={describedBy}
                  aria-required="true"
                  onChange={(event) => update({ dob: event.target.value })}
                  className="field tabular"
                />
              )}
            </Field>
            <Field id="mobile" label="Mobile number" hint="We’ll text if the clinic is running late." error={errors.mobile}>
              {({ id, describedBy, invalid }) => (
                <input
                  id={id}
                  name="tel"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="07700 900123"
                  value={form.mobile}
                  aria-invalid={invalid}
                  aria-describedby={describedBy}
                  aria-required="true"
                  onChange={(event) => update({ mobile: event.target.value })}
                  className="field tabular"
                />
              )}
            </Field>
            <Field
              id="chi"
              label="CHI number"
              optional
              hint="10 digits, starting with your date of birth. It’s on letters from the NHS."
              error={errors.chi}
              className="md:col-span-2"
            >
              {({ id, describedBy, invalid }) => (
                <input
                  id={id}
                  name="chi"
                  inputMode="numeric"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={14}
                  value={form.chi}
                  aria-invalid={invalid}
                  aria-describedby={describedBy}
                  onChange={(event) => update({ chi: event.target.value })}
                  className="field tabular md:max-w-xs"
                />
              )}
            </Field>
          </Card>

          <Card className="p-5 md:p-6">
            <fieldset aria-describedby={errors.reasonId ? "reason-error" : undefined}>
              <legend className="text-title3 font-semibold text-ink">What’s the visit for?</legend>
              <div className="mt-4 grid gap-2" role="presentation">
                {reasons.map((item) => {
                  const checked = form.reasonId === item.id;
                  return (
                    <label key={item.id} className="group relative block cursor-pointer">
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
                        className={`flex min-h-13 items-center justify-between gap-4 rounded-field px-4 py-3 transition-[background-color,box-shadow] duration-200 peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent/55 ${
                          checked
                            ? "bg-accent-soft shadow-[inset_0_0_0_2px_var(--color-accent)]"
                            : errors.reasonId
                              ? "shadow-[inset_0_0_0_1px_var(--color-danger)] hover:bg-fill"
                              : "shadow-[inset_0_0_0_1px_var(--color-hairline)] hover:bg-fill"
                        }`}
                      >
                        <span className="text-body text-ink">{item.label}</span>
                        <span className="flex items-center gap-3">
                          {/* Muted grey only on white: on the hover and selected tints it drops below 4.5:1. */}
                          <span className={`tabular text-callout ${checked ? "text-ink-2" : "text-muted group-hover:text-ink-2"}`}>
                            {item.minutes} min
                          </span>
                          <span
                            aria-hidden="true"
                            className={`grid size-6 place-items-center rounded-full transition-colors duration-200 ${
                              checked ? "bg-accent text-white" : "shadow-[inset_0_0_0_1.5px_var(--color-control)]"
                            }`}
                          >
                            <AnimatePresence initial={false}>
                              {checked ? (
                                <motion.span
                                  initial={{ scale: 0.4, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  exit={{ scale: 0.4, opacity: 0 }}
                                  transition={spring.press}
                                >
                                  <Check size={14} strokeWidth={3} />
                                </motion.span>
                              ) : null}
                            </AnimatePresence>
                          </span>
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
              {errors.reasonId ? (
                <p id="reason-error" className="mt-3 flex items-center gap-1.5 text-callout text-danger">
                  <Alert size={18} />
                  {errors.reasonId}
                </p>
              ) : null}
            </fieldset>

            <Field id="note" label="Anything the doctor should know?" optional error={errors.note} className="mt-6">
              {({ id, describedBy, invalid }) => (
                <>
                  <textarea
                    id={id}
                    name="note"
                    rows={3}
                    maxLength={NOTE_LIMIT}
                    value={form.note}
                    aria-invalid={invalid}
                    aria-describedby={`${describedBy ?? ""} note-count`.trim()}
                    onChange={(event) => update({ note: event.target.value })}
                    placeholder="For example, where it hurts and how long it’s been going on."
                    className="field resize-y"
                  />
                  <p
                    id="note-count"
                    className={`tabular mt-2 text-right text-caption transition-colors ${
                      form.note.length >= NOTE_LIMIT ? "text-danger" : form.note.length >= NOTE_LIMIT - 20 ? "text-warn" : "text-muted"
                    }`}
                  >
                    {form.note.length} of {NOTE_LIMIT} characters
                  </p>
                </>
              )}
            </Field>
          </Card>

          <Card className="p-5 md:p-6">
            <fieldset>
              <legend className="text-title3 font-semibold text-ink">Payment</legend>
              <p className="mt-1 text-callout text-ink-2">
                {reason ? `${reason.label}: ${formatMoney(fee)}.` : "The fee depends on what the visit is for."} This is a
                demonstration practice, so no card is charged and no money moves.
              </p>
              <div className="mt-4 grid gap-2">
                {[
                  { now: true, label: "Pay now with a demo card", hint: "Marked as paid straight away." },
                  { now: false, label: "Pay at the desk", hint: "By card or cash when you arrive." },
                ].map((option) => (
                  <label
                    key={option.label}
                    className="flex min-h-13 cursor-pointer items-center gap-3 rounded-field px-4 py-3 shadow-[inset_0_0_0_1px_var(--color-hairline)] transition-colors hover:bg-fill has-checked:bg-accent-soft has-checked:shadow-[inset_0_0_0_2px_var(--color-accent)]"
                  >
                    <input
                      type="radio"
                      name="payment"
                      checked={payNow === option.now}
                      onChange={() => setPayNow(option.now)}
                      className="size-5 shrink-0 accent-accent"
                    />
                    <span>
                      <span className="block text-body text-ink">{option.label}</span>
                      <span className="block text-callout text-ink-2">{option.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          </Card>

          <Card className="p-5 md:p-6">
            <Switch
              checked={form.isNew}
              onChange={(isNew) => update({ isNew })}
              label="I’m not registered here yet"
              description="Online booking is for patients already registered at the practice."
            />
            <AnimatePresence initial={false}>
              {form.isNew ? (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={spring.gentle}
                  className="overflow-hidden"
                >
                  <Notice tone="info" role="status" className="mt-4">
                    Please register first by calling{" "}
                    <a href={practice.phoneHref} className="tabular font-semibold text-accent">
                      {practice.phoneDisplay}
                    </a>
                    . We can book your first visit on the same call.
                  </Notice>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </Card>

          {failure ? (
            <Notice tone="danger" role="alert" className="flex items-start gap-2">
              <Alert size={20} className="mt-px shrink-0 text-danger" />
              {failure}
            </Notice>
          ) : null}

          <div className="flex flex-col-reverse gap-4 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 text-callout text-muted">
              <Lock size={18} />
              {reason
                ? payNow
                  ? `${formatMoney(fee)} by demo card. No card is charged.`
                  : `${formatMoney(fee)} to pay at the desk.`
                : "Demo payments. No card is ever charged."}
            </p>
            <Button
              type="submit"
              size="lg"
              disabled={form.isNew}
              loading={submitting}
              loadingLabel="Booking…"
              className="w-full sm:w-auto sm:min-w-48"
            >
              Book appointment
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
