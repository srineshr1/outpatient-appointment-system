"use client";

import Link from "next/link";
import type { MouseEventHandler } from "react";
import BorderGlow from "@/components/reactbits/BorderGlow";

type Props = {
  href: string;
  /** Play the edge sweep once when the button appears. */
  animated?: boolean;
  /** Stretch to the container, for the phone menu. */
  fullWidth?: boolean;
  className?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
};

/** Book an appointment, with the React Bits border glow following the pointer. */
export function BookAppointmentButton({ href, animated = false, fullWidth = false, className = "", onClick }: Props) {
  return (
    <BorderGlow
      className={["border-glow-card--button", fullWidth ? "border-glow-card--full" : "", className].filter(Boolean).join(" ")}
      edgeSensitivity={22}
      glowColor="199 92 68"
      backgroundColor="#0c4a6e"
      borderRadius={999}
      glowRadius={20}
      glowIntensity={1.15}
      coneSpread={28}
      animated={animated}
      colors={["#38bdf8", "#22d3ee", "#2dd4bf"]}
      fillOpacity={0.4}
    >
      <Link
        href={href}
        onClick={onClick}
        className={`inline-flex min-h-12 items-center justify-center px-6 text-callout font-semibold text-white no-underline ${fullWidth ? "w-full" : ""}`}
      >
        Book an appointment
      </Link>
    </BorderGlow>
  );
}
