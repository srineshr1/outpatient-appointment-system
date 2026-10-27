"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { startTransition, useActionState, useEffect, useState, type FormEvent } from "react";
import { useClock } from "@/components/providers/ClockProvider";
import { initialAuthState, type AuthField } from "@/lib/auth-routing";
import { spring } from "@/lib/motion";
import { registerAction } from "@/server/auth-actions";
import { AuthTextField, ChunkyButton, PasswordField, Shake } from "./AuthControls";
import { Mascot } from "./Mascot";

const ORDER: AuthField[] = ["name", "email", "password", "dob", "mobile"];

export function RegisterForm({ nextPath }: { nextPath: string }) {
  const [state, action, pending] = useActionState(registerAction, initialAuthState);
  const { window } = useClock();
  const [values, setValues] = useState({ name: "", email: "", password: "", dob: "", mobile: "" });

  // On a failed attempt, focus the first field that needs fixing. Everything typed stays put.
  useEffect(() => {
    if (state.attempt === 0) return;
    const first = ORDER.find((key) => state.fields[key]);
    document.getElementById(first ?? "name")?.focus();
  }, [state]);

  function set(key: keyof typeof values) {
    return (value: string) => setValues((current) => ({ ...current, [key]: value }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    startTransition(() => action(data));
  }

  const failed = state.attempt > 0;

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="flex justify-center">
        <Mascot mood={failed && !pending ? "oops" : "happy"} size={96} />
      </div>
      <p className="mt-4 text-center text-body text-ink-2">
        One account for booking, rebooking and cancelling. Takes about a minute.
      </p>

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
              <p role="alert" className="mt-6 rounded-2xl bg-danger-soft px-4 py-3 text-callout font-semibold text-danger">
                {state.error}
              </p>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <form action={action} onSubmit={submit} noValidate className="mt-6 grid gap-4">
          <input type="hidden" name="next" value={nextPath} />
          <AuthTextField
            id="name"
            label="Full name"
            value={values.name}
            onChange={set("name")}
            error={state.fields.name}
            input={{ name: "name", autoComplete: "name", maxLength: 100 }}
          />
          <AuthTextField
            id="email"
            label="Email"
            value={values.email}
            onChange={set("email")}
            error={state.fields.email}
            input={{ name: "email", type: "email", autoComplete: "email", inputMode: "email", spellCheck: false }}
          />
          <PasswordField
            value={values.password}
            onChange={set("password")}
            error={state.fields.password}
            hint="At least 8 characters."
            autoComplete="new-password"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <AuthTextField
              id="dob"
              label="Date of birth"
              value={values.dob}
              onChange={set("dob")}
              error={state.fields.dob}
              className="min-w-0"
              input={{ name: "dob", type: "date", autoComplete: "bday", min: "1900-01-01", max: window.today }}
            />
            <AuthTextField
              id="mobile"
              label="Mobile number"
              value={values.mobile}
              onChange={set("mobile")}
              error={state.fields.mobile}
              className="min-w-0"
              input={{ name: "mobile", type: "tel", autoComplete: "tel", inputMode: "tel", placeholder: "07700 900123" }}
            />
          </div>
          <ChunkyButton type="submit" loading={pending} loadingLabel="Creating your account…" className="mt-2">
            Create account
          </ChunkyButton>
        </form>
      </Shake>

      <p className="mt-6 text-center text-callout text-ink-2">
        Already have an account?{" "}
        <Link href={`/sign-in?next=${encodeURIComponent(nextPath)}`} className="font-bold text-accent">
          Sign in
        </Link>
      </p>
    </div>
  );
}
