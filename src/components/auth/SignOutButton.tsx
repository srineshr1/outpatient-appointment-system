"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

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
    <button type="submit" disabled={pending} aria-busy={pending} className={`${className ?? ""} disabled:cursor-progress disabled:opacity-70`}>
      {icon}
      {pending ? pendingLabel : children}
    </button>
  );
}
