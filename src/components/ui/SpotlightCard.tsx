"use client";

import { useRef, useState, type ComponentProps, type ElementType, type MouseEvent } from "react";

interface SpotlightCardProps extends ComponentProps<"div"> {
  spotlightColor?: string;
  glowColor?: string;
  as?: "div" | "li" | "article" | "section";
}

export function SpotlightCard({
  children,
  className = "",
  spotlightColor = "rgba(34, 211, 238, 0.12)",
  glowColor = "rgba(34, 211, 238, 0.06)",
  as: Tag = "div",
  style,
  onMouseMove,
  onMouseEnter,
  onMouseLeave,
  ...props
}: SpotlightCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setPosition({ x: event.clientX - rect.left, y: event.clientY - rect.top });
    }
    onMouseMove?.(event);
  };

  const handleMouseEnter = (event: MouseEvent<HTMLDivElement>) => {
    setOpacity(1);
    onMouseEnter?.(event);
  };

  const handleMouseLeave = (event: MouseEvent<HTMLDivElement>) => {
    setOpacity(0);
    onMouseLeave?.(event);
  };

  const Component = Tag as ElementType;

  return (
    <Component
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative overflow-hidden rounded-sheet border border-hairline bg-surface [box-shadow:inset_0_1px_0_rgba(255,255,255,0.06),var(--shadow-card)] transition-shadow duration-300 hover:[box-shadow:inset_0_1px_0_rgba(255,255,255,0.09),var(--shadow-raised)] ${className}`.trim()}
      style={{
        backgroundImage: "radial-gradient(ellipse at 50% 0%, rgba(34, 211, 238, 0.04) 0%, transparent 60%)",
        ...style,
      }}
      {...props}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[inherit] p-px transition-opacity duration-300"
        style={{
          opacity,
          background: `radial-gradient(280px circle at ${position.x}px ${position.y}px, rgba(34, 211, 238, 0.45), transparent 65%)`,
          WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor",
          mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          maskComposite: "exclude",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-300"
        style={{
          opacity,
          background: `radial-gradient(500px circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 42%)`,
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-300"
        style={{
          opacity: opacity * 0.5,
          background: `radial-gradient(300px circle at ${position.x}px ${position.y}px, ${glowColor}, transparent 60%)`,
        }}
      />
      {children}
    </Component>
  );
}
