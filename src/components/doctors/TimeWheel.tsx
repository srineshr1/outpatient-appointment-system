"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, type KeyboardEvent } from "react";
import { minutesLabel } from "./schedule-model";
import {
  hourOptions,
  indexFromOffset,
  minuteOptions,
  nearestValue,
  nudge,
  offsetForIndex,
  pad2,
  shiftHours,
  wheelValues,
  withHour,
  withMinute,
} from "./time-wheel";

/** Row height of one drum entry, in px. */
export const WHEEL_ROW = 30;
/** Rows visible in a drum: the selected one in the centre and two either side. */
export const WHEEL_VISIBLE = 5;
const PAD = ((WHEEL_VISIBLE - 1) / 2) * WHEEL_ROW;

type Palette = { bg: string; bd: string; fg: string; dot: string };

/**
 * Android-style 24-hour time picker: an hour drum and a minute drum that spin, snap to the
 * editor's step grid and report the snapped time through `onChange`.
 */
export function TimeWheelPicker({
  label,
  ariaLabel,
  valueText,
  value,
  min,
  max,
  step,
  disabled,
  note,
  palette,
  onChange,
}: {
  label: string;
  ariaLabel: string;
  valueText: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled: boolean;
  note: string;
  palette: Palette;
  onChange: (value: number) => void;
}) {
  const values = useMemo(() => wheelValues(min, max, step), [min, max, step]);
  const shown = nearestValue(values, value);
  const hours = useMemo(() => hourOptions(values), [values]);
  const hour = Math.floor(shown / 60);
  const minutes = useMemo(() => minuteOptions(values, hour), [values, hour]);

  const commit = useCallback(
    (next: number) => {
      if (disabled || next === shown) return;
      onChange(next);
    },
    [disabled, shown, onChange],
  );

  const keys = (unit: "hour" | "minute") => (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const moves: Record<string, () => number> = {
      ArrowUp: () => (unit === "hour" ? shiftHours(values, shown, 1) : nudge(values, shown, 1)),
      ArrowDown: () => (unit === "hour" ? shiftHours(values, shown, -1) : nudge(values, shown, -1)),
      PageUp: () => shiftHours(values, shown, 1),
      PageDown: () => shiftHours(values, shown, -1),
      Home: () => values[0] ?? shown,
      End: () => values[values.length - 1] ?? shown,
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    commit(move());
  };

  return (
    <fieldset
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      className={`m-0 flex min-w-0 flex-col gap-1 border-0 p-0 ${disabled ? "opacity-55" : ""}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-xs text-[#4F605C] tabular-nums">
          {minutesLabel(values[0] ?? shown)}–{minutesLabel(values[values.length - 1] ?? shown)}
        </span>
      </div>
      <div
        className="relative flex items-stretch justify-center gap-1 rounded-[12px] border border-[#E3E8E6] bg-[#FBFCFC] px-1"
        style={{ height: WHEEL_VISIBLE * WHEEL_ROW + 2 }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-1 rounded-[10px] border"
          style={{
            top: PAD,
            height: WHEEL_ROW,
            background: disabled ? "#EEF1F0" : palette.bg,
            borderColor: disabled ? "#E3E8E6" : `${palette.bd}40`,
          }}
        />
        <Drum
          ariaLabel={`${ariaLabel}, hour`}
          valueText={valueText}
          valueNow={hour}
          items={hours.map(pad2)}
          index={Math.max(0, hours.indexOf(hour))}
          disabled={disabled}
          color={palette.fg}
          onKeyDown={keys("hour")}
          onPick={(index) => commit(withHour(values, shown, hours[index] ?? hour))}
          onStep={(delta) => {
            const next = hours[Math.min(hours.length - 1, Math.max(0, hours.indexOf(hour) + delta))] ?? hour;
            commit(withHour(values, shown, next));
          }}
        />
        <span aria-hidden="true" className="relative self-center text-lg font-bold text-[#14201F]">
          :
        </span>
        <Drum
          ariaLabel={`${ariaLabel}, minutes`}
          valueText={valueText}
          valueNow={shown % 60}
          items={minutes.map(pad2)}
          index={Math.max(0, minutes.indexOf(shown % 60))}
          disabled={disabled}
          color={palette.fg}
          onKeyDown={keys("minute")}
          onPick={(index) => commit(withMinute(values, shown, minutes[index] ?? shown % 60))}
          onStep={(delta) => commit(nudge(values, shown, delta))}
        />
      </div>
      <p className="min-h-4 text-center text-xs font-semibold text-[#14201F] tabular-nums">{note}</p>
      <span className="sr-only" aria-live="polite">
        {valueText}
      </span>
    </fieldset>
  );
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;
}

function scrollDrum(el: HTMLElement, top: number, smooth: boolean) {
  if (typeof el.scrollTo === "function") el.scrollTo({ top, behavior: smooth && !prefersReducedMotion() ? "smooth" : "auto" });
  else el.scrollTop = top;
}

function Drum({
  ariaLabel,
  valueText,
  valueNow,
  items,
  index,
  disabled,
  color,
  onKeyDown,
  onPick,
  onStep,
}: {
  ariaLabel: string;
  valueText: string;
  valueNow: number;
  items: string[];
  index: number;
  disabled: boolean;
  color: string;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  onPick: (index: number) => void;
  onStep: (delta: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const rows = useRef<(HTMLDivElement | null)[]>([]);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frame = useRef<number | null>(null);
  const mounted = useRef(false);
  const drag = useRef<{ y: number; top: number; moved: boolean; pointer: number } | null>(null);
  const wheelDelta = useRef(0);
  const latest = useRef({ index, count: items.length, onPick, onStep, disabled });
  useLayoutEffect(() => {
    latest.current = { index, count: items.length, onPick, onStep, disabled };
  });

  // Fade and tilt rows by their distance from the centre line, like Android's drums.
  const paint = useCallback(() => {
    frame.current = null;
    const el = ref.current;
    if (!el) return;
    const position = el.scrollTop / WHEEL_ROW;
    rows.current.forEach((row, i) => {
      if (!row) return;
      const distance = Math.min(Math.abs(i - position), 3);
      row.style.opacity = String(Math.max(0.18, 1 - distance * 0.38));
      row.style.transform = `perspective(240px) rotateX(${(position - i) * 16}deg) scale(${1 - distance * 0.07})`;
    });
  }, []);

  const schedulePaint = useCallback(() => {
    if (frame.current !== null) return;
    if (typeof requestAnimationFrame === "function") frame.current = requestAnimationFrame(paint);
    else paint();
  }, [paint]);

  const settle = useCallback(() => {
    settleTimer.current = null;
    const el = ref.current;
    if (!el || drag.current) return;
    const { count, index: current, onPick: pick } = latest.current;
    const next = indexFromOffset(el.scrollTop, WHEEL_ROW, count);
    if (Math.abs(el.scrollTop - offsetForIndex(next, WHEEL_ROW)) > 1) scrollDrum(el, offsetForIndex(next, WHEEL_ROW), true);
    if (next !== current) pick(next);
  }, []);

  // Keep the drum on the selected row when the value changes from outside (keys, the other drum).
  useEffect(() => {
    const el = ref.current;
    if (!el || drag.current) return;
    const target = offsetForIndex(index, WHEEL_ROW);
    if (Math.abs(el.scrollTop - target) > 1) scrollDrum(el, target, mounted.current);
    mounted.current = true;
    paint();
  }, [index, items.length, paint]);

  // One wheel notch (or a trackpad swipe of about a row) moves one row; never a free spin.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      if (latest.current.disabled) return;
      event.preventDefault();
      const unit = event.deltaMode === 1 ? WHEEL_ROW / 3 : event.deltaMode === 2 ? WHEEL_ROW * WHEEL_VISIBLE : 1;
      wheelDelta.current += event.deltaY * unit;
      if (Math.abs(wheelDelta.current) < WHEEL_ROW * 0.8) return;
      const delta = Math.sign(wheelDelta.current);
      wheelDelta.current = 0;
      latest.current.onStep(delta);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    const onEnd = () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
      settle();
    };
    el.addEventListener("scrollend", onEnd);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("scrollend", onEnd);
      if (settleTimer.current) clearTimeout(settleTimer.current);
      if (frame.current !== null && typeof cancelAnimationFrame === "function") cancelAnimationFrame(frame.current);
    };
  }, [settle]);

  const pickRow = (i: number) => {
    if (disabled || drag.current?.moved) return;
    const el = ref.current;
    if (el) scrollDrum(el, offsetForIndex(i, WHEEL_ROW), true);
    if (i !== index) onPick(i);
  };

  return (
    <div
      ref={ref}
      role="spinbutton"
      aria-label={ariaLabel}
      aria-valuenow={valueNow}
      aria-valuetext={valueText}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={onKeyDown}
      onScroll={() => {
        schedulePaint();
        if (drag.current) return;
        if (settleTimer.current) clearTimeout(settleTimer.current);
        settleTimer.current = setTimeout(settle, 120);
      }}
      onPointerDown={(event) => {
        // Touch and pens scroll natively; a mouse drags the drum by hand.
        if (disabled || event.pointerType !== "mouse" || event.button !== 0) return;
        drag.current = { y: event.clientY, top: event.currentTarget.scrollTop, moved: false, pointer: event.pointerId };
      }}
      onPointerMove={(event) => {
        const state = drag.current;
        const el = ref.current;
        if (!state || !el) return;
        const dy = event.clientY - state.y;
        if (!state.moved && Math.abs(dy) < 4) return;
        if (!state.moved) {
          state.moved = true;
          el.style.scrollSnapType = "none";
          el.setPointerCapture?.(state.pointer);
        }
        el.scrollTop = state.top - dy;
      }}
      onPointerUp={() => {
        const state = drag.current;
        const el = ref.current;
        if (!state) return;
        if (!state.moved) {
          drag.current = null;
          return;
        }
        if (el) el.style.scrollSnapType = "";
        // Keep the drag flag until the click that follows has been swallowed, then snap.
        setTimeout(() => {
          drag.current = null;
          settle();
        }, 0);
      }}
      onPointerCancel={() => {
        if (ref.current) ref.current.style.scrollSnapType = "";
        drag.current = null;
        settle();
      }}
      className={`relative w-12 shrink-0 overscroll-contain rounded-[10px] outline-none [scrollbar-width:none] focus-visible:ring-2 focus-visible:ring-[#14201F] [&::-webkit-scrollbar]:hidden ${
        disabled ? "cursor-default overflow-hidden" : "cursor-grab snap-y snap-mandatory overflow-y-auto active:cursor-grabbing"
      }`}
      style={{ height: WHEEL_VISIBLE * WHEEL_ROW, paddingTop: PAD, paddingBottom: PAD, touchAction: "pan-y" }}
    >
      {items.map((item, i) => (
        <div
          key={`${item}-${i}`}
          ref={(node) => {
            rows.current[i] = node;
          }}
          aria-hidden="true"
          onClick={() => pickRow(i)}
          className={`flex snap-center items-center justify-center text-[19px] tabular-nums select-none ${
            i === index ? "font-bold" : "font-medium text-[#4F605C]"
          }`}
          style={{ height: WHEEL_ROW, color: i === index ? color : undefined }}
        >
          {item}
        </div>
      ))}
    </div>
  );
}
