import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DoctorProfileWorkspace } from "@/components/dashboard/DoctorProfileWorkspace";
import { doctorStatus } from "@/lib/doctor-status";
import { missingDoctorFields, readDoctorProfile } from "@/lib/profiles";
import { getCurrentUser } from "@/lib/session";
import { getStore } from "@/lib/store";

export const metadata: Metadata = { title: "Your profile", robots: { index: false } };

export default async function DoctorProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; saved?: string }>;
}) {
  const [user, query] = await Promise.all([getCurrentUser(), searchParams]);
  if (!user) redirect("/sign-in?as=staff&next=/dashboard/profile");
  if (user.role !== "doctor" || user.doctorId !== user.id) redirect("/dashboard");

  const store = await getStore();
  const [record, status] = await Promise.all([
    store.getProfile(user.id),
    doctorStatus(store, user),
  ]);
  const profile = readDoctorProfile(record);
  const missing = missingDoctorFields(user.name, profile);
  const welcome = query.welcome === "1";
  const saved = query.saved === "1";

  return (
    <DoctorProfileWorkspace
      welcome={welcome}
      saved={saved}
      visible={status.visible}
      missingCount={missing.length}
      sessionsCount={status.sessions.length}
      initial={{
        name: user.name,
        specialty: profile.specialty,
        qualification: profile.qualification,
        years: profile.years === null ? "" : String(profile.years),
        room: profile.room,
        fee: profile.feePence ? (profile.feePence / 100).toFixed(2).replace(/\.00$/, "") : "",
        bio: profile.bio,
        languages: profile.languages.join(", "),
      }}
    />
  );
}
