"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { now as clockNow } from "@/lib/clock";
import { bookWindow, type BookWindow } from "@/lib/data";

interface ClockValue {
  now: Date;
  window: BookWindow;
}

const ClockContext = createContext<ClockValue | null>(null);

/**
 * Shares one "now" across the tree. It starts from the server's timestamp so the
 * first client render matches the HTML, then ticks on each minute boundary.
 */
export function ClockProvider({ initialNow, children }: { initialNow: number; children: ReactNode }) {
  const [instant, setInstant] = useState(initialNow);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const current = clockNow().getTime();
      setInstant(current);
      timer = setTimeout(tick, 60_000 - (current % 60_000) + 50);
    };
    timer = setTimeout(tick, 0);
    return () => clearTimeout(timer);
  }, []);

  const now = new Date(instant);
  return <ClockContext.Provider value={{ now, window: bookWindow(now) }}>{children}</ClockContext.Provider>;
}

export function useClock(): ClockValue {
  const value = useContext(ClockContext);
  if (!value) throw new Error("useClock must be used inside <ClockProvider>.");
  return value;
}
