"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registerAction, type AuthFormState } from "@/server/auth-actions";
import { Button } from "@/components/ui/Button";
import { Card, Notice } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";

const initial: AuthFormState = { error: "", fields: {} };

export function RegisterForm({ nextPath }: { nextPath: string }) {
  const [state, action, pending] = useActionState(registerAction, initial);

  return (
    <Card className="grid gap-5 p-5 md:p-6">
      {state.error ? (
        <Notice tone="danger" role="alert">
          {state.error}
        </Notice>
      ) : null}
      <form action={action} className="grid gap-5 md:grid-cols-2">
        <input type="hidden" name="next" value={nextPath} />
        <Field id="name" label="Full name" error={state.fields.name} className="md:col-span-2">
          {({ id, describedBy, invalid }) => (
            <input
              id={id}
              name="name"
              autoComplete="name"
              required
              maxLength={100}
              aria-invalid={invalid}
              aria-describedby={describedBy}
              className="field"
            />
          )}
        </Field>
        <Field id="email" label="Email" error={state.fields.email} className="md:col-span-2">
          {({ id, describedBy, invalid }) => (
            <input
              id={id}
              name="email"
              type="email"
              autoComplete="email"
              required
              aria-invalid={invalid}
              aria-describedby={describedBy}
              className="field"
            />
          )}
        </Field>
        <Field id="password" label="Password" hint="At least 8 characters." error={state.fields.password} className="md:col-span-2">
          {({ id, describedBy, invalid }) => (
            <input
              id={id}
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              aria-invalid={invalid}
              aria-describedby={describedBy}
              className="field"
            />
          )}
        </Field>
        <Field id="dob" label="Date of birth" error={state.fields.dob}>
          {({ id, describedBy, invalid }) => (
            <input
              id={id}
              name="dob"
              type="date"
              autoComplete="bday"
              required
              aria-invalid={invalid}
              aria-describedby={describedBy}
              className="field tabular"
            />
          )}
        </Field>
        <Field id="mobile" label="Mobile number" error={state.fields.mobile}>
          {({ id, describedBy, invalid }) => (
            <input
              id={id}
              name="mobile"
              type="tel"
              autoComplete="tel"
              placeholder="07700 900123"
              required
              aria-invalid={invalid}
              aria-describedby={describedBy}
              className="field tabular"
            />
          )}
        </Field>
        <div className="md:col-span-2">
          <Button type="submit" size="lg" loading={pending} loadingLabel="Creating account">
            Create account
          </Button>
        </div>
      </form>
      <p className="text-callout text-ink-2">
        Already registered?{" "}
        <Link href={`/sign-in?next=${encodeURIComponent(nextPath)}`} className="text-accent hover:underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </Card>
  );
}
