'use client';

import Link from 'next/link';
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
  type SpringOptions,
} from 'motion/react';
import { Children, cloneElement, isValidElement, useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react';

export interface DockItemData {
  icon: ReactNode;
  label: string;
  href?: string;
  onClick?: () => void;
  active?: boolean;
  badge?: number | string | boolean;
  className?: string;
  ariaLabel?: string;
}

export interface DockProps {
  items: DockItemData[];
  className?: string;
  spring?: SpringOptions;
  magnification?: number;
  distance?: number;
  panelHeight?: number;
  dockHeight?: number;
  baseItemSize?: number;
  bounce?: boolean;
  ariaLabel?: string;
}

interface DockItemProps {
  className?: string;
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  active?: boolean;
  badge?: number | string | boolean;
  ariaLabel?: string;
  mouseX: MotionValue<number>;
  spring: SpringOptions;
  distance: number;
  baseItemSize: number;
  magnification: number;
  bounce: boolean;
}

function DockItem({
  children,
  className = '',
  onClick,
  href,
  active = false,
  badge,
  ariaLabel,
  mouseX,
  spring,
  distance,
  magnification,
  baseItemSize,
  bounce,
}: DockItemProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isHovered = useMotionValue(0);
  const [bouncing, setBouncing] = useState(false);
  const reduce = useReducedMotion();

  const mouseDistance = useTransform(mouseX, (val) => {
    const rect = ref.current?.getBoundingClientRect() ?? { x: 0, width: baseItemSize };
    return val - rect.x - baseItemSize / 2;
  });

  const targetSize = useTransform(
    mouseDistance,
    [-distance, 0, distance],
    [baseItemSize, reduce ? baseItemSize : magnification, baseItemSize],
  );
  const size = useSpring(targetSize, spring);

  const handleActivate = () => {
    if (bounce && !reduce) {
      setBouncing(true);
      setTimeout(() => setBouncing(false), 380);
    }
    onClick?.();
  };

  const innerContent = (
    <>
      {Children.map(children, (child) =>
        isValidElement(child)
          ? cloneElement(child as ReactElement<{ isHovered?: MotionValue<number> }>, { isHovered })
          : child,
      )}
      {badge !== undefined && badge !== false && badge !== 0 ? (
        <span
          aria-hidden="true"
          className="tabular absolute -top-1 -right-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-accent px-1.5 py-0.5 text-[10px] leading-none font-bold text-accent-ink shadow-sm ring-2 ring-surface"
        >
          {badge === true ? '' : typeof badge === 'number' && badge > 99 ? '99+' : badge}
        </span>
      ) : null}
      {active ? (
        <span
          aria-hidden="true"
          className="absolute -bottom-1.5 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-accent"
        />
      ) : null}
    </>
  );

  const baseBoxClass = `relative inline-flex size-full items-center justify-center rounded-2xl border transition-colors outline-none focus-visible:outline-3 focus-visible:outline-accent/60 focus-visible:outline-offset-2 ${
    active
      ? 'border-accent/50 bg-accent-soft text-accent shadow-card'
      : 'border-hairline bg-surface-2/90 text-ink-2 hover:border-control hover:bg-fill hover:text-ink'
  }`;

  return (
    <motion.div
      ref={ref}
      style={{ width: size, height: size }}
      animate={bouncing ? { y: [0, -10, 0] } : { y: 0 }}
      transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
      onHoverStart={() => isHovered.set(1)}
      onHoverEnd={() => isHovered.set(0)}
      onFocus={() => isHovered.set(1)}
      onBlur={() => isHovered.set(0)}
      className={`relative inline-flex shrink-0 items-center justify-center ${className}`}
    >
      {href ? (
        <Link
          href={href}
          onClick={handleActivate}
          aria-label={ariaLabel}
          aria-current={active ? 'page' : undefined}
          className={baseBoxClass}
        >
          {innerContent}
        </Link>
      ) : (
        <button
          type="button"
          onClick={handleActivate}
          aria-label={ariaLabel}
          aria-pressed={active || undefined}
          className={baseBoxClass}
        >
          {innerContent}
        </button>
      )}
    </motion.div>
  );
}

export function DockLabel({
  children,
  className = '',
  isHovered,
}: {
  children: ReactNode;
  className?: string;
  isHovered?: MotionValue<number>;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isHovered) return;
    const unsubscribe = isHovered.on('change', (latest) => {
      setVisible(latest === 1);
    });
    return () => unsubscribe();
  }, [isHovered]);

  return (
    <AnimatePresence>
      {visible ? (
        <motion.span
          initial={{ opacity: 0, y: 4, scale: 0.96 }}
          animate={{ opacity: 1, y: -8, scale: 1 }}
          exit={{ opacity: 0, y: 4, scale: 0.96 }}
          transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
          role="tooltip"
          className={`pointer-events-none absolute -top-9 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-lg border border-hairline bg-ink px-2.5 py-1 text-caption font-medium text-canvas shadow-raised ${className}`}
        >
          {children}
        </motion.span>
      ) : null}
    </AnimatePresence>
  );
}

export function DockIcon({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`flex items-center justify-center ${className}`}>{children}</span>;
}

export function Dock({
  items,
  className = '',
  spring = { mass: 0.1, stiffness: 180, damping: 14 },
  magnification = 64,
  distance = 160,
  panelHeight = 66,
  dockHeight = 256,
  baseItemSize = 46,
  bounce = true,
  ariaLabel = 'Workspace dock',
}: DockProps) {
  const mouseX = useMotionValue(Infinity);
  const isHovered = useMotionValue(0);
  const reduce = useReducedMotion();

  const maxHeight = useMemo(
    () => Math.max(dockHeight, magnification + magnification / 2 + 4),
    [dockHeight, magnification],
  );
  const heightRow = useTransform(isHovered, [0, 1], [panelHeight, reduce ? panelHeight : maxHeight]);
  const height = useSpring(heightRow, spring);

  return (
    <motion.div
      style={{ height: reduce ? panelHeight : height }}
      onMouseMove={({ pageX }) => {
        isHovered.set(1);
        mouseX.set(pageX);
      }}
      onMouseLeave={() => {
        isHovered.set(0);
        mouseX.set(Infinity);
      }}
      className="pointer-events-none flex max-w-full items-end justify-center"
    >
      <nav
        aria-label={ariaLabel}
        style={{ height: panelHeight }}
        className={`pointer-events-auto flex items-end gap-2.5 rounded-[1.5rem] border border-hairline bg-surface/90 px-3.5 pb-2.5 shadow-float backdrop-blur-xl backdrop-saturate-150 ${className}`}
      >
        {items.map((item) => (
          <DockItem
            key={item.href ?? item.label}
            href={item.href}
            onClick={item.onClick}
            active={item.active}
            badge={item.badge}
            ariaLabel={item.ariaLabel ?? item.label}
            className={item.className}
            mouseX={mouseX}
            spring={spring}
            distance={distance}
            magnification={magnification}
            baseItemSize={baseItemSize}
            bounce={bounce}
          >
            <DockIcon>{item.icon}</DockIcon>
            <DockLabel>{item.label}</DockLabel>
          </DockItem>
        ))}
      </nav>
    </motion.div>
  );
}

export default Dock;
