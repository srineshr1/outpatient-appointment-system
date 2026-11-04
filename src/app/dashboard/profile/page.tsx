import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DoctorProfileForm } from "@/components/profile/ProfileForms";
import { PageHeading } from "@/components/shell/PageHeading";
import { Notice } from "@/components/ui/Card";
import { readDoctorProfile } from "@/lib/profiles";
import { getCurrentUser } from "@/lib/session";
import { getStore } from "@/lib/store";

export const metadata: Metadata = { title: "Your profile", robots: { index: false } };

export default async function DoctorProfilePage({ searchParams }: { searchParams: Promise<{ welcome?: string; saved?: string }> }) {
  const [user, query] = await Promise.all([getCurrentUser(), searchParams]);
  if (!user) redirect("/sign-in?as=staff&next=/dashboard/profile");
  if (user.role !== "doctor" || user.doctorId !== user.id) redirect("/dashboard");
  const record = await (await getStore()).getProfile(user.id);
  const profile = readDoctorProfile(record);
  const welcome = query.welcome === "1";

  return (
    <div className="mx-auto max-w-3xl px-5 pt-8 pb-20 md:px-8 md:pt-12">
      <Link href="/dashboard" className="-ml-2 inline-flex min-h-11 items-center rounded-full pr-3 pl-2 text-body text-accent hover:bg-accent-soft">
        Clinic book
      </Link>
      <PageHeading className="mt-2 text-title2 font-semibold text-ink md:text-title1">
        {welcome ? "Welcome. Tell patients about you" : "Your profile"}
      </PageHeading>
      <p className="mt-2 max-w-prose text-body text-ink-2">
        {welcome
          ? "Step 1 of 2. Patients see this when they choose a doctor. Next you set up your consulting sessions."
          : "Patients see this on your doctor page. You can change it whenever you like."}
      </p>
      {query.saved === "1" ? (
        <Notice tone="success" role="status" className="mt-6">
          Profile saved.
        </Notice>
      ) : null}
      <DoctorProfileForm
        welcome={welcome}
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
    </div>
  );
}
