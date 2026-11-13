import type { ComponentProps } from "react";

export function Card({ className = "", ...props }: ComponentProps<"div">) {
  return (
    <div
      className={`rounded-card border border-hairline bg-surface shadow-card ${className}`.trim()}
      {...props}
    />
  );
}

type Tone = "info" | "danger" | "success" | "neutral";

const tones: Record<Tone, string> = {
  info: "border-accent/25 bg-accent-soft text-ink",
  danger: "border-danger/25 bg-danger-soft text-ink",
  success: "border-success/25 bg-success-soft text-ink",
  neutral: "border-hairline bg-surface-2 text-ink",
};

export function Notice({ tone = "neutral", className = "", ...props }: ComponentProps<"div"> & { tone?: Tone }) {
  return <div className={`rounded-card border px-5 py-4 text-callout ${tones[tone]} ${className}`.trim()} {...props} />;
}
