"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { Alert } from "@/components/icons";

export interface FieldRenderProps {
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
}

interface FieldProps {
  id: string;
  label: ReactNode;
  optional?: boolean;
  hint?: ReactNode;
  error?: string;
  className?: string;
  children: (props: FieldRenderProps) => ReactNode;
}

/**
 * A labelled form control. The error replaces the hint immediately (only its entrance
 * is animated), so aria-describedby never points at a missing element.
 */
export function Field({ id, label, optional, hint, error, className = "", children }: FieldProps) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = error ? errorId : hint ? hintId : undefined;

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-2 block text-callout font-semibold text-ink">
        {label}
        {optional ? <span className="font-normal text-muted"> (optional)</span> : null}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {error ? (
        <motion.p
          key="error"
          id={errorId}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="mt-2 flex items-start gap-1.5 text-callout text-danger"
        >
          <Alert size={18} className="mt-px shrink-0" />
          <span>{error}</span>
        </motion.p>
      ) : hint ? (
        <p id={hintId} className="mt-2 text-callout text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
