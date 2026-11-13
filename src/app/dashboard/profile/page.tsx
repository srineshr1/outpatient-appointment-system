import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DoctorProfileWorkspace } from "@/components/dashboard/DoctorProfileWorkspace";
import { doctorStatus } from "@/lib/doctor-status";
import { getOps } from "@/lib/ops";
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
  const [record, status, charged] = await Promise.all([
    store.getProfile(user.id),
    doctorStatus(store, user),
    // The fee patients are charged lives in its own table, where 0 means free of charge.
    getOps().then((ops) => ops.getDoctorFee(user.id)).catch(() => null),
  ]);
  const profile = readDoctorProfile(record);
  const feePence = charged ? charged.feeMinor : profile.feePence;
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
        fee: feePence === null ? "" : (feePence / 100).toFixed(2).replace(/\.00$/, ""),
        bio: profile.bio,
        languages: profile.languages.join(", "),
      }}
    />
  );
}
