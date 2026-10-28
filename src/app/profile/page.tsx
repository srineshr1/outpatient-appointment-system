import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PatientProfileForm } from "@/components/profile/ProfileForms";
import { PageHeading } from "@/components/shell/PageHeading";
import { Notice } from "@/components/ui/Card";
import { now, todayIso } from "@/lib/clock";
import { readPatientProfile } from "@/lib/profiles";
import { getCurrentUser, safeNext } from "@/lib/session";
import { getStore } from "@/lib/store";

export const metadata: Metadata = { title: "Your profile", robots: { index: false } };

export default async function PatientProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; saved?: string; next?: string | string[] }>;
}) {
  const query = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/profile");
  if (user.role === "doctor" && user.doctorId === user.id) redirect("/dashboard/profile");
  if (user.role !== "patient") redirect("/dashboard");
  const profile = readPatientProfile(await (await getStore()).getProfile(user.id));
  const welcome = query.welcome === "1";
  const next = safeNext(typeof query.next === "string" ? query.next : "/");

  return (
    <div className="mx-auto max-w-3xl px-5 pt-8 pb-20 md:px-8 md:pt-12">
      {welcome ? null : (
        <Link href="/appointments" className="-ml-2 inline-flex min-h-11 items-center rounded-full pr-3 pl-2 text-body text-accent hover:bg-accent-soft">
          Your visits
        </Link>
      )}
      <PageHeading className="mt-2 text-title2 font-semibold text-ink md:text-title1">
        {welcome ? "Welcome. A few details about you" : "Your profile"}
      </PageHeading>
      <p className="mt-2 max-w-prose text-body text-ink-2">
        {welcome
          ? "We use these to fill in your bookings and text you if the clinic runs late. You can change them any time."
          : `Signed in as ${user.email}. These fill in your bookings for you.`}
      </p>
      {query.saved === "1" ? (
        <Notice tone="success" role="status" className="mt-6">
          Profile saved.
        </Notice>
      ) : null}
      <PatientProfileForm
        welcome={welcome}
        next={next}
        today={todayIso(now())}
        initial={{ name: user.name, mobile: user.mobile, dob: user.dob, gender: profile.gender }}
      />
    </div>
  );
}
