import type { AppointmentRecord, AppointmentStatus, PublicUser } from "./clinic-types";
import { getStore } from "./store";

export type VisitChange = "ok" | "missing" | "forbidden" | "closed";

export function sortVisits(visits: readonly AppointmentRecord[]): AppointmentRecord[] {
  return [...visits].sort((a, b) => (a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)));
}

export async function visitsFor(user: PublicUser): Promise<AppointmentRecord[]> {
  const all = sortVisits(await (await getStore()).listAppointments());
  if (user.role === "reception") return all;
  if (user.role === "doctor") return all.filter((visit) => visit.doctorId === user.doctorId);
  return all.filter((visit) => visit.patientUserId === user.id);
}

export async function changeAppointmentStatus(
  actor: PublicUser,
  id: string,
  status: Extract<AppointmentStatus, "completed" | "cancelled">,
): Promise<VisitChange> {
  const store = await getStore();
  const visit = await store.getAppointment(id);
  if (!visit) return "missing";
  if (visit.status !== "booked") return "closed";

  const owns = actor.id === visit.patientUserId;
  const doctor = actor.role === "doctor" && actor.doctorId === visit.doctorId;
  const reception = actor.role === "reception";
  if (status === "completed" && !(doctor || reception)) return "forbidden";
  if (status === "cancelled" && !(owns || doctor || reception)) return "forbidden";

  await store.updateStatus(id, status);
  return "ok";
}
