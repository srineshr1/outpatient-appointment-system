"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { DoctorPortrait } from "@/components/doctors/DoctorPortrait";
import { Alert } from "@/components/icons";
import { useBooking } from "@/components/providers/BookingProvider";
import { useClock } from "@/components/providers/ClockProvider";
import { PageHeading } from "@/components/shell/PageHeading";
import { buttonClass } from "@/components/ui/button-styles";
import type { Doctor } from "@/lib/data";
import { practice } from "@/lib/data";
import { formatWhen } from "@/lib/format";
import { CODE_LENGTH } from "@/lib/sign-in-config";
import { completeSignup, requestCode, verifyCode, type SignInMode } from "@/server/auth-actions";

type Step = "email" | "code" | "name";

const emptyDigits = (length: number = CODE_LENGTH) => Array.from({ length }, () => "");

interface Props {
  nextPath: string;
  mode: SignInMode;
  doctors: Doctor[];
  /** Shown when Google sign-in bounced back with a problem. */
  notice?: string | null;
}

export function SignInPanel({ nextPath, mode, doctors, notice = null }: Props) {
  const reduce = useReducedMotion();
  const [step, setStep] = useState<Step>("email");
  /** True when the code boxes should play the "email box splits apart" entrance. */
  const [split, setSplit] = useState(false);
  const [email, setEmail] = useState("");
  /** Digits in the code that was sent. The server says: 4 for the app's own codes, 6 from Supabase. */
  const [codeLength, setCodeLength] = useState(CODE_LENGTH);
  const [digits, setDigits] = useState<string[]>(() => emptyDigits());
  const [name, setName] = useState("");
  const [signupToken, setSignupToken] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(notice);
  const [resendAt, setResendAt] = useState(0);
  const [pending, startTransition] = useTransition();
  const [, forceTick] = useState(0);

  // Count down to "Send again".
  useEffect(() => {
    if (step !== "code" || resendAt <= Date.now()) return;
    const timer = setInterval(() => forceTick((tick) => tick + 1), 1000);
    return () => clearInterval(timer);
  }, [step, resendAt]);

  function sendCode(event?: FormEvent) {
    event?.preventDefault();
    if (pending) return;
    startTransition(async () => {
      const result = await requestCode({ email, mode });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError(null);
      setEmail(result.email);
      setDevCode(result.devCode ?? null);
      setResendAt(Date.now() + result.resendInMs);
      setCodeLength(result.codeLength);
      setDigits(emptyDigits(result.codeLength));
      if (step === "code") return;
      // The email box splits into the code boxes.
      setSplit(!reduce);
      setStep("code");
    });
  }

  function submitCode(code: string) {
    if (pending || code.length !== codeLength) return;
    startTransition(async () => {
      const result = await verifyCode({ email, code, next: nextPath, mode });
      // A successful sign-in redirects, so only problems and new patients come back here.
      if (!result) return;
      if (!result.ok) {
        setError(result.error);
        setDigits(emptyDigits(codeLength));
        return;
      }
      setError(null);
      setSignupToken(result.signupToken);
      setStep("name");
    });
  }

  function submitName(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    startTransition(async () => {
      const result = await completeSignup({ email, name, signupToken, next: nextPath });
      if (!result) return;
      if (result.spent) {
        setSignupToken("");
        setStep("email");
      }
      setError(result.error);
    });
  }

  function changeEmail() {
    setError(null);
    setSplit(false);
    setStep("email");
  }

  const resendIn = Math.max(0, Math.ceil((resendAt - Date.now()) / 1000));
  const staff = mode === "staff";
  const googleHref = `/auth/google${nextPath === "/" ? "" : `?next=${encodeURIComponent(nextPath)}`}`;

  const footerLink = staff ? (
    <>
      Not a doctor?{" "}
      <a href={nextPath === "/" ? "/sign-in" : `/sign-in?next=${encodeURIComponent(nextPath)}`} className="font-medium text-accent">
        Patient sign-in
      </a>
    </>
  ) : (
    <>
      Doctor or reception?{" "}
      <a
        href={`/sign-in?as=staff${nextPath === "/" ? "" : `&next=${encodeURIComponent(nextPath)}`}`}
        className="font-medium text-accent"
      >
        Sign in as a doctor
      </a>
    </>
  );

  const field =
    step === "email" ? (
      <EmailField
        staff={staff}
        email={email}
        setEmail={setEmail}
        error={error}
        pending={pending}
        onSubmit={sendCode}
      />
    ) : (
      <CodeBoxes
        email={email}
        digits={digits}
        setDigits={setDigits}
        error={error}
        pending={pending}
        devCode={devCode}
        resendIn={resendIn}
        split={split}
        onComplete={submitCode}
        onResend={() => sendCode()}
        onChangeEmail={changeEmail}
      />
    );

  return (
    <div className="grid min-h-dvh place-items-center bg-surface px-5 py-12">
      <div className="grid w-full max-w-3xl items-center gap-10 md:grid-cols-2 md:gap-16">
        {/* Left: the practice */}
        <div className="text-center md:text-left">
          <a
            href="/"
            aria-label={`${practice.name} home`}
            className="inline-grid size-11 place-items-center rounded-xl bg-accent text-white"
          >
            <svg width="20" height="20" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
              <path d="M5 1h4v4h4v4H9v4H5V9H1V5h4z" />
            </svg>
          </a>
          <PageHeading className="mt-6 font-statement text-title1 font-bold tracking-[-0.02em] text-ink">
            Welcome to {practice.shortName}
          </PageHeading>
          <p className="mt-1 text-title3 font-normal text-muted">{staff ? "Clinic staff sign-in" : "Book your GP online"}</p>
          {staff ? null : <HeldTime nextPath={nextPath} doctors={doctors} />}
        </div>

        {/* Right: Google, or, email, stacked */}
        <div className="w-full">
          <AnimatePresence mode="wait" initial={false}>
            {step === "name" ? (
              <motion.div
                key="name"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
              >
                <NameStep name={name} setName={setName} error={error} pending={pending} onSubmit={submitName} />
              </motion.div>
            ) : (
              <motion.div key="auth" exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
                {/* Google only on the email step: once a code is on its way, it's just the code boxes. */}
                {staff || step !== "email" ? null : (
                  <>
                    <a
                      href={googleHref}
                      className="flex h-14 w-full items-center justify-center gap-3 rounded-full border border-control bg-surface px-6 text-body font-medium text-ink no-underline hover:bg-fill"
                    >
                      <GoogleMark />
                      Sign in with Google
                    </a>
                    <div className="my-4 flex items-center gap-3 text-caption text-muted" aria-hidden="true">
                      <span className="h-px flex-1 bg-hairline" />
                      OR
                      <span className="h-px flex-1 bg-hairline" />
                    </div>
                  </>
                )}
                {field}
              </motion.div>
            )}
          </AnimatePresence>
          <p className="mt-8 text-center text-callout text-ink-2">{footerLink}</p>
        </div>
      </div>
    </div>
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

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="size-5 rounded-full border-2 border-white border-r-transparent [animation:spin_700ms_linear_infinite]"
    />
  );
}

function EmailField({
  staff,
  email,
  setEmail,
  error,
  pending,
  onSubmit,
}: {
  staff: boolean;
  email: string;
  setEmail: (value: string) => void;
  error: string | null;
  pending: boolean;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} noValidate>
      <label htmlFor="email" className="sr-only">
        {staff ? "Practice email" : "Email"}
      </label>
      <div className="relative">
        <input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          spellCheck={false}
          autoFocus
          readOnly={pending}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={staff ? "Enter your practice email" : "Enter your email"}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? "email-error" : undefined}
          className="field h-14 rounded-full! pr-16 pl-5"
        />
        <button
          type="submit"
          aria-label="Continue with email"
          aria-busy={pending || undefined}
          className="absolute top-1.5 right-1.5 grid size-11 place-items-center rounded-full bg-accent text-white transition-[background-color,transform] hover:bg-accent-hover active:scale-90"
        >
          {pending ? (
            <Spinner />
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      </div>
      <ErrorText id="email-error" message={error} />
      {staff ? null : (
        <p className="mt-3 px-2 text-callout text-muted">
          New here? Enter your email and we’ll send you a sign-in code. That creates your account.
        </p>
      )}
    </form>
  );
}

/** Where each code box starts so the boxes together look like the email pill. */
function splitStart(index: number, length: number) {
  const pill = 28;
  const first = index === 0;
  const last = index === length - 1;
  // Close the gaps: each box widens a little and slides toward the middle.
  const middle = (length - 1) / 2;
  return {
    x: (middle - index) * 3,
    scaleX: 1.12,
    borderTopLeftRadius: first ? pill : 0,
    borderBottomLeftRadius: first ? pill : 0,
    borderTopRightRadius: last ? pill : 0,
    borderBottomRightRadius: last ? pill : 0,
  };
}

function CodeBoxes({
  email,
  digits,
  setDigits,
  error,
  pending,
  devCode,
  resendIn,
  split,
  onComplete,
  onResend,
  onChangeEmail,
}: {
  email: string;
  digits: string[];
  setDigits: (digits: string[]) => void;
  error: string | null;
  pending: boolean;
  devCode: string | null;
  resendIn: number;
  split: boolean;
  onComplete: (code: string) => void;
  onResend: () => void;
  onChangeEmail: () => void;
}) {
  const length = digits.length;
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  // The fading copy of the email is removed once it has faded.
  const [ghost, setGhost] = useState(split);

  // Start on the first box, and go back to it after a wrong code (the boxes are disabled while checking).
  useEffect(() => {
    if (!pending) refs.current[0]?.focus();
  }, [error, pending]);

  function place(index: number, typed: string) {
    const clean = typed.replace(/\D/g, "");
    const next = [...digits];
    if (!clean) {
      next[index] = "";
      setDigits(next);
      return;
    }
    // One digit, or several from a paste or the phone's code suggestion.
    let at = index;
    for (const char of clean) {
      if (at >= length) break;
      next[at] = char;
      at += 1;
    }
    setDigits(next);
    const code = next.join("");
    if (code.length === length) onComplete(code);
    else refs.current[Math.min(at, length - 1)]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>, index: number) {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      event.preventDefault();
      const next = [...digits];
      next[index - 1] = "";
      setDigits(next);
      refs.current[index - 1]?.focus();
    } else if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      refs.current[index - 1]?.focus();
    } else if (event.key === "ArrowRight" && index < length - 1) {
      event.preventDefault();
      refs.current[index + 1]?.focus();
    } else if (event.key === "Enter") {
      event.preventDefault();
      onComplete(digits.join(""));
    }
  }

  function onPaste(event: ClipboardEvent<HTMLInputElement>, index: number) {
    event.preventDefault();
    place(index, event.clipboardData.getData("text"));
  }

  return (
    <div>

      <div className="relative">
        {/* The email, still showing where it was typed, fades as the box splits apart. */}
        {ghost ? (
          <motion.div
            aria-hidden="true"
            onAnimationComplete={() => setGhost(false)}
            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-between overflow-hidden rounded-full pr-1.5 pl-5"
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.25, delay: 0.1 }}
          >
            <motion.span
              className="truncate text-body text-ink"
              initial={{ y: 0, filter: "blur(0px)" }}
              animate={{ y: -10, filter: "blur(4px)" }}
              transition={{ duration: 0.3 }}
            >
              {email}
            </motion.span>
            <motion.span
              className="grid size-11 shrink-0 place-items-center rounded-full bg-accent"
              initial={{ scale: 1 }}
              animate={{ scale: 0 }}
              transition={{ duration: 0.25 }}
            />
          </motion.div>
        ) : null}
        {/* Always one row, at any width and for any code length: the boxes share the width. */}
        <div role="group" aria-labelledby="code-label" className={`flex flex-nowrap ${length > 4 ? "gap-2" : "gap-3"}`}>
          {digits.map((digit, index) => (
            <motion.input
              key={index}
              ref={(node) => {
                refs.current[index] = node;
              }}
              aria-label={`Digit ${index + 1} of ${length}`}
              inputMode="numeric"
              autoComplete={index === 0 ? "one-time-code" : "off"}
              pattern="[0-9]*"
              value={digit}
              onChange={(event) => place(index, event.target.value)}
              onKeyDown={(event) => onKeyDown(event, index)}
              onPaste={(event) => onPaste(event, index)}
              onFocus={(event) => event.target.select()}
              disabled={pending}
              aria-invalid={Boolean(error) || undefined}
              aria-describedby={error ? "code-error" : undefined}
              initial={split ? splitStart(index, length) : false}
              animate={{
                x: 0,
                scaleX: 1,
                borderTopLeftRadius: 16,
                borderBottomLeftRadius: 16,
                borderTopRightRadius: 16,
                borderBottomRightRadius: 16,
              }}
              transition={{ type: "spring", duration: 0.55, bounce: 0.4, delay: split ? 0.18 + Math.abs(index - (length - 1) / 2) * 0.04 : 0 }}
              className="tabular h-14 w-0 min-w-0 flex-1 border border-control bg-surface text-center text-title2 font-semibold text-ink caret-accent transition-colors hover:border-ink-2 focus-visible:border-accent focus-visible:shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-accent)_22%,transparent)] focus-visible:outline-none disabled:opacity-60 aria-invalid:border-danger"
            />
          ))}
        </div>
      </div>
      <span id="code-label" className="sr-only">
        Enter the {length}-digit code from the email
      </span>

      <ErrorText id="code-error" message={error} />
      <p className="mt-3 px-2 text-callout text-ink-2">
        Code sent to <span className="font-semibold break-all text-ink">{email}</span>{" "}
        <button type="button" onClick={onChangeEmail} className="font-semibold text-accent hover:underline underline-offset-4">
          Change
        </button>
      </p>
      {devCode ? (
        <p className="mt-1 px-2 text-callout text-muted">
          Demo code: <span className="tabular font-semibold text-ink">{devCode}</span>
        </p>
      ) : null}

      <div className="mt-3 flex items-center justify-between gap-2 px-2 text-callout">
        <span className="text-muted" role="status">
          {pending ? "Checking…" : ""}
        </span>
        {resendIn > 0 ? (
          <span className="tabular text-muted">Send again in {resendIn}s</span>
        ) : (
          <button
            type="button"
            onClick={onResend}
            disabled={pending}
            className="min-h-11 text-accent hover:underline underline-offset-4"
          >
            Send a new code
          </button>
        )}
      </div>
    </div>
  );
}

function NameStep({
  name,
  setName,
  error,
  pending,
  onSubmit,
}: {
  name: string;
  setName: (value: string) => void;
  error: string | null;
  pending: boolean;
  onSubmit: (event: FormEvent) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);
  return (
    <>
      <h2 className="px-2 text-title3 font-semibold text-ink">One last thing</h2>
      <p className="mt-1 px-2 text-callout text-ink-2">What’s your name? We’ll use it on your bookings.</p>
      <form onSubmit={onSubmit} noValidate className="mt-4">
        <label htmlFor="name" className="sr-only">
          Full name
        </label>
        <input
          ref={inputRef}
          id="name"
          name="name"
          autoComplete="name"
          maxLength={100}
          placeholder="Full name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? "name-error" : undefined}
          className="field h-14 rounded-full! px-5"
        />
        <ErrorText id="name-error" message={error} />
        <button type="submit" aria-busy={pending || undefined} className={buttonClass("primary", "lg", "mt-3 w-full")}>
          {pending ? "Creating your account…" : "Continue"}
        </button>
      </form>
    </>
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
