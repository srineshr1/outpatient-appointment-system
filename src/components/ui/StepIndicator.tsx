"use client";

import { motion } from "motion/react";
import { Check } from "@/components/icons";
import { spring } from "@/lib/motion";

export const STEPS = ["Doctor", "Time", "Details", "Done"] as const;

export function StepIndicator({ current }: { current: number }) {
  const progress = (current + 1) / STEPS.length;
  return (
    <nav aria-label="Booking progress">
      <ol className="grid grid-cols-4 gap-2">
        {STEPS.map((label, index) => {
          const done = index < current;
          const active = index === current;
          return (
            <li
              key={label}
              aria-current={active ? "step" : undefined}
              className={`flex items-center gap-1.5 text-caption transition-colors duration-300 ${
                active ? "font-semibold text-ink" : done ? "text-ink-2" : "text-muted"
              }`}
            >
              {done ? (
                <Check size={14} strokeWidth={2.4} className="shrink-0 text-accent" />
              ) : (
                <span aria-hidden="true" className="tabular w-3.5 shrink-0 text-center">
                  {index + 1}
                </span>
              )}
              <span>
                {label}
                <span className="sr-only">{done ? ", completed" : active ? ", current step" : ""}</span>
              </span>
            </li>
          );
        })}
      </ol>
      <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-fill-strong" aria-hidden="true">
        <motion.div
          className="h-full origin-left rounded-full bg-accent"
          initial={false}
          animate={{ scaleX: progress }}
          transition={spring.gentle}
        />
      </div>
    </nav>
  );
}
