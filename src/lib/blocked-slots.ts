import { getStore } from "./store";

/** The booked-slot list is a store listing. Browsing re-reads it at most this often per instance. */
const FRESH_MS = 3000;
let loaded: { at: number; ids: string[] } | null = null;
let pending: Promise<string[]> | null = null;

/**
 * Slot ids that are already booked, for showing availability. Booking itself never uses this: it
 * checks the store directly, so a slightly old list can only show a taken time as open for a
 * moment, and the booking is then refused as before.
 */
export async function blockedSlotIds(): Promise<string[]> {
  if (loaded && Date.now() - loaded.at < FRESH_MS) return loaded.ids;
  pending ??= (async () => {
    try {
      const ids = await (await getStore()).listBlockedSlotIds();
      loaded = { at: Date.now(), ids };
      return ids;
    } finally {
      pending = null;
    }
  })();
  return pending;
}

/** Call after a booking or a cancellation so this instance shows the change straight away. */
export function forgetBlockedSlots(): void {
  loaded = null;
}
