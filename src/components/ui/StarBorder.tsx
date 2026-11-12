import type { ElementType, ReactNode } from "react";

interface StarBorderProps {
  as?: ElementType;
  className?: string;
  color?: string;
  speed?: string;
  children: ReactNode;
  innerClassName?: string;
}

export function StarBorder({
  as: Component = "div",
  className = "",
  color = "#22d3ee",
  speed = "6s",
  children,
  innerClassName = "",
}: StarBorderProps) {
  return (
    <Component className={`relative inline-block overflow-hidden rounded-2xl p-px ${className}`.trim()}>
      <div
        aria-hidden="true"
        className="rb-decorative-motion pointer-events-none absolute -top-1/2 -left-1/2 h-[200%] w-[200%] opacity-75"
        style={{
          background: `radial-gradient(circle, ${color}, transparent 12%)`,
          animation: `star-move-bottom ${speed} linear infinite alternate`,
        }}
      />
      <div
        aria-hidden="true"
        className="rb-decorative-motion pointer-events-none absolute -top-1/2 -left-1/2 h-[200%] w-[200%] opacity-75"
        style={{
          background: `radial-gradient(circle, ${color}, transparent 12%)`,
          animation: `star-move-top ${speed} linear infinite alternate`,
        }}
      />
      <div className={`relative z-10 rounded-[calc(1rem-1px)] border border-white/[0.06] bg-surface ${innerClassName}`.trim()}>
        {children}
      </div>
    </Component>
  );
}
