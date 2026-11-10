/**
 * Elastic scheduling: allow doctors to expand or shrink a session's hours without
 * losing existing booked appointments.
 *
 * The core idea is simple: instead of blocking all shape changes when bookings exist,
 * generate the slot ids the new session shape would produce and check whether every
 * existing booking's slot still exists. Only bookings whose slot id disappears are
 * "orphaned" — those must be moved or cancelled first.
 *
 * This means:
 * - Expanding hours (9 AM–12 PM → 8 AM–12 PM): always safe — old slots are a subset.
 * - Shrinking hours (10 AM–12 PM → 10 AM–11 AM): safe if no bookings are in the removed range.
 * - Adding weekdays: always safe.
 * - Removing a weekday: safe if no bookings fall on that day.
 * - Changing slot length or mode: only safe if all bookings' slot ids survive.
 */
import type { AppointmentRecord, ConsultSession } from "./clinic-types";
import { slotsForSession, baseSlotId } from "./sessions";

export interface OrphanCheck {
  /** Total number of upcoming booked visits in the session. */
  total: number;
  /** Number of visits whose slot would disappear under the new shape. */
  orphaned: number;
  /** Human-readable labels for orphaned visits: "2026-11-05 10:40". */
  orphanedTimes: string[];
}

/**
 * Pure function: given the upcoming visits and the new session shape, find which
 * bookings would be orphaned. No store access — the caller provides the visit list.
 */
export function findOrphanedVisits(
  upcoming: readonly Pick<AppointmentRecord, "slotId" | "date" | "time">[],
  newSession: ConsultSession,
  doctorId: string,
): OrphanCheck {
  if (upcoming.length === 0) return { total: 0, orphaned: 0, orphanedTimes: [] };

  // Date range covered by the bookings so we only generate the slots we need.
  const dates = upcoming.map((visit) => visit.date).sort();
  const firstDate = dates[0]!;
  const lastDate = dates[dates.length - 1]!;

  // Slot ids the new session shape would produce over those dates.
  const newSlots = slotsForSession(newSession, doctorId, firstDate, lastDate);
  const newSlotIds = new Set(newSlots.map((slot) => slot.id));

  const orphanedTimes: string[] = [];
  for (const visit of upcoming) {
    const base = baseSlotId(visit.slotId);
    if (!newSlotIds.has(base)) {
      orphanedTimes.push(`${visit.date} ${visit.time}`);
    }
  }

  return { total: upcoming.length, orphaned: orphanedTimes.length, orphanedTimes };
}
