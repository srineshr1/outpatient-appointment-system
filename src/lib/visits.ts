import { actorOf, recordEvent, visitSummary } from "./audit";
import { settleCancelledVisit } from "./billing";
import type { AppointmentRecord, AppointmentStatus, PublicUser } from "./clinic-types";
import { forgetBlockedSlots } from "./blocked-slots";
import { getStore } from "./store";

export type VisitChange = "ok" | "missing" | "forbidden" | "closed";

export function sortVisits(visits: readonly AppointmentRecord[]): AppointmentRecord[] {
  return [...visits].sort((a, b) => (a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)));
}

/** Reception and admins see every doctor's book. */
export function seesWholeBook(user: Pick<PublicUser, "role">): boolean {
  return user.role === "reception" || user.role === "admin";
}

export async function visitsFor(user: PublicUser): Promise<AppointmentRecord[]> {
  const store = await getStore();
  // Ask the store for just this person's book rather than reading every visit and filtering here.
  if (seesWholeBook(user)) return sortVisits(await store.listAppointments());
  if (user.role === "doctor") {
    if (!user.doctorId) return [];
    return sortVisits(await store.listAppointments({ doctorId: user.doctorId }));
  }
  return sortVisits(await store.listAppointments({ patientUserId: user.id }));
}

export async function changeAppointmentStatus(
  actor: PublicUser,
  id: string,
  status: Extract<AppointmentStatus, "completed" | "cancelled">,
  reason = "",
): Promise<VisitChange> {
  const store = await getStore();
  const visit = await store.getAppointment(id);
  if (!visit) return "missing";
  if (visit.status !== "booked") return "closed";

  const owns = actor.id === visit.patientUserId;
  const doctor = actor.role === "doctor" && actor.doctorId === visit.doctorId;
  const desk = seesWholeBook(actor);
  if (status === "completed" && !(doctor || desk)) return "forbidden";
  if (status === "cancelled" && !(owns || doctor || desk)) return "forbidden";

  await store.updateStatus(id, status);
  forgetBlockedSlots();
  const who = actorOf(actor);
  await recordEvent({
    actor: who,
    action: status === "cancelled" ? "appointment.cancelled" : "appointment.completed",
    subjectType: "appointment",
    subjectId: visit.id,
    summary: visitSummary(visit),
    reason: reason.trim().slice(0, 200),
  });
  if (status === "cancelled") {
    await settleCancelledVisit(visit, who).catch((error: unknown) => {
      console.error(`[billing] Could not refund ${visit.reference}: ${error instanceof Error ? error.message : "unknown error"}`);
    });
  }
  return "ok";
}
