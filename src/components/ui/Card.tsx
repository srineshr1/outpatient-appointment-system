import type { ComponentProps } from "react";

export function Card({ className = "", ...props }: ComponentProps<"div">) {
  return (
    <div
      className={`rounded-card border border-hairline bg-surface bg-gradient-to-br from-white/[0.03] to-transparent [box-shadow:inset_0_1px_0_rgba(255,255,255,0.05),var(--shadow-card)] ${className}`.trim()}
      {...props}
    />
  );
}

type Tone = "info" | "danger" | "success" | "neutral";

const tones: Record<Tone, string> = {
  info: "border-cyan-400/25 bg-cyan-950/60 text-cyan-100",
  danger: "border-red-400/25 bg-red-950/60 text-red-100",
  success: "border-emerald-400/25 bg-emerald-950/60 text-emerald-100",
  neutral: "border-white/10 bg-surface-2 text-zinc-100",
};

export function Notice({ tone = "neutral", className = "", ...props }: ComponentProps<"div"> & { tone?: Tone }) {
  return <div className={`rounded-card border px-5 py-4 text-callout ${tones[tone]} ${className}`.trim()} {...props} />;
}
