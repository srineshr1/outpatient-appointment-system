import type { ConsultSession } from "@/lib/clinic-types";

export interface SessionDefaults {
  id: string;
  label: string;
  kind: "recurring" | "once";
  onDate: string;
  startDate: string;
  endDate: string;
  weekdays: number[];
  startTime: string;
  endTime: string;
  room: string;
  mode: "stream" | "wave";
  slotMinutes: number;
  waveCapacity: number;
}

export function defaultsFor(session: ConsultSession | null, room: string): SessionDefaults {
  return {
    id: session?.id ?? "",
    label: session?.label ?? "",
    kind: session?.onDate ? "once" : "recurring",
    onDate: session?.onDate ?? "",
    startDate: session?.startDate ?? "",
    endDate: session?.endDate ?? "",
    weekdays: session?.weekdays ?? [1, 2, 3, 4, 5],
    startTime: session?.startTime ?? "09:00",
    endTime: session?.endTime ?? "12:00",
    room: session?.room ?? room,
    mode: session?.mode ?? "stream",
    slotMinutes: session?.slotMinutes ?? 20,
    waveCapacity: session?.waveCapacity ?? 6,
  };
}

/** Monday (1) to Saturday (6) for a clinic day, null on Sunday. Mirrors the clinic's booking week. */
function clinicDay(date: string): number | null {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day >= 1 && day <= 6 ? day : null;
}

function plusDays(date: string, days: number): string {
  const at = new Date(`${date}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() + days);
  return at.toISOString().slice(0, 10);
}

/** Why a new session cannot be added on `date`, or null when it can (Mon–Sat, today or later). */
export function addBlockedReason(date: string, today: string): string | null {
  if (date < today) return "This day has passed. Pick today or a later day to add a session.";
  if (clinicDay(date) === null) return "The clinic doesn't run on Sundays. Pick a day from Monday to Saturday.";
  return null;
}

/**
 * Turning "Recurring" on: a one-off draft becomes weekly from its own date and on its own weekday
 * (the old draft weekdays came from whichever day the draft was first opened on). A saved weekly
 * session that was briefly switched to one-off gets its own days and dates back.
 */
export function toRecurringDraft<T extends Pick<SessionDefaults, "kind" | "onDate" | "startDate" | "endDate" | "weekdays">>(
  draft: T,
  fallbackDate: string,
  saved: Pick<ConsultSession, "onDate" | "weekdays" | "startDate" | "endDate"> | null = null,
): T {
  if (saved && !saved.onDate) {
    return { ...draft, kind: "recurring", weekdays: [...saved.weekdays], startDate: saved.startDate ?? "", endDate: saved.endDate ?? "" };
  }
  const base = draft.onDate || draft.startDate || fallbackDate;
  const day = clinicDay(base);
  const weekdays = day ? [day] : draft.weekdays.length > 0 ? [...draft.weekdays] : [1, 2, 3, 4, 5];
  const endDate = draft.endDate && draft.endDate >= base ? draft.endDate : plusDays(base, 84);
  return { ...draft, kind: "recurring", weekdays, startDate: base, endDate };
}
