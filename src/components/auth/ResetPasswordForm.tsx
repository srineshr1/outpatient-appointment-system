"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Alert } from "@/components/icons";
import { buttonClass } from "@/components/ui/button-styles";
import { Spinner } from "@/components/ui/Spinner";
import { resetPassword } from "@/server/auth-actions";

export function ResetPasswordForm({ email, token }: { email: string; token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (password.length < 8) return setError("Use at least 8 characters for your password.");
    if (password !== confirm) return setError("The two passwords don’t match.");
    startTransition(async () => {
      const result = await resetPassword({ email, token, password, confirm });
      if (result && !result.ok) setError(result.error);
    });
  }

  return (
    <form onSubmit={submit} noValidate className="mt-4">
      <p className="text-callout text-ink-2">
        For <span className="font-semibold break-all text-ink">{email}</span>. You’ll be signed out everywhere else.
      </p>
      <input type="email" name="username" value={email} autoComplete="username" readOnly hidden />
      <label htmlFor="password" className="mt-4 block text-callout font-medium text-ink">
        New password
      </label>
      <input
        id="password"
        type="password"
        autoComplete="new-password"
        maxLength={200}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        aria-describedby="password-hint"
        className="field mt-1 h-12 rounded-full! px-5"
        autoFocus
      />
      <p id="password-hint" className="mt-1 text-caption text-muted">
        At least 8 characters.
      </p>
      <label htmlFor="confirm" className="mt-3 block text-callout font-medium text-ink">
        Confirm new password
      </label>
      <input
        id="confirm"
        type="password"
        autoComplete="new-password"
        maxLength={200}
        value={confirm}
        onChange={(event) => setConfirm(event.target.value)}
        className="field mt-1 h-12 rounded-full! px-5"
      />
      {error ? (
        <p role="alert" className="mt-2 flex items-start gap-1.5 text-callout text-danger">
          <Alert size={18} className="mt-px shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}
      <button type="submit" disabled={pending} aria-busy={pending || undefined} className={buttonClass("primary", "lg", "mt-4 w-full")}>
        {pending ? <Spinner /> : null}
        {pending ? "Saving…" : "Save new password"}
      </button>
    </form>
  );
}
