import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { NotificationPrefsForm } from "@/components/profile/NotificationPrefsForm";
import { PageHeading } from "@/components/shell/PageHeading";
import { Notice } from "@/components/ui/Card";
import { getDoctorPrefs } from "@/lib/notifications/doctor-prefs";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Email notifications", robots: { index: false } };

export default async function DoctorNotificationsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const [user, query] = await Promise.all([getCurrentUser(), searchParams]);
  if (!user) redirect("/sign-in?as=staff&next=/dashboard/notifications");
  if (user.role !== "doctor") redirect("/dashboard");
  const prefs = await getDoctorPrefs(user.id);

  return (
    <div className="mx-auto max-w-3xl px-5 pt-8 pb-20 md:px-8 md:pt-12">
      <Link href="/dashboard" className="-ml-2 inline-flex min-h-11 items-center rounded-full pr-3 pl-2 text-body text-accent hover:bg-accent-soft">
        Clinic book
      </Link>
      <PageHeading className="mt-2 text-title2 font-semibold text-ink md:text-title1">Email notifications</PageHeading>
      <p className="mt-2 max-w-prose text-body text-ink-2">
        Choose which emails we send to {user.email}. Everything is on until you switch it off.
      </p>
      {query.saved === "1" ? (
        <Notice tone="success" role="status" className="mt-6">
          Preferences saved.
        </Notice>
      ) : null}
      <NotificationPrefsForm initial={prefs} />
    </div>
  );
}
