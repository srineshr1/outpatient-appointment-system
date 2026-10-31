import type { ConsultSession } from "@/lib/clinic-types";

export interface SessionDefaults {
  id: string;
  label: string;
  weekdays: number[];
  startTime: string;
  endTime: string;
  room: string;
  mode: "stream" | "wave";
  slotMinutes: number;
  waveMinutes: number;
  waveCapacity: number;
}

export function defaultsFor(session: ConsultSession | null, room: string): SessionDefaults {
  return {
    id: session?.id ?? "",
    label: session?.label ?? "",
    weekdays: session?.weekdays ?? [1, 2, 3, 4, 5],
    startTime: session?.startTime ?? "09:00",
    endTime: session?.endTime ?? "12:00",
    room: session?.room ?? room,
    mode: session?.mode ?? "stream",
    slotMinutes: session?.slotMinutes ?? 20,
    waveMinutes: session?.waveMinutes ?? 60,
    waveCapacity: session?.waveCapacity ?? 6,
  };
}
