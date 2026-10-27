"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  useCallback,
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
import { formatWhen } from "@/lib/format";
import { CODE_LENGTH } from "@/lib/sign-in-config";
import { completeSignup, registerWithPassword, requestCode, signInWithPassword, verifyCode, type SignInMode } from "@/server/auth-actions";

type Step = "email" | "code" | "password" | "name";

const emptyDigits = () => Array.from({ length: CODE_LENGTH }, () => "");

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
  const [filling, setFilling] = useState(false);
  const [fromFill, setFromFill] = useState(false);
  const [email, setEmail] = useState("");
  const [digits, setDigits] = useState<string[]>(emptyDigits);
  const [name, setName] = useState("");
  const [signupToken, setSignupToken] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
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

  const showCode = useCallback(() => {
    setFilling(false);
    setStep("code");
  }, []);

  function sendCode(event?: FormEvent) {
    event?.preventDefault();
    if (pending || filling) return;
    startTransition(async () => {
      const result = await requestCode({ email, mode });
      if (!result.ok) {
        if (result.needsPassword && result.email) {
          setEmail(result.email);
          setError(null);
          setCreating(false);
          setStep("password");
          return;
        }
        setError(result.error);
        return;
      }
      setError(null);
      setEmail(result.email);
      setDevCode(result.devCode ?? null);
      setResendAt(Date.now() + result.resendInMs);
      setDigits(emptyDigits());
      if (step === "code") return;
      // The circle floods the box, then the box splits into the code digits.
      setFromFill(!reduce);
      if (reduce) setStep("code");
      else setFilling(true);
    });
  }

  function submitCode(code: string) {
    if (pending || code.length !== CODE_LENGTH) return;
    startTransition(async () => {
      const result = await verifyCode({ email, code, next: nextPath, mode });
      // A successful sign-in redirects, so only problems and new patients come back here.
      if (!result) return;
      if (!result.ok) {
        setError(result.error);
        setDigits(emptyDigits());
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

  function submitPassword(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    startTransition(async () => {
      const result = creating
        ? await registerWithPassword({ email, password, name, next: nextPath })
        : await signInWithPassword({ email, password, next: nextPath, mode });
      if (!result) return;
      if (result.needsAccount) setCreating(true);
      setError(result.error);
    });
  }

  function changeEmail() {
    setError(null);
    setFromFill(false);
    setStep("email");
  }

  const resendIn = Math.max(0, Math.ceil((resendAt - Date.now()) / 1000));
  const staff = mode === "staff";
  const googleHref = `/auth/google${nextPath === "/" ? "" : `?next=${encodeURIComponent(nextPath)}`}`;

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-8 px-5 md:px-8 lg:min-h-[28rem] lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-center lg:gap-12">
      {/* Left: the message */}
      <div>
        <PageHeading className="font-statement text-[2.75rem] leading-[1.08] font-bold tracking-[-0.025em] text-ink md:text-[4rem]">
          {staff ? "Your clinic book is " : "Your next appointment is "}
          <span className="text-accent">waiting.</span>
        </PageHeading>
        {staff ? null : <HeldTime nextPath={nextPath} doctors={doctors} />}
      </div>

      {/* Right: the form */}
      <div className="rounded-sheet bg-surface p-5 shadow-card md:p-6">
        <AnimatePresence mode="wait" initial={false}>
          {step === "password" ? (
            <motion.div
              key="password"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
            >
              <form onSubmit={submitPassword} className="grid gap-4">
                <p className="px-2 text-callout text-ink-2">
                  {creating ? "Create an account for " : "Password for "}
                  <span className="font-semibold break-all text-ink">{email}</span>{" "}
                  <button type="button" onClick={changeEmail} className="font-semibold text-accent hover:underline underline-offset-4">
                    Change
                  </button>
                </p>
                {creating ? (
                  <div>
                    <label htmlFor="account-name" className="sr-only">
                      Full name
                    </label>
                    <input
                      id="account-name"
                      name="name"
                      autoComplete="name"
                      autoFocus
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Full name"
                      className="field h-14 rounded-full! px-5"
                    />
                  </div>
                ) : null}
                <div>
                  <label htmlFor="password" className="sr-only">
                    Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete={creating ? "new-password" : "current-password"}
                    autoFocus={!creating}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Password"
                    aria-invalid={Boolean(error) || undefined}
                    aria-describedby={error ? "password-error" : undefined}
                    className="field h-14 rounded-full! px-5"
                  />
                  <ErrorText id="password-error" message={error} />
                </div>
                <button type="submit" disabled={pending} className="btn-chunky btn-chunky-primary w-full">
                  {pending ? "Please wait" : creating ? "Create account" : "Sign in"}
                </button>
                {staff || creating ? null : (
                  <button
                    type="button"
                    onClick={() => {
                      setCreating(true);
                      setError(null);
                    }}
                    className="text-callout font-semibold text-accent"
                  >
                    New here? Create an account
                  </button>
                )}
              </form>
            </motion.div>
          ) : step === "name" ? (
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
              {step === "email" ? (
                <EmailField
                  staff={staff}
                  email={email}
                  setEmail={setEmail}
                  error={error}
                  pending={pending}
                  filling={filling}
                  onSubmit={sendCode}
                  onFilled={showCode}
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
                  fromFill={fromFill}
                  onComplete={submitCode}
                  onResend={() => sendCode()}
                  onChangeEmail={changeEmail}
                />
              )}

              {staff || step !== "email" ? null : (
                <>
                  <div className="my-4 flex items-center gap-3 text-caption text-muted" aria-hidden="true">
                    <span className="h-px flex-1 bg-hairline" />
                    or
                    <span className="h-px flex-1 bg-hairline" />
                  </div>
                  <a
                    href={googleHref}
                    className="flex min-h-12 w-full items-center justify-center gap-3 rounded-full border border-control bg-surface px-6 text-body font-medium text-ink no-underline hover:bg-fill"
                  >
                    <GoogleMark />
                    Sign in with Google
                  </a>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <p className="mt-5 text-center text-callout text-ink-2">
          {staff ? (
            <>
              Not a doctor?{" "}
              <a href={nextPath === "/" ? "/sign-in" : `/sign-in?next=${encodeURIComponent(nextPath)}`} className="font-semibold text-accent">
                Patient sign-in
              </a>
            </>
          ) : (
            <>
              Doctor or reception?{" "}
              <a href={`/sign-in?as=staff${nextPath === "/" ? "" : `&next=${encodeURIComponent(nextPath)}`}`} className="font-semibold text-accent">
                Sign in as a doctor
              </a>
            </>
          )}
        </p>
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
  filling,
  onSubmit,
  onFilled,
}: {
  staff: boolean;
  email: string;
  setEmail: (value: string) => void;
  error: string | null;
  pending: boolean;
  filling: boolean;
  onSubmit: (event: FormEvent) => void;
  onFilled: () => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const done = useRef(false);
  const [fullWidth, setFullWidth] = useState(44);

  useEffect(() => {
    if (!filling) return;
    done.current = false;
    setFullWidth(Math.max(44, (boxRef.current?.offsetWidth ?? 0) - 12));
    // Safety net: move on even if the animation can't report finishing.
    const timer = setTimeout(() => {
      if (!done.current) {
        done.current = true;
        onFilled();
      }
    }, 900);
    return () => clearTimeout(timer);
  }, [filling, onFilled]);

  function finished() {
    if (done.current) return;
    done.current = true;
    onFilled();
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <label htmlFor="email" className="sr-only">
        {staff ? "Practice email" : "Email"}
      </label>
      <div ref={boxRef} className="relative">
        <input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          spellCheck={false}
          autoFocus
          readOnly={filling}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={staff ? "name@halden.example" : "Your email"}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? "email-error" : undefined}
          className="field h-14 rounded-full! pr-16 pl-5"
        />
        {/* The liquid: grows from the circle to fill the box, sloshing a little at the end. */}
        {filling ? (
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
            <motion.div
              className="absolute top-1.5 right-1.5 bottom-1.5 rounded-full bg-accent"
              initial={{ width: 44, scaleY: 1 }}
              animate={{ width: fullWidth, scaleY: [1, 0.86, 1.04, 1] }}
              transition={{
                width: { type: "spring", duration: 0.6, bounce: 0.35 },
                scaleY: { duration: 0.6, times: [0, 0.35, 0.7, 1] },
              }}
              onAnimationComplete={finished}
            />
          </div>
        ) : null}
        <button
          type="submit"
          aria-label="Continue with email"
          aria-busy={pending || undefined}
          className="absolute top-1.5 right-1.5 grid size-11 place-items-center rounded-full bg-accent text-white transition-[background-color,transform] hover:bg-accent-hover active:scale-90"
        >
          {pending || filling ? (
            <Spinner />
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      </div>
      <ErrorText id="email-error" message={error} />
    </form>
  );
}

function CodeBoxes({
  email,
  digits,
  setDigits,
  error,
  pending,
  devCode,
  resendIn,
  fromFill,
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
  fromFill: boolean;
  onComplete: (code: string) => void;
  onResend: () => void;
  onChangeEmail: () => void;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

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
      if (at >= CODE_LENGTH) break;
      next[at] = char;
      at += 1;
    }
    setDigits(next);
    const code = next.join("");
    if (code.length === CODE_LENGTH) onComplete(code);
    else refs.current[Math.min(at, CODE_LENGTH - 1)]?.focus();
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
    } else if (event.key === "ArrowRight" && index < CODE_LENGTH - 1) {
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
      <p className="px-2 text-callout text-ink-2">
        Code sent to <span className="font-semibold break-all text-ink">{email}</span>{" "}
        <button type="button" onClick={onChangeEmail} className="font-semibold text-accent hover:underline underline-offset-4">
          Change
        </button>
      </p>

      <div className="relative mt-3">
        {/* The blue box from the email step, dissolving into the digits. */}
        {fromFill ? (
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-full bg-accent"
            initial={{ opacity: 1, scaleX: 1 }}
            animate={{ opacity: 0, scaleX: 0.96 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          />
        ) : null}
        <div role="group" aria-labelledby="code-label" className="grid grid-cols-4 gap-3">
          {digits.map((digit, index) => (
            <motion.input
              key={index}
              ref={(node) => {
                refs.current[index] = node;
              }}
              aria-label={`Digit ${index + 1} of ${CODE_LENGTH}`}
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
              initial={fromFill ? { scale: 0.5, opacity: 0, borderRadius: 999 } : false}
              animate={{ scale: 1, opacity: 1, borderRadius: 16 }}
              transition={{ type: "spring", duration: 0.5, bounce: 0.45, delay: fromFill ? 0.08 + index * 0.06 : 0 }}
              className="tabular h-14 w-full min-w-0 border border-control bg-surface text-center text-title2 font-semibold text-ink caret-accent transition-colors hover:border-ink-2 focus-visible:border-accent focus-visible:shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-accent)_22%,transparent)] focus-visible:outline-none disabled:opacity-60 aria-invalid:border-danger"
            />
          ))}
        </div>
      </div>
      <span id="code-label" className="sr-only">
        Enter the {CODE_LENGTH}-digit code from the email
      </span>

      <ErrorText id="code-error" message={error} />
      {devCode ? (
        <p className="mt-3 px-2 text-callout text-muted">
          Demo mode, no email is sent. Your code is <span className="tabular font-semibold text-ink">{devCode}</span>
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
      <h2 className="px-2 text-title3 font-semibold text-ink">Welcome to Halden Street</h2>
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
    <div className="mt-8 inline-flex items-center gap-3 rounded-card bg-surface p-3 pr-5 shadow-card">
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
