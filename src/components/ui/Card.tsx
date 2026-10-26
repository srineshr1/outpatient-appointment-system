import type { ComponentProps } from "react";

export function Card({ className = "", ...props }: ComponentProps<"div">) {
  return <div className={`rounded-card bg-surface shadow-card ${className}`} {...props} />;
}

type Tone = "info" | "danger" | "success" | "neutral";

const tones: Record<Tone, string> = {
  info: "bg-accent-soft text-ink",
  danger: "bg-danger-soft text-ink",
  success: "bg-success-soft text-ink",
  neutral: "bg-fill text-ink",
};

export function Notice({ tone = "neutral", className = "", ...props }: ComponentProps<"div"> & { tone?: Tone }) {
  return <div className={`rounded-card px-5 py-4 text-callout ${tones[tone]} ${className}`} {...props} />;
}
