import { PRACTICE_TZ } from "@/lib/clock";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { VisitList } from "@/components/clinic/VisitList";
import { PageHeading } from "@/components/shell/PageHeading";
import { Notice } from "@/components/ui/Card";
import { todayIso, now } from "@/lib/clock";
import { getCurrentUser } from "@/lib/session";
import { paymentLabels } from "@/lib/billing";
import { formatShortDate } from "@/lib/format";
import { rebookPath } from "@/lib/rebooking";
import { getStore } from "@/lib/store";
import { reschedulesFor, visitsFor } from "@/lib/visits";

export const metadata: Metadata = {
  title: "Your appointments",
  robots: { index: false },
};

const notices: Record<string, string> = {
  unavailable: "That visit can’t be changed.",
  missing: "That visit is no longer on the book.",
  moved: "Visit moved. The other side has been told by email.",
};

export default async function AppointmentsPage({ searchParams }: { searchParams: Promise<{ notice?: string | string[] }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/appointments");
  const query = await searchParams;
  const noticeKey = typeof query.notice === "string" ? query.notice : "";
  const notice = notices[noticeKey];
  const all = visitsFor({ ...user, role: "patient", doctorId: null });
  const [visits, payments, moves] = await Promise.all([all, paymentLabels(all), reschedulesFor({ ...user, role: "patient", doctorId: null })]);
  const today = todayIso(now());
  // Visits the doctor moved off removed hours that still need an answer: link straight to the offer.
  const displaced = visits.filter((visit) => visit.status === "displaced");
  const store = displaced.length > 0 ? await getStore() : null;
  const open = store
    ? (await Promise.all(displaced.map(async (visit) => ({ visit, offer: (await store.listRebookingOffers({ appointmentId: visit.id, status: "pending" }))[0] }))))
        .filter((item) => item.offer)
    : [];

  return (
    <div className="mx-auto max-w-page px-5 pt-8 pb-20 md:px-8 md:pt-12">
      <PageHeading className="text-title2 font-semibold text-zinc-50 md:text-title1">Your appointments</PageHeading>
      <p className="mt-2 max-w-prose text-body text-zinc-300">
        Signed in as {user.name}. This session runs until{" "}
        <time dateTime={user.expiresAt} className="tabular text-zinc-100">
          {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: PRACTICE_TZ }).format(
            new Date(user.expiresAt),
          )}
        </time>
        .
      </p>
      <p className="mt-3 text-callout text-zinc-400">
        <Link href="/book" className="text-cyan-300 hover:underline underline-offset-4">
          Book a time
        </Link>
        {" "}
        ·{" "}
        <Link href="/payments" className="text-cyan-300 hover:underline underline-offset-4">
          Payments and refunds
        </Link>
        {user.role !== "patient" ? (
          <>
            {" "}
            ·{" "}
            <Link href="/dashboard" className="text-cyan-300 hover:underline underline-offset-4">
              Clinic book
            </Link>
          </>
        ) : null}
      </p>
      {notice ? (
        <Notice tone={noticeKey === "moved" ? "success" : "danger"} role={noticeKey === "moved" ? "status" : "alert"} className="mt-6">
          {notice}
        </Notice>
      ) : null}
      {open.map(({ visit, offer }) => (
        <Notice key={visit.id} tone="info" className="mt-6">
          Your doctor changed their hours, so your visit on {formatShortDate(visit.date)}, {visit.time} ({visit.reference}) needs a new time.{" "}
          <Link href={rebookPath(offer!.id)} className="font-medium text-cyan-300 underline underline-offset-4">
            Pick a new time or cancel for a refund
          </Link>
        </Notice>
      ))}
      <VisitList visits={visits} today={today} mode="patient" returnTo="/appointments" payments={payments} moves={moves} />
    </div>
  );
}
