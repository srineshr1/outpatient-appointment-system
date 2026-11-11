import { PRACTICE_TZ, practiceWallClock } from "@/lib/clock";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { VisitList } from "@/components/clinic/VisitList";
import { DoctorSchedule } from "@/components/doctors/DoctorSchedule";
import { toScheduleVisit } from "@/components/doctors/schedule-model";
import { DisplacedPatients } from "@/components/profile/DisplacedPatients";
import { PageHeading } from "@/components/shell/PageHeading";
import { buttonClass } from "@/components/ui/button-styles";
import { Notice } from "@/components/ui/Card";
import { todayIso, now } from "@/lib/clock";
import { findDoctor, allDoctors, reasons } from "@/lib/data";
import { doctorStatus, type DoctorStatus } from "@/lib/doctor-status";
import { loadDoctors } from "@/lib/doctors";
import { readDoctorProfile } from "@/lib/profiles";
import { getCurrentUser } from "@/lib/session";
import { getStore } from "@/lib/store";
import { paymentLabels } from "@/lib/billing";
import { displacedFor } from "@/lib/rebooking";
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
  const ownBook = user.role === "doctor" && user.doctorId === user.id;
  const [everyVisit, payments, moves, displaced] = await Promise.all([
    all,
    paymentLabels(all),
    reschedulesFor(user),
    ownBook ? displacedFor(user.id) : Promise.resolve([]),
  ]);
  const visits = everyVisit.filter((visit) => (filter ? visit.doctorId === filter : true));
  const today = todayIso(now());
  const returnTo = filter ? `/dashboard?doctor=${filter}` : "/dashboard";
  const doctor = user.doctorId ? findDoctor(user.doctorId) : null;
  const showSchedule = user.role === "doctor" && Boolean(user.doctorId);
  const schedule = showSchedule && user.doctorId ? await loadSchedule(user.doctorId, user.id) : null;
  const wall = practiceWallClock(now());

  return (
    <div className={showSchedule ? "pb-20" : `mx-auto px-5 pt-8 pb-20 md:px-8 md:pt-12 ${user.role === "doctor" ? "max-w-[92rem] xl:px-10" : "max-w-page"}`}>
      {schedule ? (
        <DoctorSchedule
          doctorName={user.name}
          doctorId={user.doctorId!}
          today={today}
          nowMinutes={wall.hour * 60 + wall.minute}
          sessions={schedule.sessions}
          visits={everyVisit.map((visit) => toScheduleVisit(visit, reasons.find((reason) => reason.id === visit.reasonId)?.label ?? "Appointment"))}
          trims={schedule.trims}
          room={schedule.room}
          editable={false}
          returnTo={returnTo}
          editHref={ownBook ? "/dashboard/sessions" : null}
        />
      ) : null}
      <div className={showSchedule ? "mx-auto max-w-[92rem] px-5 pt-8 md:px-8 xl:px-10" : undefined}>
      {showSchedule ? (
        <h2 className="text-title2 font-semibold text-ink md:text-title1">Clinic book</h2>
      ) : (
        <PageHeading className="text-title2 font-semibold text-ink md:text-title1">Clinic book</PageHeading>
      )}
      <p className="mt-2 max-w-prose text-body text-ink-2">
        Signed in as {user.name}
        {doctor ? `, ${doctor.room}` : ""}. Visits patients book show up here. This session runs until{" "}
        <time dateTime={user.expiresAt} className="tabular">
          {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: PRACTICE_TZ }).format(
            new Date(user.expiresAt),
          )}
        </time>
        .
      </p>
      {user.role === "doctor" ? (
        <p className="mt-3 text-callout">
          <Link href="/dashboard/notifications" className="text-accent hover:underline underline-offset-4">
            Email notifications
          </Link>{" "}
          choose which emails you get about bookings, changes and your daily schedule.
        </p>
      ) : null}
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
      <DisplacedPatients entries={displaced.filter((entry) => entry.status === "pending")} />
      <VisitList visits={visits} today={today} mode="clinic" returnTo={returnTo} payments={payments} moves={moves} />
      </div>
    </div>
  );
}

async function loadSchedule(doctorId: string, accountId: string) {
  const store = await getStore();
  const [sessions, trims, record] = await Promise.all([
    store.listConsultSessions(doctorId),
    store.listSessionTrims(doctorId),
    store.getProfile(accountId),
  ]);
  return {
    sessions: sessions.filter((session) => !session.archivedAt),
    trims,
    room: readDoctorProfile(record).room || findDoctor(doctorId)?.room || "Clinic",
  };
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
