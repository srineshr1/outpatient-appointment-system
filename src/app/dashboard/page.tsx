import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { VisitList } from "@/components/clinic/VisitList";
import { PageHeading } from "@/components/shell/PageHeading";
import { buttonClass } from "@/components/ui/button-styles";
import { Notice } from "@/components/ui/Card";
import { todayIso, now } from "@/lib/clock";
import { findDoctor, allDoctors } from "@/lib/data";
import { doctorStatus, type DoctorStatus } from "@/lib/doctor-status";
import { loadDoctors } from "@/lib/doctors";
import { getCurrentUser } from "@/lib/session";
import { getStore } from "@/lib/store";
import { paymentLabels } from "@/lib/billing";
import { reschedulesFor, seesWholeBook, visitsFor } from "@/lib/visits";

export const metadata: Metadata = {
  title: "Clinic book",
  robots: { index: false },
};

const notices: Record<string, string> = {
  unavailable: "That visit can’t be changed.",
  missing: "That visit is no longer on the book.",
  moved: "Visit moved. The other side has been told by email.",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ doctor?: string | string[]; notice?: string | string[] }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?as=staff&next=/dashboard");
  if (user.role === "patient") redirect("/appointments");

  const query = await searchParams;
  await loadDoctors();
  const setup = user.role === "doctor" && user.doctorId === user.id ? await doctorStatus(await getStore(), user) : null;
  const requested = typeof query.doctor === "string" ? query.doctor : "";
  const wholeBook = seesWholeBook(user);
  const filter = wholeBook && Boolean(findDoctor(requested)) ? requested : "";
  const noticeKey = typeof query.notice === "string" ? query.notice : "";
  const notice = notices[noticeKey];
  const all = visitsFor(user);
  const [everyVisit, payments, moves] = await Promise.all([all, paymentLabels(all), reschedulesFor(user)]);
  const visits = everyVisit.filter((visit) => (filter ? visit.doctorId === filter : true));
  const today = todayIso(now());
  const returnTo = filter ? `/dashboard?doctor=${filter}` : "/dashboard";
  const doctor = user.doctorId ? findDoctor(user.doctorId) : null;

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
      {user.role === "admin" ? (
        <p className="mt-3 text-callout">
          <Link href="/admin" className="text-accent hover:underline underline-offset-4">
            Open the admin console
          </Link>{" "}
          for payments, people and activity.
        </p>
      ) : null}
      {wholeBook ? (
        <nav aria-label="Filter by doctor" className="mt-5 flex flex-wrap gap-2">
          <FilterLink href="/dashboard" current={!filter}>
            All doctors
          </FilterLink>
          {allDoctors().map((item) => (
            <FilterLink key={item.id} href={`/dashboard?doctor=${item.id}`} current={filter === item.id}>
              {item.short}
            </FilterLink>
          ))}
        </nav>
      ) : null}
      {setup ? <SetupChecklist status={setup} /> : null}
      {notice ? (
        <Notice tone={noticeKey === "moved" ? "success" : "danger"} role={noticeKey === "moved" ? "status" : "alert"} className="mt-6">
          {notice}
        </Notice>
      ) : null}
      <VisitList visits={visits} today={today} mode="clinic" returnTo={returnTo} payments={payments} moves={moves} />
    </div>
  );
}

function SetupChecklist({ status }: { status: DoctorStatus }) {
  if (status.visible) {
    return (
      <Notice tone="success" role="status" className="mt-6">
        Patients can find and book you. Change your{" "}
        <Link href="/dashboard/profile" className="underline underline-offset-4">
          profile
        </Link>{" "}
        or{" "}
        <Link href="/dashboard/sessions" className="underline underline-offset-4">
          consulting sessions
        </Link>{" "}
        any time.
      </Notice>
    );
  }
  return (
    <section aria-labelledby="finish-profile" className="mt-6 rounded-card bg-surface p-5 shadow-card md:p-6">
      <h2 id="finish-profile" className="text-title3 font-semibold text-ink">
        Finish your profile to appear to patients
      </h2>
      <p className="mt-1 text-callout text-ink-2">Patients can’t see or book you until both steps are done.</p>
      <ol className="mt-4 grid gap-3">
        {status.steps.map((step, index) => (
          <li key={step.id} className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-caption font-semibold ${
                step.done ? "bg-accent text-white" : "bg-fill text-ink-2"
              }`}
            >
              {step.done ? "✓" : index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-body font-medium text-ink">
                {step.label}
                <span className="sr-only">{step.done ? " (done)" : " (still to do)"}</span>
              </p>
              {step.detail ? <p className="text-callout text-ink-2">{step.detail}</p> : null}
            </div>
            {step.done ? null : (
              <Link href={step.href} className={buttonClass("primary", "md")}>
                {step.id === "profile" ? "Finish profile" : "Add session"}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
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
