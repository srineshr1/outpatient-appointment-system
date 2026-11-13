'use client';

import { useRef, useState, type MouseEvent, type ReactNode } from 'react';

export interface MagicBentoProps {
  children: ReactNode;
  className?: string;
}

export interface BentoCardProps {
  children: ReactNode;
  className?: string;
  spotlightColor?: string;
}

export function MagicBento({ children, className = '' }: MagicBentoProps) {
  return <div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-4 ${className}`}>{children}</div>;
}

export function BentoCard({
  children,
  className = '',
  spotlightColor = 'rgba(56, 189, 248, 0.14)',
}: BentoCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({ x: event.clientX - rect.left, y: event.clientY - rect.top });
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setOpacity(1)}
      onMouseLeave={() => setOpacity(0)}
      className={`relative overflow-hidden rounded-sheet border border-hairline bg-surface p-5 shadow-card transition-colors hover:border-control ${className}`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          opacity,
          background: `radial-gradient(280px circle at ${pos.x}px ${pos.y}px, ${spotlightColor}, transparent 75%)`,
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export default MagicBento;
