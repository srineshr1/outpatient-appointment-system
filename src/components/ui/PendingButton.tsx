"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { Spinner } from "@/components/ui/Spinner";

/**
 * The submit button for a form that runs a server action. While the action works it says so, shows
 * a spinner and can't be pressed again, so a slow network never looks like a dead button or books
 * twice. Put it inside the <form>; it reads the form's status itself.
 */
export function PendingButton({
  children,
  pendingLabel,
  className = "",
  disabled,
  ...props
}: Omit<ComponentProps<"button">, "type"> & { pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <>
      <button
        {...props}
        type="submit"
        disabled={pending || disabled}
        aria-busy={pending || undefined}
        className={`${className} disabled:cursor-progress ${pending ? "disabled:opacity-80" : ""}`.trim()}
      >
        {pending ? <Spinner /> : null}
        {pending ? pendingLabel : children}
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {pending ? pendingLabel : ""}
      </span>
    </>
  );
}
