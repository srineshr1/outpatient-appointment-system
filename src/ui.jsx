export function Button({ variant = "primary", className = "", type = "button", children, ...props }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-sm px-4 py-3 text-ui transition-colors disabled:cursor-not-allowed";
  const styles = {
    primary:
      "bg-accent text-accent-ink hover:bg-ink active:bg-ink disabled:bg-well disabled:text-muted disabled:hover:bg-well",
    quiet:
      "border border-line bg-paper text-ink hover:bg-well active:bg-line disabled:text-muted disabled:hover:bg-paper",
  };

  return (
    <button type={type} className={`${base} ${styles[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Field({ id, label, hint, error, children }) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [error ? errorId : hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div>
      <label htmlFor={id} className="block text-label text-muted uppercase">
        {label}
      </label>
      <div className="mt-2">{children({ describedBy, invalid: Boolean(error) })}</div>
      {error ? (
        <p id={errorId} className="mt-2 text-ui text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-2 max-w-prose text-ui text-ink-soft">
          {hint}
        </p>
      ) : null}
    </div>
  );
}


