export type ButtonVariant = "primary" | "secondary" | "plain" | "ghost";
export type ButtonSize = "md" | "lg";

const base =
  "relative inline-flex select-none items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap transition-all duration-150 disabled:cursor-not-allowed";

const variants: Record<ButtonVariant, string> = {
  primary:
    "no-underline bg-cyan-400 bg-gradient-to-r from-cyan-400 to-blue-500 text-zinc-950 font-semibold hover:from-cyan-300 hover:to-blue-400 active:opacity-90 shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:shadow-[0_0_30px_rgba(34,211,238,0.45)] disabled:bg-zinc-700 disabled:from-zinc-700 disabled:to-zinc-700 disabled:text-zinc-400 disabled:shadow-none",
  secondary:
    "no-underline border border-cyan-400/30 bg-cyan-400/10 text-cyan-300 hover:bg-cyan-400/15 hover:border-cyan-400/50 active:opacity-90 backdrop-blur-sm disabled:border-zinc-700 disabled:bg-zinc-800 disabled:text-zinc-400",
  plain: "text-cyan-300 hover:text-cyan-200 hover:underline underline-offset-4 disabled:text-zinc-500",
  ghost: "no-underline text-zinc-300 hover:bg-white/[0.06] hover:text-zinc-50 disabled:text-zinc-500",
};

const sizes: Record<ButtonSize, string> = {
  md: "min-h-11 px-5 text-callout",
  lg: "min-h-12 px-6 text-body",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", extra = ""): string {
  const sizing = variant === "plain" || variant === "ghost" ? "min-h-11 px-1 text-body" : sizes[size];
  return `${base} ${variants[variant]} ${sizing} ${extra}`.trim();
}
