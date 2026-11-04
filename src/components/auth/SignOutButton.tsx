"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Spinner } from "@/components/ui/Spinner";

/**
 * The submit button inside a sign-out form. While the server signs the person out it says so
 * and can't be pressed again, so a slow network never looks like a dead button.
 */
export function SignOutButton({
  className,
  children,
  pendingLabel = "Signing out…",
  icon,
}: {
  className?: string;
  children: ReactNode;
  pendingLabel?: string;
  icon?: ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <>
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className={`${className ?? ""} disabled:cursor-progress disabled:opacity-70`}
      >
        {pending ? <Spinner className="mr-2 size-4" /> : icon}
        {pending ? pendingLabel : children}
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {pending ? pendingLabel : ""}
      </span>
    </>
  );
}
