"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { BookingProvider } from "./BookingProvider";
import { ClockProvider } from "./ClockProvider";

export function Providers({ initialNow, children }: { initialNow: number; children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <ClockProvider initialNow={initialNow}>
        <BookingProvider>{children}</BookingProvider>
      </ClockProvider>
    </MotionConfig>
  );
}
