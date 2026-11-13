"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import type { Theme } from "@/lib/theme";
import { BookingProvider } from "./BookingProvider";
import { ClockProvider } from "./ClockProvider";
import { ThemeProvider } from "./ThemeProvider";

export function Providers({
  initialNow,
  initialTheme = "light",
  children,
}: {
  initialNow: number;
  initialTheme?: Theme;
  children: ReactNode;
}) {
  return (
    <ThemeProvider initialTheme={initialTheme}>
      <MotionConfig reducedMotion="user">
        <ClockProvider initialNow={initialNow}>
          <BookingProvider>{children}</BookingProvider>
        </ClockProvider>
      </MotionConfig>
    </ThemeProvider>
  );
}
