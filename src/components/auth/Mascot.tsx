"use client";

import { motion, useReducedMotion } from "motion/react";

export type MascotMood = "happy" | "oops";

/**
 * Hal, the practice's calendar. Bobs gently, blinks, and looks worried when
 * sign-in fails. Decorative only.
 */
export function Mascot({ mood = "happy", size = 104 }: { mood?: MascotMood; size?: number }) {
  const reduce = useReducedMotion();

  return (
    <motion.svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      animate={reduce ? undefined : { y: [0, -6, 0] }}
      transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
      className="overflow-visible"
    >
      {/* Shadow on the floor */}
      <motion.ellipse
        cx="60"
        cy="114"
        rx="30"
        ry="4"
        fill="#000000"
        opacity="0.08"
        animate={reduce ? undefined : { rx: [30, 25, 30] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Body */}
      <rect x="18" y="20" width="84" height="86" rx="22" fill="#0066cc" />
      <rect x="18" y="20" width="84" height="28" rx="22" fill="#004c99" />
      <rect x="18" y="36" width="84" height="12" fill="#004c99" />
      {/* Rings */}
      <rect x="38" y="12" width="9" height="20" rx="4.5" fill="#d2d2d7" />
      <rect x="73" y="12" width="9" height="20" rx="4.5" fill="#d2d2d7" />
      {/* Face panel */}
      <rect x="28" y="52" width="64" height="44" rx="14" fill="#ffffff" />

      {/* Eyes blink */}
      <motion.g
        style={{ originY: "68px" }}
        animate={reduce ? undefined : { scaleY: [1, 1, 0.1, 1, 1] }}
        transition={{ duration: 4, repeat: Infinity, times: [0, 0.46, 0.5, 0.54, 1] }}
      >
        <circle cx="47" cy="68" r="4.5" fill="#1d1d1f" />
        <circle cx="73" cy="68" r="4.5" fill="#1d1d1f" />
        <circle cx="48.4" cy="66.6" r="1.4" fill="#ffffff" />
        <circle cx="74.4" cy="66.6" r="1.4" fill="#ffffff" />
      </motion.g>

      {mood === "oops" ? (
        <>
          <path d="M40 59l9 3M80 59l-9 3" stroke="#1d1d1f" strokeWidth="2.6" strokeLinecap="round" />
          <ellipse cx="60" cy="84" rx="5" ry="4" fill="#7c3b2f" />
        </>
      ) : (
        <>
          <circle cx="38" cy="78" r="4.5" fill="#f2725f" opacity="0.3" />
          <circle cx="82" cy="78" r="4.5" fill="#f2725f" opacity="0.3" />
          <path d="M50 80q10 9 20 0" fill="none" stroke="#7c3b2f" strokeWidth="3" strokeLinecap="round" />
        </>
      )}
    </motion.svg>
  );
}
