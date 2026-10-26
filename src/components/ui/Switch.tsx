"use client";

import { motion } from "motion/react";
import { useId } from "react";
import { spring } from "@/lib/motion";

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}

/** An iOS-style toggle. The whole row is the hit target. */
export function Switch({ checked, onChange, label, description }: SwitchProps) {
  const labelId = useId();
  const descriptionId = useId();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelId}
      aria-describedby={description ? descriptionId : undefined}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-field py-2 text-left"
    >
      <span>
        <span id={labelId} className="block text-body text-ink">
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
        className={`flex h-[31px] w-[51px] shrink-0 rounded-full p-[2px] transition-colors duration-200 ${
          checked ? "justify-end bg-success" : "justify-start bg-fill-strong"
        }`}
      >
        <motion.span
          layout
          transition={spring.snap}
          className="size-[27px] rounded-full bg-white shadow-[0_3px_8px_rgb(0_0_0/0.15),0_1px_1px_rgb(0_0_0/0.16)]"
        />
      </span>
    </button>
  );
}
