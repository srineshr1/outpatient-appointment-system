"use client";

import { animate, motion, useMotionValue, useReducedMotion, useSpring, useTransform, useVelocity } from "motion/react";
import { useEffect, useId, type PointerEvent } from "react";

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  className?: string;
}

// Tuned to match ReactBits SquishSwitch velocity-stretch spring feel.
const FLOW_SPRING = { stiffness: 320, damping: 40, mass: 0.6 };
const SWELL_SPRING = { stiffness: 520, damping: 34, mass: 0.6 };
const TRACK_W = 54;
const TRACK_H = 32;
const BORDER = 1;
const GAP = 2;
const THUMB = TRACK_H - (BORDER + GAP) * 2;
const MIN_X = GAP;
const MAX_X = TRACK_W - BORDER * 2 - GAP - THUMB;
const MAX_STRETCH = 0.4;
const STRETCH_SPEED = 600;
const STRETCH_GAIN = 0.36;

/** A dark-mode ReactBits squish toggle. The whole row is the hit target. */
export function Switch({ checked, onChange, label, description, disabled = false, className = "" }: SwitchProps) {
  const labelId = useId();
  const descriptionId = useId();
  const reduce = useReducedMotion();

  const x = useMotionValue(checked ? MAX_X : MIN_X);
  const flow = useSpring(useVelocity(x), FLOW_SPRING);
  const swell = useSpring(1, SWELL_SPRING);
  const gain = reduce ? 0 : STRETCH_GAIN;
  const stretchOf = (velocity: number) => 1 + Math.min(MAX_STRETCH, Math.abs(velocity) / STRETCH_SPEED) * gain;
  const scaleX = useTransform([flow, swell], (values: number[]) => {
    const velocity = values[0] ?? 0;
    const hover = values[1] ?? 1;
    return stretchOf(velocity) * hover;
  });
  const scaleY = useTransform([flow, swell], (values: number[]) => {
    const velocity = values[0] ?? 0;
    const hover = values[1] ?? 1;
    return hover / stretchOf(velocity);
  });

  useEffect(() => {
    const target = checked ? MAX_X : MIN_X;
    if (reduce) {
      x.jump(target);
      return undefined;
    }
    const controls = animate(x, target, {
      type: "spring",
      stiffness: 170,
      damping: 21.5,
      mass: 0.9,
      restDelta: 0.001,
      restSpeed: 0.01,
    });
    return () => controls.stop();
  }, [checked, reduce, x]);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelId}
      aria-describedby={description ? descriptionId : undefined}
      disabled={disabled}
      onClick={() => {
        if (!disabled) onChange(!checked);
      }}
      onPointerEnter={(event: PointerEvent<HTMLButtonElement>) => {
        if (event.pointerType === "mouse" && !disabled && !reduce) swell.set(1.045);
      }}
      onPointerLeave={() => swell.set(1)}
      className={`group flex w-full items-center justify-between gap-4 rounded-field py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${className}`.trim()}
    >
      <span>
        <span id={labelId} className="block text-body font-medium text-ink">
          {label}
        </span>
        {description ? (
          <span id={descriptionId} className="mt-0.5 block text-callout text-muted">
            {description}
          </span>
        ) : null}
      </span>
      <span
        aria-hidden="true"
        className={`relative block h-[32px] w-[54px] shrink-0 rounded-full border transition-[background-color,border-color] duration-200 ease-out motion-reduce:duration-0 ${
          checked
            ? "border-ink bg-ink"
            : "border-hairline bg-fill-strong group-hover:border-control"
        }`}
      >
        <motion.span
          style={{ x, scaleX, scaleY }}
          className={`absolute top-[2px] left-0 size-[26px] rounded-full transition-colors duration-200 ease-out motion-reduce:duration-0 ${
            checked ? "bg-canvas shadow-sm" : "bg-surface shadow-sm"
          }`}
        />
      </span>
    </button>
  );
}
