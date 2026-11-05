"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { DoctorPortrait } from "@/components/doctors/DoctorPortrait";
import { Alert } from "@/components/icons";
import { useBooking } from "@/components/providers/BookingProvider";
import { useClock } from "@/components/providers/ClockProvider";
import { PageHeading } from "@/components/shell/PageHeading";
import { buttonClass } from "@/components/ui/button-styles";
import { Spinner as ButtonSpinner } from "@/components/ui/Spinner";
import type { Doctor } from "@/lib/data";
import { practice } from "@/lib/data";
import { formatWhen } from "@/lib/format";
import { requestPasswordReset, signInWithPassword, signUpWithPassword, type SignInMode } from "@/server/auth-actions";

type View = "signin" | "signup" | "forgot";
type SignupRole = "patient" | "doctor";

const MIN_PASSWORD = 8;

interface Props {
  nextPath: string;
  mode: SignInMode;
  doctors: Doctor[];
  /** Shown when Google sign-in bounced back with a problem. */
  notice?: string | null;
  /** Open on the sign-up form rather than sign-in. */
  initialView?: View;
}

export function SignInPanel({ nextPath, mode, doctors, notice = null, initialView = "signin" }: Props) {
  const staff = mode === "staff";
  const [view, setView] = useState<View>(staff && initialView === "signup" ? "signin" : initialView);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [role, setRole] = useState<SignupRole>("patient");
  const [error, setError] = useState<string | null>(notice);
  const [sent, setSent] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [busyLabel, setBusyLabel] = useState("");

  function go(next: View) {
    setError(null);
    setSent(null);
    setPassword("");
    setConfirm("");
    setView(next);
  }

  function run(label: string, work: () => Promise<{ ok: boolean; error?: string; message?: string } | undefined>) {
    if (pending) return;
    setBusyLabel(label);
    startTransition(async () => {
      // Success on sign-in and sign-up redirects, so only problems (and the reset notice) come back.
      const result = await work();
      if (!result) return;
      if (!result.ok) {
        setError(result.error ?? "Something went wrong. Try again.");
        return;
      }
      setError(null);
      if (result.message) setSent(result.message);
    });
  }

  function submitSignIn(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    run("Signing in…", () => signInWithPassword({ email, password, next: nextPath }));
  }

  function submitSignUp(event: FormEvent) {
    event.preventDefault();
    if (password.length < MIN_PASSWORD) {
      setError(`Use at least ${MIN_PASSWORD} characters for your password.`);
      return;
    }
    if (password !== confirm) {
      setError("The two passwords don’t match.");
      return;
    }
    run(role === "doctor" ? "Creating your doctor account…" : "Creating your account…", () =>
      signUpWithPassword({ name, email, password, confirm, role, next: nextPath, mobile }),
    );
  }

  function submitForgot(event: FormEvent) {
    event.preventDefault();
    run("Sending link…", () => requestPasswordReset({ email }));
  }

  const googleHref = `/auth/google${nextPath === "/" ? "" : `?next=${encodeURIComponent(nextPath)}`}`;
  const withNext = (base: string) => (nextPath === "/" ? base : `${base}${base.includes("?") ? "&" : "?"}next=${encodeURIComponent(nextPath)}`);

  const footerLink = staff ? (
    <>
      Not a doctor?{" "}
      <a href={withNext("/sign-in")} className="font-medium text-accent">
        Patient sign-in
      </a>
    </>
  ) : (
    <>
      Doctor or reception?{" "}
      <a href={withNext("/sign-in?as=staff")} className="font-medium text-accent">
        Sign in as a doctor
      </a>
    </>
  );

  let body: ReactNode;
  if (view === "forgot") {
    body = (
      <form onSubmit={submitForgot} noValidate>
        <h2 className="px-2 text-title3 font-semibold text-ink">Reset your password</h2>
        <p className="mt-1 px-2 text-callout text-ink-2">Enter your email and we’ll send you a link to choose a new password.</p>
        <TextField id="email" label="Email" type="email" autoComplete="email" value={email} onChange={setEmail} pending={pending} error={error} autoFocus />
        <ErrorText id="form-error" message={error} />
        {sent ? (
          <p role="status" className="mt-3 rounded-card bg-canvas p-3 text-callout text-ink">
            {sent}
          </p>
        ) : null}
        <SubmitButton pending={pending} busyLabel={busyLabel}>
          Email me a reset link
        </SubmitButton>
        <LinkButton onClick={() => go("signin")} disabled={pending}>
          Back to sign in
        </LinkButton>
      </form>
    );
  } else if (view === "signup") {
    body = (
      <form onSubmit={submitSignUp} noValidate>
        <h2 className="px-2 text-title3 font-semibold text-ink">Create your account</h2>
        <fieldset className="mt-3">
          <legend className="px-2 text-callout font-medium text-ink">I’m signing up as</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(["patient", "doctor"] as const).map((option) => (
              <label
                key={option}
                className={`cursor-pointer rounded-card border p-3 text-callout has-focus-visible:border-accent ${
                  role === option ? "border-accent bg-accent/5" : "border-control bg-surface hover:border-ink-2"
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value={option}
                  checked={role === option}
                  onChange={() => setRole(option)}
                  className="sr-only"
                />
                <span className="block font-semibold text-ink">{option === "patient" ? "A patient" : "A doctor"}</span>
                <span className="mt-0.5 block text-ink-2">{option === "patient" ? "Book visits with our doctors." : "Set up sessions and take bookings."}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <TextField id="name" label="Full name" autoComplete="name" value={name} onChange={setName} pending={pending} error={error} maxLength={100} autoFocus />
        <TextField id="email" label="Email" type="email" autoComplete="email" value={email} onChange={setEmail} pending={pending} error={error} />
        <TextField
          id="mobile"
          label="Mobile (optional)"
          type="tel"
          autoComplete="tel"
          value={mobile}
          onChange={setMobile}
          pending={pending}
          error={error}
          hint="For booking texts and reminders, e.g. +91 98765 43210."
          maxLength={20}
        />
        <TextField
          id="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
          pending={pending}
          error={error}
          hint={`At least ${MIN_PASSWORD} characters.`}
          maxLength={200}
        />
        <TextField
          id="confirm"
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={setConfirm}
          pending={pending}
          error={error}
          maxLength={200}
        />
        <ErrorText id="form-error" message={error} />
        <SubmitButton pending={pending} busyLabel={busyLabel}>
          {role === "doctor" ? "Create doctor account" : "Create account"}
        </SubmitButton>
        <p className="mt-3 text-center text-callout text-ink-2">
          Already have an account?{" "}
          <button type="button" onClick={() => go("signin")} className="font-medium text-accent hover:underline underline-offset-4">
            Sign in
          </button>
        </p>
      </form>
    );
  } else {
    body = (
      <form onSubmit={submitSignIn} noValidate>
        <TextField
          id="email"
          label={staff ? "Practice email" : "Email"}
          type="email"
          autoComplete="username"
          value={email}
          onChange={setEmail}
          pending={pending}
          error={error}
          autoFocus
        />
        <TextField
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
          pending={pending}
          error={error}
          maxLength={200}
        />
        <div className="mt-1 flex justify-end px-2">
          <button type="button" onClick={() => go("forgot")} className="min-h-11 text-callout text-accent hover:underline underline-offset-4">
            Forgot password?
          </button>
        </div>
        <ErrorText id="form-error" message={error} />
        <SubmitButton pending={pending} busyLabel={busyLabel}>
          Sign in
        </SubmitButton>
        {staff ? null : (
          <p className="mt-3 text-center text-callout text-ink-2">
            New here?{" "}
            <button type="button" onClick={() => go("signup")} className="font-medium text-accent hover:underline underline-offset-4">
              Create an account
            </button>
          </p>
        )}
      </form>
    );
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-surface px-5 py-12">
      <div className="grid w-full max-w-3xl items-center gap-10 md:grid-cols-2 md:gap-16">
        {/* Left: the practice */}
        <div className="text-center md:text-left">
          <a href="/" aria-label={`${practice.name} home`} className="inline-grid size-11 place-items-center rounded-xl bg-accent text-white">
            <svg width="20" height="20" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
              <path d="M5 1h4v4h4v4H9v4H5V9H1V5h4z" />
            </svg>
          </a>
          <PageHeading className="mt-6 font-statement text-title1 font-bold tracking-[-0.02em] text-ink">
            Welcome to {practice.shortName}
          </PageHeading>
          <p className="mt-1 text-title3 font-normal text-muted">{staff ? "Clinic staff sign-in" : "Book your visit online"}</p>
          {staff ? null : <HeldTime nextPath={nextPath} doctors={doctors} />}
        </div>

        {/* Right: Google, or, the form */}
        <div className="w-full">
          {staff || view === "forgot" ? null : (
            <>
              <a
                href={googleHref}
                className="flex h-14 w-full items-center justify-center gap-3 rounded-full border border-control bg-surface px-6 text-body font-medium text-ink no-underline hover:bg-fill"
              >
                <GoogleMark />
                {view === "signup" ? "Sign up with Google" : "Sign in with Google"}
              </a>
              <div className="my-4 flex items-center gap-3 text-caption text-muted" aria-hidden="true">
                <span className="h-px flex-1 bg-hairline" />
                OR
                <span className="h-px flex-1 bg-hairline" />
              </div>
            </>
          )}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
            >
              {body}
            </motion.div>
          </AnimatePresence>
          <span role="status" aria-live="polite" className="sr-only">
            {pending ? busyLabel : ""}
          </span>
          <p className="mt-8 text-center text-callout text-ink-2">{footerLink}</p>
        </div>
      </div>
    </div>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  pending,
  error,
  type = "text",
  autoComplete,
  autoFocus,
  maxLength,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  pending: boolean;
  error: string | null;
  type?: "text" | "email" | "password" | "tel";
  autoComplete?: string;
  autoFocus?: boolean;
  maxLength?: number;
  hint?: string;
}) {
  return (
    <div className="mt-3">
      <label htmlFor={id} className="block px-2 text-callout font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        inputMode={type === "email" ? "email" : undefined}
        spellCheck={false}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        maxLength={maxLength}
        readOnly={pending}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={[hint ? `${id}-hint` : "", error ? "form-error" : ""].filter(Boolean).join(" ") || undefined}
        className="field mt-1 h-12 rounded-full! px-5"
      />
      {hint ? (
        <p id={`${id}-hint`} className="mt-1 px-2 text-caption text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function SubmitButton({ pending, busyLabel, children }: { pending: boolean; busyLabel: string; children: ReactNode }) {
  return (
    <button type="submit" disabled={pending} aria-busy={pending || undefined} className={buttonClass("primary", "lg", "mt-4 w-full disabled:cursor-progress")}>
      {pending ? <ButtonSpinner /> : null}
      {pending ? busyLabel : children}
    </button>
  );
}

function LinkButton({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="mt-2 min-h-11 w-full text-callout text-accent hover:underline underline-offset-4">
      {children}
    </button>
  );
}

function ErrorText({ id, message }: { id: string; message: string | null }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-2 flex items-start gap-1.5 px-2 text-callout text-danger">
      <Alert size={18} className="mt-px shrink-0" />
      <span>{message}</span>
    </p>
  );
}

/** If they came from choosing a time, show it, so they know it's kept. */
function HeldTime({ nextPath, doctors }: { nextPath: string; doctors: Doctor[] }) {
  const { state, ready } = useBooking();
  const { window } = useClock();
  const held = state.held;
  const doctor = held ? doctors.find((item) => item.id === held.doctorId) : null;
  if (!ready || nextPath !== "/book/details" || !held || !doctor) return null;
  return (
    <div className="mt-6 inline-flex items-center gap-3 rounded-card bg-canvas p-3 pr-5 text-left">
      <DoctorPortrait doctor={doctor} size={44} />
      <p className="text-callout">
        <span className="block font-semibold text-ink">Holding your time</span>
        <span className="tabular text-ink-2">
          {doctor.short}, {formatWhen(held, window.today)}
        </span>
      </p>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
