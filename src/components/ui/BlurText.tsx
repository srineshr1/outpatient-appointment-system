"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

type BlurTextTag = "span" | "p" | "h1" | "h2" | "h3" | "div";

interface BlurTextProps {
  children: ReactNode;
  className?: string;
  as?: BlurTextTag;
  delay?: number;
}

const MOTION_TAGS = {
  span: motion.span,
  p: motion.p,
  h1: motion.h1,
  h2: motion.h2,
  h3: motion.h3,
  div: motion.div,
} as const;

export function BlurText({ children, className = "", as: Tag = "span", delay = 0 }: BlurTextProps) {
  const reduceMotion = useReducedMotion();
  const MotionTag = MOTION_TAGS[Tag];
  const baseClass = Tag === "span" ? "inline-block" : "";

  return (
    <MotionTag
      initial={reduceMotion ? false : { opacity: 0, y: 10, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
      className={`${baseClass} ${className}`.trim()}
    >
      {children}
    </MotionTag>
  );
}
