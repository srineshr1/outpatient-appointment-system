"use client";

import { LayoutGroup, motion } from "motion/react";
import { useId, useRef, type KeyboardEvent } from "react";
import { spring } from "@/lib/motion";

export interface SegmentOption {
  value: string;
  label: string;
}

interface ChipGroupProps {
  label: string;
  options: SegmentOption[];
  value: string;
  onChange: (value: string) => void;
  /** Layout of the row. Defaults to wrapping chips. Pass overflow classes to make it scroll sideways. */
  className?: string;
}

/**
 * Single-select filter chips. Rendered as a radiogroup with roving focus, and a
 * selection pill that glides between options.
 */
export function ChipGroup({ label, options, value, onChange, className = "flex flex-wrap gap-2" }: ChipGroupProps) {
  const groupId = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(event: KeyboardEvent, index: number) {
    const keys: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    let next: number | null = null;
    if (event.key in keys) next = (index + keys[event.key]! + options.length) % options.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = options.length - 1;
    if (next === null) return;
    event.preventDefault();
    onChange(options[next]!.value);
    refs.current[next]?.focus();
  }

  return (
    <LayoutGroup id={groupId}>
      {/* layoutScroll: the row may scroll sideways, and the pill has to follow that scroll. */}
      <motion.div layoutScroll role="radiogroup" aria-label={label} className={className}>
        {options.map((option, index) => {
          const selected = option.value === value;
          return (
            <motion.button
              key={option.value}
              ref={(node) => {
                refs.current[index] = node;
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(option.value)}
              onKeyDown={(event) => onKeyDown(event, index)}
              whileTap={{ scale: 0.96 }}
              transition={spring.press}
              className={`relative isolate min-h-11 shrink-0 rounded-full px-4 text-callout font-medium whitespace-nowrap transition-colors duration-200 ${
                selected ? "text-white" : "bg-surface text-ink shadow-[inset_0_0_0_1px_var(--color-hairline)] hover:bg-fill"
              }`}
            >
              {selected ? (
                <motion.span
                  layoutId="chip-pill"
                  transition={spring.snap}
                  className="absolute inset-0 -z-10 rounded-full bg-ink"
                  aria-hidden="true"
                />
              ) : null}
              {option.label}
            </motion.button>
          );
        })}
      </motion.div>
    </LayoutGroup>
  );
}
