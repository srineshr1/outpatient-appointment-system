import type { Transition } from "motion/react";

/** Springs tuned to feel like UIKit defaults: quick, slightly soft, no wobble. */
export const spring = {
  /** Press feedback on buttons and chips. */
  press: { type: "spring", stiffness: 520, damping: 32, mass: 0.6 },
  /** Selection indicators that slide between options. */
  snap: { type: "spring", stiffness: 480, damping: 38 },
  /** Content entering, sheets and bars. */
  gentle: { type: "spring", stiffness: 260, damping: 30 },
  /** Lists reflowing. */
  layout: { type: "spring", stiffness: 380, damping: 36 },
} satisfies Record<string, Transition>;

export const fadeRise = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
};
