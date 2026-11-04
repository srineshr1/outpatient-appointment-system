"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { useIsNavigation } from "@/components/shell/PageHeading";
import { spring } from "@/lib/motion";

/** Re-mounts on every navigation: a short rise-and-fade between steps. Skipped on first load. */
export default function Template({ children }: { children: ReactNode }) {
  const navigated = useIsNavigation();
  return (
    <motion.div
      initial={navigated ? { opacity: 0, y: 12 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={spring.gentle}
    >
      {children}
    </motion.div>
  );
}
