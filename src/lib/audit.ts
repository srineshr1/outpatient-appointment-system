/**
 * The activity log: who did what, and when. Events are append-only. Writing one never
 * blocks the action it describes: if the store is down, the action still happens and
 * the failure is reported to the server log (without the event's details).
 */
import { after } from "next/server";
import type { ActorRole, AppointmentRecord, AuditEvent, PublicUser } from "./clinic-types";
import { now } from "./clock";
import { practice, findDoctor } from "./data";
import { formatShortDate } from "./format";
import { getStore } from "./store";

export interface Actor {
  id: string | null;
  name: string;
  role: ActorRole;
}

export const SYSTEM_ACTOR: Actor = { id: null, name: `${practice.shortName} (automatic)`, role: "system" };

export function actorOf(user: Pick<PublicUser, "id" | "name" | "role">): Actor {
  return { id: user.id, name: user.name, role: user.role };
}

/** Someone signing in who has no account yet, or whose account we won't name. */
export function anonymousActor(email: string): Actor {
  return { id: null, name: email, role: "anonymous" };
}

export interface NewEvent {
  actor: Actor;
  action: string;
  subjectType?: AuditEvent["subjectType"];
  subjectId?: string | null;
  summary: string;
  reason?: string;
}

function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

export async function recordEvent(input: NewEvent): Promise<void> {
  const event: AuditEvent = {
    id: crypto.randomUUID(),
    at: now().toISOString(),
    action: input.action,
    actorId: input.actor.id,
    actorName: clip(input.actor.name, 120) || "Unknown",
    actorRole: input.actor.role,
    subjectType: input.subjectType ?? null,
    subjectId: input.subjectId ?? null,
    summary: clip(input.summary, 300),
    reason: clip(input.reason ?? "", 300),
  };
  try {
    await (await getStore()).appendEvent(event);
  } catch (error) {
    console.error(`[activity] Could not record ${event.action}: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

/**
 * Record an event after the response has gone out, so the person isn't waiting on the log write.
 * Outside a request (unit tests, scripts) there is no "after the response", so it is written now.
 */
export function recordEventSoon(input: NewEvent): Promise<void> {
  try {
    after(() => recordEvent(input));
    return Promise.resolve();
  } catch {
    return recordEvent(input);
  }
}

/** "Ann Lee · Dr Cho · Thu 29 Oct, 09:40 · HSP-482913". No CHI, mobile or notes. */
export function visitSummary(visit: Pick<AppointmentRecord, "patientName" | "doctorId" | "date" | "time" | "reference">): string {
  const doctor = findDoctor(visit.doctorId)?.short ?? "Unknown doctor";
  return `${visit.patientName} · ${doctor} · ${formatShortDate(visit.date)}, ${visit.time} · ${visit.reference}`;
}
