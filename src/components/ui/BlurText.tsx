"use client";

import type { ReactNode } from "react";
import { BlurText as ReactBitsBlurText } from "@/components/reactbits/BlurText";

type BlurTextTag = "span" | "p" | "h1" | "h2" | "h3" | "div";

interface BlurTextProps {
  children: ReactNode;
  className?: string;
  as?: BlurTextTag;
  delay?: number;
}

export function BlurText({ children, className = "", as: Tag = "span", delay = 0 }: BlurTextProps) {
  if (typeof children === "string") {
    return (
      <ReactBitsBlurText
        as={Tag}
        text={children}
        delay={Math.max(20, Math.round(delay * 1000) || 30)}
        stepDuration={0.22}
        blur={4}
        distance={12}
        trigger="load"
        className={`${Tag === "span" ? "inline-flex" : ""} ${className}`.trim()}
      />
    );
  }

  return <Tag className={className}>{children}</Tag>;
}
