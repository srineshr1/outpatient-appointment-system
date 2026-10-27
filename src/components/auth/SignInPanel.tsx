"use client";

import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import Link from "next/link";
import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { DoctorPortrait } from "@/components/doctors/DoctorPortrait";
import { useBooking } from "@/components/providers/BookingProvider";
import { useClock } from "@/components/providers/ClockProvider";
import { initialAuthState } from "@/lib/auth-routing";
import type { Doctor } from "@/lib/data";
import { DEMO_PASSWORD, demoAccounts } from "@/lib/demo-accounts";
import { formatWhen } from "@/lib/format";
import { spring } from "@/lib/motion";
import { signInAction, signInFromDemo } from "@/server/auth-actions";
import { AuthTextField, ChunkyButton, OrDivider, PasswordField, Shake } from "./AuthControls";
import { Mascot } from "./Mascot";

export type SignInRole = "patient" | "staff";

const TABS: { value: SignInRole; label: string }[] = [
  { value: "patient", label: "I’m a patient" },
  { value: "staff", label: "I work here" },
];

const COPY: Record<SignInRole, { title: string; lead: string }> = {
  patient: { title: "Welcome back", lead: "Sign in to book a visit and see your appointments." },
  staff: { title: "Clinic staff", lead: "Doctors open their clinic book. Reception sees every doctor." },
};

interface Props {
  nextPath: string;
  initialRole: SignInRole;
  doctors: Doctor[];
}

export function SignInPanel({ nextPath, initialRole, doctors }: Props) {
  const [state, action, pending] = useActionState(signInAction, initialAuthState);
  const [role, setRole] = useState<SignInRole>(initialRole);
  const [direction, setDirection] = useState(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // After a failed attempt the email stays and the cursor goes back where it's needed.
  useEffect(() => {
    if (state.attempt === 0) return;
    document.getElementById(state.fields.email ? "email" : "password")?.focus();
  }, [state]);

  function choose(next: SignInRole) {
    if (next === role) return;
    setDirection(next === "staff" ? 1 : -1);
    setRole(next);
  }

  function onTabKey(event: KeyboardEvent, index: number) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? TABS.length - 1 : (index + 1) % TABS.length;
    choose(TABS[nextIndex]!.value);
    tabRefs.current[nextIndex]?.focus();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    // The password is sent, then cleared, so a failed attempt starts the password afresh.
    setPassword("");
    startTransition(() => action(data));
  }

  const failed = state.attempt > 0;
  const copy = COPY[role];

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="flex flex-col items-center text-center">
        <AnimatePresence mode="wait" initial={false}>
          {role === "patient" ? (
            <motion.div
              key="mascot"
              initial={{ scale: 0.6, opacity: 0, rotate: -8 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.6, opacity: 0, rotate: 8 }}
              transition={spring.press}
            >
              <Mascot mood={failed && !pending ? "oops" : "happy"} />
            </motion.div>
          ) : (
            <motion.div key="team" className="flex h-[104px] items-center" initial="hidden" animate="shown" exit="hidden">
              {doctors.slice(0, 4).map((doctor, index) => (
                <motion.span
                  key={doctor.id}
                  variants={{
                    hidden: { opacity: 0, y: 16, scale: 0.7 },
                    shown: { opacity: 1, y: 0, scale: 1, transition: { ...spring.press, delay: index * 0.06 } },
                  }}
                  className={`rounded-full ring-4 ring-surface ${index === 0 ? "" : "-ml-4"}`}
                >
                  <DoctorPortrait doctor={doctor} size={68} />
                </motion.span>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <BookingContext nextPath={nextPath} doctors={doctors} />

      <LayoutGroup id="role-tabs">
        <div
          role="tablist"
          aria-label="Who’s signing in"
          className="mt-6 grid grid-cols-2 gap-1 rounded-2xl bg-fill-strong p-1"
        >
          {TABS.map((tab, index) => {
            const selected = tab.value === role;
            return (
              <button
                key={tab.value}
                ref={(node) => {
                  tabRefs.current[index] = node;
                }}
                id={`tab-${tab.value}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls="sign-in-panel"
                tabIndex={selected ? 0 : -1}
                onClick={() => choose(tab.value)}
                onKeyDown={(event) => onTabKey(event, index)}
                className={`relative isolate min-h-12 rounded-xl text-callout font-bold transition-colors ${
                  selected ? "text-ink" : "text-ink-2 hover:text-ink"
                }`}
              >
                {selected ? (
                  <motion.span
                    layoutId="role-pill"
                    transition={spring.snap}
                    aria-hidden="true"
                    className="absolute inset-0 -z-10 rounded-xl bg-surface shadow-card"
                  />
                ) : null}
                {tab.label}
              </button>
            );
          })}
        </div>
      </LayoutGroup>

      <div
        id="sign-in-panel"
        role="tabpanel"
        aria-labelledby={`tab-${role}`}
        className="relative mt-6 overflow-hidden"
      >
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={role}
            custom={direction}
            variants={{
              enter: (dir: number) => ({ x: dir * 40, opacity: 0 }),
              center: { x: 0, opacity: 1 },
              exit: (dir: number) => ({ x: dir * -40, opacity: 0 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={spring.gentle}
          >
            <h2 className="text-center text-title2 font-bold text-ink">{copy.title}</h2>
            <p className="mt-2 text-center text-body text-ink-2">{copy.lead}</p>

            <Shake attempt={state.attempt}>
              <AnimatePresence initial={false}>
                {state.error ? (
                  <motion.div
                    key={`error-${state.attempt}`}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={spring.gentle}
                    className="overflow-hidden"
                  >
                    <p role="alert" className="mt-5 rounded-2xl bg-danger-soft px-4 py-3 text-callout font-semibold text-danger">
                      {state.error}
                    </p>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <form action={action} onSubmit={submit} noValidate className="mt-5 grid gap-4">
                <input type="hidden" name="next" value={nextPath} />
                <AuthTextField
                  id="email"
                  label={role === "staff" ? "Work email" : "Email"}
                  value={email}
                  onChange={setEmail}
                  error={state.fields.email}
                  input={{
                    name: "email",
                    type: "email",
                    autoComplete: "username",
                    inputMode: "email",
                    spellCheck: false,
                    placeholder: role === "staff" ? "name@halden.example" : "you@example.com",
                  }}
                />
                <PasswordField
                  value={password}
                  onChange={setPassword}
                  error={state.fields.password}
                  autoComplete="current-password"
                />
                <ChunkyButton type="submit" loading={pending} loadingLabel="Signing in…" className="mt-2">
                  Sign in
                </ChunkyButton>
              </form>
            </Shake>

            <div className="mt-6 grid gap-4">
              <OrDivider />
              {role === "patient" ? (
                <PatientExtras nextPath={nextPath} />
              ) : (
                <StaffAccounts nextPath={nextPath} doctors={doctors} />
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/** "You're signing in to book Dr Cho, Thu 29 Oct, 10:00": so the patient knows their time is safe. */
function BookingContext({ nextPath, doctors }: { nextPath: string; doctors: Doctor[] }) {
  const { state, ready } = useBooking();
  const { window } = useClock();
  const held = state.held;
  const doctor = held ? doctors.find((item) => item.id === held.doctorId) : null;
  if (!ready || nextPath !== "/book/details" || !held || !doctor) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring.gentle, delay: 0.1 }}
      className="mt-6 flex items-center gap-3 rounded-2xl border-2 border-accent/25 bg-accent-soft p-3 text-left"
    >
      <DoctorPortrait doctor={doctor} size={44} />
      <p className="text-callout text-ink">
        <span className="block font-bold">We’re holding your time</span>
        <span className="tabular text-ink-2">
          {doctor.short}, {formatWhen(held, window.today)}. Sign in to finish booking.
        </span>
      </p>
    </motion.div>
  );
}

function PatientExtras({ nextPath }: { nextPath: string }) {
  const sample = demoAccounts.find((account) => account.role === "patient");
  return (
    <>
      <Link href={`/register?next=${encodeURIComponent(nextPath)}`} className="btn-chunky btn-chunky-secondary">
        Create a patient account
      </Link>
      {sample ? (
        <form action={signInFromDemo} className="text-center">
          <input type="hidden" name="email" value={sample.email} />
          <input type="hidden" name="password" value={DEMO_PASSWORD} />
          <input type="hidden" name="next" value={nextPath} />
          <p className="text-callout text-muted">Just looking around?</p>
          <button
            type="submit"
            className="mt-1 min-h-11 rounded-xl px-3 text-callout font-bold text-accent hover:bg-accent-soft"
          >
            Sign in as the sample patient, {sample.name}
          </button>
        </form>
      ) : null}
    </>
  );
}

function StaffAccounts({ nextPath, doctors }: { nextPath: string; doctors: Doctor[] }) {
  const staff = demoAccounts.filter((account) => account.role !== "patient");
  return (
    <section aria-labelledby="sample-staff">
      <h3 id="sample-staff" className="text-center text-callout font-bold text-ink">
        Sample staff accounts
      </h3>
      <p className="mt-1 text-center text-caption text-muted">
        Tap one to sign in. The password for each is <span className="font-semibold text-ink-2">{DEMO_PASSWORD}</span>
      </p>
      <ul className="mt-4 grid grid-cols-2 gap-3">
        {staff.map((account, index) => {
          const doctor = account.doctorId ? doctors.find((item) => item.id === account.doctorId) : null;
          return (
            <motion.li
              key={account.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring.gentle, delay: 0.05 * index }}
            >
              <form action={signInFromDemo} className="h-full">
                <input type="hidden" name="email" value={account.email} />
                <input type="hidden" name="password" value={DEMO_PASSWORD} />
                <input type="hidden" name="next" value={nextPath} />
                <button
                  type="submit"
                  aria-label={`Sign in as ${account.name}`}
                  className="btn-chunky btn-chunky-secondary h-full flex-col gap-1.5 py-3 text-ink"
                >
                  {doctor ? (
                    <DoctorPortrait doctor={doctor} size={44} />
                  ) : (
                    <span aria-hidden="true" className="grid size-11 place-items-center rounded-full bg-ink text-white">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 20v-1a5 5 0 0 1 5-5h6a5 5 0 0 1 5 5v1M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
                      </svg>
                    </span>
                  )}
                  <span className="text-callout leading-tight font-bold">{account.name}</span>
                  <span className="text-caption font-medium text-muted">{doctor ? doctor.interest : "Reception"}</span>
                </button>
              </form>
            </motion.li>
          );
        })}
      </ul>
    </section>
  );
}
