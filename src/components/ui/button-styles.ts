export type ButtonVariant = "primary" | "secondary" | "plain";
export type ButtonSize = "md" | "lg";

const base =
  "relative inline-flex select-none items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap transition-colors duration-150 disabled:cursor-not-allowed";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-white hover:bg-accent-hover active:bg-accent-press disabled:bg-fill-strong disabled:text-muted",
  secondary:
    "bg-accent-soft text-accent hover:bg-accent-soft-hover disabled:bg-fill disabled:text-muted",
  plain: "text-accent hover:underline underline-offset-4 disabled:text-muted",
};

const sizes: Record<ButtonSize, string> = {
  md: "min-h-11 px-5 text-callout",
  lg: "min-h-12 px-6 text-body",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", extra = ""): string {
  const sizing = variant === "plain" ? "min-h-11 px-1 text-body" : sizes[size];
  return `${base} ${variants[variant]} ${sizing} ${extra}`.trim();
}
