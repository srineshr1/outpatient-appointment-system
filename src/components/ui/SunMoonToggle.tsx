"use client";

import { motion } from "motion/react";
import { useId } from "react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { cn } from "@/lib/utils";

/**
 * Sun-to-moon toggle (the second Skiper / toggles.dev mark).
 * Drives the site theme, not a local preview state.
 */
export function SunMoonToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const clipId = `sun-moon-${useId().replace(/:/g, "")}`;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-full p-2 transition-colors duration-300 active:scale-95",
        isDark
          ? "bg-black text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)]"
          : "bg-white text-black shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)]",
        className,
      )}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        fill="currentColor"
        strokeLinecap="round"
        viewBox="0 0 32 32"
        className="size-full"
      >
        <clipPath id={clipId}>
          <motion.path
            initial={false}
            animate={{ y: isDark ? 10 : 0, x: isDark ? -12 : 0 }}
            transition={{ ease: "easeInOut", duration: 0.35 }}
            d="M0-5h30a1 1 0 0 0 9 13v24H0Z"
          />
        </clipPath>
        <g clipPath={`url(#${clipId})`}>
          <motion.circle
            initial={false}
            animate={{ r: isDark ? 10 : 8 }}
            transition={{ ease: "easeInOut", duration: 0.35 }}
            cx="16"
            cy="16"
          />
          <motion.g
            initial={false}
            animate={{
              rotate: isDark ? -100 : 0,
              scale: isDark ? 0.5 : 1,
              opacity: isDark ? 0 : 1,
            }}
            transition={{ ease: "easeInOut", duration: 0.35 }}
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M16 5.5v-4" />
            <path d="M16 30.5v-4" />
            <path d="M1.5 16h4" />
            <path d="M26.5 16h4" />
            <path d="m23.4 8.6 2.8-2.8" />
            <path d="m5.7 26.3 2.9-2.9" />
            <path d="m5.8 5.8 2.8 2.8" />
            <path d="m23.4 23.4 2.9 2.9" />
          </motion.g>
        </g>
      </svg>
    </button>
  );
}
