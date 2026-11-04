import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DoctorDirectory } from "@/components/directory/DoctorDirectory";
import { DoctorPortrait } from "@/components/doctors/DoctorPortrait";
import { PageHeading } from "@/components/shell/PageHeading";
import { todayIso, now } from "@/lib/clock";
import { findDoctor } from "@/lib/data";
import { formatWhen } from "@/lib/format";
import { getDoctors, getUpcoming } from "@/lib/repository";
import { getCurrentUser } from "@/lib/session";
import { visitsFor } from "@/lib/visits";

export const metadata: Metadata = {
  title: "Book a doctor",
  robots: { index: false },
};

/**
 * The signed-in patient's home: pick a doctor. The greeting stays pinned with the search and
 * filters; the intro and the next visit scroll away with the doctor cards.
 */
export default async function BookPage() {
  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent("/book")}`);
  if (user.role !== "patient") redirect("/dashboard");

  const [doctors, upcoming, visits] = await Promise.all([getDoctors(), getUpcoming(), visitsFor(user)]);
  const today = todayIso(now());
  const nextVisit = visits.find((visit) => visit.status === "booked" && visit.date >= today) ?? null;
  const nextDoctor = nextVisit ? findDoctor(nextVisit.doctorId) : null;
  const firstName = user.name.trim().split(/\s+/)[0] ?? user.name;

  return (
    <div className="pb-20">
      <DoctorDirectory
        doctors={doctors}
        upcoming={upcoming}
        labelledBy="book-title"
        heading={
          <PageHeading id="book-title" className="text-title3 font-bold text-ink md:text-title2">
            Hi {firstName}, who would you like to see?
          </PageHeading>
        }
        lead={
          <>
            <p className="max-w-prose text-body text-ink-2">
              Choose a doctor, then pick a time. You can book up to four weeks ahead.
            </p>
            {nextVisit && nextDoctor ? (
              <div className="flex flex-wrap items-center gap-4 rounded-sheet bg-surface p-4 shadow-card md:p-5">
                <DoctorPortrait doctor={nextDoctor} size={48} />
                <p className="min-w-0 flex-1 text-callout text-ink-2">
                  <span className="block font-bold text-ink">Your next visit</span>
                  <span className="tabular">
                    {nextDoctor.short} · {formatWhen(nextVisit, today)} · {nextVisit.reference}
                  </span>
                </p>
                <Link href="/appointments" className="btn-chunky btn-chunky-secondary w-full sm:w-auto">
                  Your appointments
                </Link>
              </div>
            ) : null}
          </>
        }
      />
    </div>
  );
}
