"use client";

import { createContext, startTransition, useActionState, useContext, type FormEvent, type ReactNode } from "react";
import { AlertIcon } from "@/components/admin/icons";
import { adminButton, type AdminButtonVariant } from "@/components/admin/ui";
import { Spinner } from "@/components/ui/Spinner";
import type { ActionResult } from "@/lib/action-result";

type Action = (previous: ActionResult, formData: FormData) => Promise<ActionResult>;

const Pending = createContext(false);

/**
 * A form for an admin action. Success redirects (the page shows what changed); a problem comes
 * back as a message under the form. Submitting through onSubmit keeps what was typed when the
 * action refuses: a plain form action would clear the fields.
 */
export function ActionForm({
  action,
  children,
  className = "",
  errorId,
}: {
  action: Action;
  children: ReactNode;
  className?: string;
  /** Lets a field point at the error with aria-describedby. */
  errorId?: string;
}) {
  const [state, dispatch, pending] = useActionState(action, null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    startTransition(() => dispatch(data));
  }

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={pending || undefined} className={className}>
      <Pending.Provider value={pending}>{children}</Pending.Provider>
      {state && !state.ok ? (
        <p id={errorId} role="alert" className="mt-3 flex items-start gap-1.5 text-sm text-[#a51c22]">
          <AlertIcon size={16} className="mt-0.5 shrink-0" />
          <span>{state.message}</span>
        </p>
      ) : null}
    </form>
  );
}

export function SubmitButton({
  children,
  pendingLabel = "Saving…",
  variant = "primary",
  className = "",
}: {
  children: ReactNode;
  pendingLabel?: string;
  variant?: AdminButtonVariant;
  className?: string;
}) {
  const pending = useContext(Pending);
  // aria-disabled rather than disabled, so focus stays on the button while it works.
  return (
    <>
      <button type="submit" aria-disabled={pending || undefined} aria-busy={pending || undefined} className={adminButton(variant, className)}>
        {pending ? <Spinner className="size-3.5" /> : null}
        {pending ? pendingLabel : children}
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {pending ? pendingLabel : ""}
      </span>
    </>
  );
}
