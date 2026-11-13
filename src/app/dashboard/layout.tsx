import type { ReactNode } from "react";
import { DoctorDock, type DoctorDockCounts } from "@/components/dashboard/DoctorDock";
import { now, todayIso } from "@/lib/clock";
import { displacedFor } from "@/lib/rebooking";
import { getCurrentUser } from "@/lib/session";
import { getStore } from "@/lib/store";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  const isOwnDoctor = Boolean(user && user.role === "doctor" && user.doctorId === user.id);

  let counts: DoctorDockCounts | null = null;
  if (isOwnDoctor && user) {
    try {
      const store = await getStore();
      const today = todayIso(now());
      const [visits, sessions, displaced] = await Promise.all([
        store.listAppointments({ doctorId: user.id }),
        store.listConsultSessions(user.id),
        displacedFor(user.id),
      ]);
      counts = {
        todayVisits: visits.filter((visit) => visit.date === today && visit.status === "booked").length,
        activeSessions: sessions.filter((session) => !session.archivedAt).length,
        pendingAlerts: displaced.filter((entry) => entry.status === "pending").length,
      };
    } catch {
      counts = { todayVisits: 0, activeSessions: 0, pendingAlerts: 0 };
    }
  }

  return (
    <div className={counts ? "pb-24 sm:pb-28" : undefined}>
      {children}
      {counts ? <DoctorDock counts={counts} /> : null}
    </div>
  );
}
