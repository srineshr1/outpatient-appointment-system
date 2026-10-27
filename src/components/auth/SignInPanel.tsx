"use client";

import { useActionState } from "react";
import Link from "next/link";
import { DEMO_PASSWORD, demoAccounts } from "@/lib/demo-accounts";
import { signInAction, signInFromDemo, type AuthFormState } from "@/server/auth-actions";
import { Button } from "@/components/ui/Button";
import { buttonClass } from "@/components/ui/button-styles";
import { Card, Notice } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";

const initial: AuthFormState = { error: "", fields: {} };

export function SignInPanel({ nextPath }: { nextPath: string }) {
  const [state, action, pending] = useActionState(signInAction, initial);

  return (
    <div className="grid gap-6 lg:grid-cols-12 lg:gap-10">
      <Card className="grid gap-5 p-5 md:p-6 lg:col-span-7">
        <h2 className="text-title3 font-semibold text-ink">Your account</h2>
        {state.error ? (
          <Notice tone="danger" role="alert">
            {state.error}
          </Notice>
        ) : null}
        <form action={action} className="grid gap-5">
          <input type="hidden" name="next" value={nextPath} />
          <Field id="email" label="Email" error={state.fields.email}>
            {({ id, describedBy, invalid }) => (
              <input
                id={id}
                name="email"
                type="email"
                autoComplete="username"
                required
                aria-invalid={invalid}
                aria-describedby={describedBy}
                className="field"
              />
            )}
          </Field>
          <Field id="password" label="Password" error={state.fields.password}>
            {({ id, describedBy, invalid }) => (
              <input
                id={id}
                name="password"
                type="password"
                autoComplete="current-password"
                required
                aria-invalid={invalid}
                aria-describedby={describedBy}
                className="field"
              />
            )}
          </Field>
          <Button type="submit" size="lg" loading={pending} loadingLabel="Signing in">
            Sign in
          </Button>
        </form>
        <p className="text-callout text-ink-2">
          New here?{" "}
          <Link href={`/register?next=${encodeURIComponent(nextPath)}`} className="text-accent hover:underline underline-offset-4">
            Create a patient account
          </Link>
        </p>
      </Card>

      <div className="lg:col-span-5">
        <h2 className="text-title3 font-semibold text-ink">Sample clinic</h2>
        <p className="mt-2 text-callout text-ink-2">
          Password for every sample account: <span className="font-semibold text-ink">{DEMO_PASSWORD}</span>
        </p>
        <ul className="mt-4 grid gap-3">
          {demoAccounts.map((account) => (
            <li key={account.id}>
              <form action={signInFromDemo} className="rounded-card bg-surface p-4 shadow-card">
                <input type="hidden" name="email" value={account.email} />
                <input type="hidden" name="password" value={DEMO_PASSWORD} />
                <input type="hidden" name="next" value={nextPath} />
                <p className="text-body font-semibold text-ink">{account.name}</p>
                <p className="mt-1 text-callout text-muted">{account.blurb}</p>
                <p className="mt-1 text-caption text-muted">{account.email}</p>
                <button type="submit" className={buttonClass("secondary", "md", "mt-3")}>
                  Sign in as {account.name}
                </button>
              </form>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
