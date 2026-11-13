"use client";

import type { CSSProperties, ReactNode } from "react";

interface ShinyTextProps {
  children: ReactNode;
  className?: string;
  speed?: number;
  as?: "span" | "p" | "h1" | "h2" | "h3" | "div";
  style?: CSSProperties;
}

export function ShinyText({ children, className = "", as: Tag = "span", style }: ShinyTextProps) {
  return (
    <Tag className={className} style={style}>
      {children}
    </Tag>
  );
}
