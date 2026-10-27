import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { VisitList } from "@/components/clinic/VisitList";
import { PageHeading } from "@/components/shell/PageHeading";
import { Notice } from "@/components/ui/Card";
import { todayIso, now } from "@/lib/clock";
import { doctors } from "@/lib/data";
import { getCurrentUser } from "@/lib/session";
import { visitsFor } from "@/lib/visits";

export const metadata: Metadata = {
  title: "Clinic book",
  robots: { index: false },
};

const notices: Record<string, string> = {
  unavailable: "That visit can’t be changed.",
  missing: "That visit is no longer on the book.",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ doctor?: string | string[]; notice?: string | string[] }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/dashboard");
  if (user.role === "patient") redirect("/appointments");

  const query = await searchParams;
  const requested = typeof query.doctor === "string" ? query.doctor : "";
  const filter = user.role === "reception" && doctors.some((doctor) => doctor.id === requested) ? requested : "";
  const noticeKey = typeof query.notice === "string" ? query.notice : "";
  const notice = notices[noticeKey];
  const visits = (await visitsFor(user)).filter((visit) => (filter ? visit.doctorId === filter : true));
  const today = todayIso(now());
  const returnTo = filter ? `/dashboard?doctor=${filter}` : "/dashboard";
  const doctor = user.doctorId ? doctors.find((item) => item.id === user.doctorId) : null;

  return (
    <div className="mx-auto max-w-page px-5 pt-8 pb-20 md:px-8 md:pt-12">
      <PageHeading className="text-title2 font-semibold text-ink md:text-title1">Clinic book</PageHeading>
      <p className="mt-2 max-w-prose text-body text-ink-2">
        Signed in as {user.name}
        {doctor ? `, ${doctor.room}` : ""}. Visits patients book show up here. This session runs until{" "}
        <time dateTime={user.expiresAt} className="tabular">
          {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(
            new Date(user.expiresAt),
          )}
        </time>
        .
      </p>
      {user.role === "reception" ? (
        <nav aria-label="Filter by doctor" className="mt-5 flex flex-wrap gap-2">
          <FilterLink href="/dashboard" current={!filter}>
            All doctors
          </FilterLink>
          {doctors.map((item) => (
            <FilterLink key={item.id} href={`/dashboard?doctor=${item.id}`} current={filter === item.id}>
              {item.short}
            </FilterLink>
          ))}
        </nav>
      ) : null}
      {notice ? (
        <Notice tone="danger" role="alert" className="mt-6">
          {notice}
        </Notice>
      ) : null}
      <VisitList visits={visits} today={today} mode="clinic" returnTo={returnTo} />
    </div>
  );
}

function FilterLink({ href, current, children }: { href: string; current: boolean; children: string }) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={`inline-flex min-h-11 items-center rounded-full px-4 text-callout font-medium ${
        current ? "bg-accent text-white" : "bg-fill text-ink hover:bg-fill-strong"
      }`}
    >
      {children}
    </Link>
  );
}
