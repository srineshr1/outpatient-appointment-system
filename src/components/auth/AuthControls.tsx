"use client";

import { useAnimate, useReducedMotion } from "motion/react";
import { useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { Field } from "@/components/ui/Field";

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="size-5 rounded-full border-[2.5px] border-current border-r-transparent [animation:spin_700ms_linear_infinite]"
    />
  );
}

type ChunkyProps = ComponentProps<"button"> & {
  tone?: "primary" | "secondary";
  loading?: boolean;
  loadingLabel?: string;
};

/** The big pressable button used on the sign-in and register screens. */
export function ChunkyButton({
  tone = "primary",
  loading = false,
  loadingLabel,
  className = "",
  children,
  type = "button",
  ...props
}: ChunkyProps) {
  return (
    <button
      type={type}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      className={`btn-chunky btn-chunky-${tone} ${className}`}
      {...props}
      onClick={loading ? (event) => event.preventDefault() : props.onClick}
    >
      {loading ? <Spinner /> : null}
      {loading && loadingLabel ? loadingLabel : children}
    </button>
  );
}

interface TextFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: ReactNode;
  className?: string;
  input?: Omit<ComponentProps<"input">, "id" | "value" | "onChange" | "className">;
}

export function AuthTextField({ id, label, value, onChange, error, hint, className, input }: TextFieldProps) {
  return (
    <Field id={id} label={label} error={error} hint={hint} className={className}>
      {({ id: fieldId, describedBy, invalid }) => (
        <input
          id={fieldId}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          className="auth-field"
          {...input}
        />
      )}
    </Field>
  );
}

export function PasswordField({
  id = "password",
  value,
  onChange,
  error,
  hint,
  autoComplete,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: ReactNode;
  autoComplete: "current-password" | "new-password";
}) {
  const [visible, setVisible] = useState(false);
  return (
    <Field id={id} label="Password" error={error} hint={hint}>
      {({ id: fieldId, describedBy, invalid }) => (
        <div className="relative">
          <input
            id={fieldId}
            name="password"
            type={visible ? "text" : "password"}
            autoComplete={autoComplete}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            aria-invalid={invalid}
            aria-describedby={describedBy}
            className="auth-field pr-20"
          />
          <button
            type="button"
            onClick={() => setVisible((shown) => !shown)}
            aria-label={visible ? "Hide password" : "Show password"}
            aria-controls={fieldId}
            className="absolute top-1/2 right-2 min-h-11 -translate-y-1/2 rounded-xl px-3 text-callout font-bold text-accent hover:bg-accent-soft"
          >
            {visible ? "Hide" : "Show"}
          </button>
        </div>
      )}
    </Field>
  );
}

/** Wraps a form so it gives a little head-shake each time `attempt` goes up. */
export function Shake({ attempt, children }: { attempt: number; children: ReactNode }) {
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const reduce = useReducedMotion();
  useEffect(() => {
    if (attempt === 0 || reduce) return;
    void animate(scope.current, { x: [0, -12, 12, -8, 8, -3, 0] }, { duration: 0.45, ease: "easeOut" });
  }, [attempt, animate, scope, reduce]);
  return <div ref={scope}>{children}</div>;
}

export function OrDivider() {
  return (
    <div className="flex items-center gap-3 text-caption font-bold tracking-wider text-muted uppercase" aria-hidden="true">
      <span className="h-0.5 flex-1 rounded-full bg-fill-strong" />
      or
      <span className="h-0.5 flex-1 rounded-full bg-fill-strong" />
    </div>
  );
}
