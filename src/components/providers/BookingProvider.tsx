"use client";

import { createContext, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from "react";
import {
  bookingReducer,
  initialBookingState,
  parsePersisted,
  STORAGE_KEY,
  toPersisted,
  type BookingAction,
  type BookingState,
} from "@/lib/booking-state";

interface BookingContextValue {
  state: BookingState;
  dispatch: (action: BookingAction) => void;
  /** False until sessionStorage has been read. Guards must wait for this. */
  ready: boolean;
}

const BookingContext = createContext<BookingContextValue | null>(null);

function readStorage(): string | null {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function BookingProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(bookingReducer, initialBookingState);
  const [ready, setReady] = useState(false);

  // Hydrate after mount so the first client render matches the server HTML.
  useEffect(() => {
    const persisted = parsePersisted(readStorage());
    if (persisted) dispatch({ type: "hydrate", state: persisted });
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(toPersisted(state)));
    } catch {
      // Private mode or quota: the flow still works, it just won't survive a reload.
    }
  }, [state, ready]);

  const value = useMemo(() => ({ state, dispatch, ready }), [state, ready]);
  return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>;
}

export function useBooking(): BookingContextValue {
  const value = useContext(BookingContext);
  if (!value) throw new Error("useBooking must be used inside <BookingProvider>.");
  return value;
}
