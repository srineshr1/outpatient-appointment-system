import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DoctorNotificationsWorkspace } from "@/components/dashboard/DoctorNotificationsWorkspace";
import { getDoctorPrefs } from "@/lib/notifications/doctor-prefs";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Email notifications", robots: { index: false } };

export default async function DoctorNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const [user, query] = await Promise.all([getCurrentUser(), searchParams]);
  if (!user) redirect("/sign-in?as=staff&next=/dashboard/notifications");
  if (user.role !== "doctor") redirect("/dashboard");

  const prefs = await getDoctorPrefs(user.id);
  const saved = query.saved === "1";

  return (
    <DoctorNotificationsWorkspace
      initial={prefs}
      email={user.email}
      saved={saved}
    />
  );
}
