export type ButtonVariant = "primary" | "secondary" | "plain" | "ghost";
export type ButtonSize = "md" | "lg";

const base =
  "relative inline-flex select-none items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap transition-colors duration-150 disabled:cursor-not-allowed";

const variants: Record<ButtonVariant, string> = {
  primary:
    "no-underline bg-ink text-canvas font-semibold hover:opacity-90 active:opacity-85 disabled:bg-fill-strong disabled:text-muted disabled:opacity-100",
  secondary:
    "no-underline border border-hairline bg-surface text-ink hover:bg-surface-2 hover:border-control/70 active:opacity-95 disabled:opacity-50",
  plain: "text-accent hover:text-accent-hover hover:underline underline-offset-4 disabled:text-muted",
  ghost: "no-underline text-ink-2 hover:bg-fill hover:text-ink disabled:text-muted",
};

const sizes: Record<ButtonSize, string> = {
  md: "min-h-11 px-5 text-callout",
  lg: "min-h-12 px-6 text-body",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", extra = ""): string {
  const sizing = variant === "plain" || variant === "ghost" ? "min-h-11 px-1 text-body" : sizes[size];
  return `${base} ${variants[variant]} ${sizing} ${extra}`.trim();
}
