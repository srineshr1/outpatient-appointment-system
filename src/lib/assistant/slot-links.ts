/**
 * Open times the assistant found this turn, as structured data for the dock. The dock lists
 * them by day, and for patients each time links straight to that slot's booking form.
 * The model's text is not parsed: these come from the availability tools' own results.
 */
import type { PublicUser } from "../clinic-types";

export interface SlotLink {
  id: string;
  doctorId: string;
  doctor: string;
  /** Clinic date, YYYY-MM-DD. */
  date: string;
  /** Clinic time, HH:MM. */
  time: string;
  endTime: string | null;
  mode: "stream" | "wave";
  /** Where a click goes: the booking form with this slot held. Null for staff, who don't book online. */
  href: string | null;
}

/** Tools whose results list open times. */
export const SLOT_TOOLS = new Set(["list_open_slots", "next_available", "suggest_slots"]);

/** Most times shown under one reply. */
export const MAX_SLOT_LINKS = 24;

/** The booking form with this slot held. Sign-in, if needed, comes back here. */
export function bookingHref(slotId: string): string {
  return `/book/details?slot=${encodeURIComponent(slotId)}`;
}

function toLink(value: unknown, user: PublicUser): SlotLink | null {
  if (!value || typeof value !== "object") return null;
  const slot = value as Record<string, unknown>;
  const { id, doctorId, date, time } = slot;
  if (typeof id !== "string" || !id || typeof doctorId !== "string" || !doctorId) return null;
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (typeof time !== "string" || !/^\d{2}:\d{2}$/.test(time)) return null;
  return {
    id,
    doctorId,
    doctor: typeof slot.doctor === "string" && slot.doctor ? slot.doctor : "Doctor",
    date,
    time,
    endTime: typeof slot.endTime === "string" && /^\d{2}:\d{2}$/.test(slot.endTime) ? slot.endTime : null,
    mode: slot.mode === "wave" ? "wave" : "stream",
    href: user.role === "patient" ? bookingHref(id) : null,
  };
}

/** The open times in an availability tool's result (`slots`, `slot`, `exact`, `alternatives`). */
export function slotLinksFrom(user: PublicUser, forModel: unknown): SlotLink[] {
  if (!forModel || typeof forModel !== "object" || "error" in forModel) return [];
  const result = forModel as Record<string, unknown>;
  const found: unknown[] = [];
  if (result.exact) found.push(result.exact);
  if (result.slot) found.push(result.slot);
  if (Array.isArray(result.slots)) found.push(...result.slots);
  if (Array.isArray(result.alternatives)) found.push(...result.alternatives);
  return found.map((item) => toLink(item, user)).filter((item): item is SlotLink => item !== null);
}

/** Add new times to a turn's list: no repeats, in time order, capped. */
export function mergeSlotLinks(current: readonly SlotLink[], more: readonly SlotLink[]): SlotLink[] {
  const byId = new Map<string, SlotLink>();
  for (const slot of [...current, ...more]) if (!byId.has(slot.id)) byId.set(slot.id, slot);
  return [...byId.values()]
    .sort((a, b) => (a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)))
    .slice(0, MAX_SLOT_LINKS);
}
