import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { VisitList } from "@/components/clinic/VisitList";
import { PageHeading } from "@/components/shell/PageHeading";
import { Notice } from "@/components/ui/Card";
import { todayIso, now } from "@/lib/clock";
import { getCurrentUser } from "@/lib/session";
import { paymentLabels } from "@/lib/billing";
import { visitsFor } from "@/lib/visits";

export const metadata: Metadata = {
  title: "Your appointments",
  robots: { index: false },
};

const notices: Record<string, string> = {
  unavailable: "That visit can’t be changed.",
  missing: "That visit is no longer on the book.",
};

export default async function AppointmentsPage({ searchParams }: { searchParams: Promise<{ notice?: string | string[] }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/appointments");
  const query = await searchParams;
  const noticeKey = typeof query.notice === "string" ? query.notice : "";
  const notice = notices[noticeKey];
  const visits = await visitsFor({ ...user, role: "patient", doctorId: null });
  const payments = await paymentLabels(visits);
  const today = todayIso(now());

  return (
    <div className="mx-auto max-w-page px-5 pt-8 pb-20 md:px-8 md:pt-12">
      <PageHeading className="text-title2 font-semibold text-ink md:text-title1">Your appointments</PageHeading>
      <p className="mt-2 max-w-prose text-body text-ink-2">
        Signed in as {user.name}. This session runs until{" "}
        <time dateTime={user.expiresAt} className="tabular">
          {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(
            new Date(user.expiresAt),
          )}
        </time>
        .
      </p>
      <p className="mt-3 text-callout">
        <Link href="/book" className="text-accent hover:underline underline-offset-4">
          Book a time
        </Link>
        {user.role !== "patient" ? (
          <>
            {" "}
            ·{" "}
            <Link href="/dashboard" className="text-accent hover:underline underline-offset-4">
              Clinic book
            </Link>
          </>
        ) : null}
      </p>
      {notice ? (
        <Notice tone="danger" role="alert" className="mt-6">
          {notice}
        </Notice>
      ) : null}
      <VisitList visits={visits} today={today} mode="patient" returnTo="/appointments" payments={payments} />
    </div>
  );
}
