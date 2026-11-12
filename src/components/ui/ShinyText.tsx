import type { ReactNode } from "react";

interface ShinyTextProps {
  children: ReactNode;
  className?: string;
  speed?: number;
  as?: "span" | "p" | "h1" | "h2" | "h3" | "div";
}

export function ShinyText({ children, className = "", speed = 4, as: Tag = "span" }: ShinyTextProps) {
  return (
    <Tag
      className={`rb-decorative-motion inline-block ${className}`.trim()}
      style={{
        color: "#fafafa",
        backgroundImage: "linear-gradient(115deg, #d4d4d8 0%, #ffffff 35%, #67e8f9 50%, #ffffff 65%, #d4d4d8 100%)",
        backgroundSize: "200% auto",
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        WebkitTextFillColor: "transparent",
        animation: `shine ${speed}s linear infinite`,
      }}
    >
      {children}
    </Tag>
  );
}
