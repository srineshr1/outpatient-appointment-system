import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DetailsView } from "@/components/details/DetailsView";
import { PageHeading } from "@/components/shell/PageHeading";
import { buttonClass } from "@/components/ui/button-styles";
import { Notice } from "@/components/ui/Card";
import { now, mondayOf } from "@/lib/clock";
import type { Slot } from "@/lib/data";
import { onlinePaymentsAvailable } from "@/lib/payments/index";
import { getDoctors, getSlot } from "@/lib/repository";
import { slotStatus } from "@/lib/schedule";
import { getCurrentUser } from "@/lib/session";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { signOutAction } from "@/server/auth-actions";

export const metadata: Metadata = {
  title: "Your details",
  robots: { index: false },
};

type Query = { slot?: string | string[] };

const GONE: Record<string, string> = {
  past: "That time has passed or closed for online booking.",
  taken: "That time has just been taken.",
  teaching: "That time isn’t open for booking.",
};

export default async function DetailsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  // A link to one time (from the clinic assistant): /book/details?slot=<id>.
  const slotParam = typeof query.slot === "string" ? query.slot.trim().slice(0, 200) : "";
  const here = slotParam ? `/book/details?slot=${encodeURIComponent(slotParam)}` : "/book/details";
  const [doctors, user] = await Promise.all([getDoctors(), getCurrentUser()]);
  // Booking needs a patient account. The held time waits in sessionStorage meanwhile.
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(here)}`);

  if (user.role !== "patient") {
    return (
      <div className="mx-auto max-w-page px-5 pt-8 pb-20 md:px-8 md:pt-12">
        <PageHeading className="text-title2 font-semibold text-ink md:text-title1">Patients book here</PageHeading>
        <Notice tone="info" className="mt-6 max-w-prose">
          You’re signed in as {user.name}, a clinic staff account. Staff can’t book a visit for themselves online. Sign out,
          then sign in with a patient account to book this time.
        </Notice>
        <form action={signOutAction} className="mt-6">
          <input type="hidden" name="next" value="/sign-in?next=%2Fbook%2Fdetails" />
          <SignOutButton className={buttonClass("primary", "lg")}>Sign out and switch account</SignOutButton>
        </form>
      </div>
    );
  }

  let linkedSlot: Slot | null = null;
  if (slotParam) {
    const slot = await getSlot(slotParam);
    const status = slot ? slotStatus(slot, [], now()) : "missing";
    const doctor = slot ? doctors.find((item) => item.id === slot.doctorId) : undefined;
    if (!slot || status !== "open" || !doctor) {
      const back = slot && doctor ? `/doctors/${doctor.id}?week=${mondayOf(slot.date)}` : "/book";
      return (
        <div className="mx-auto max-w-page px-5 pt-8 pb-20 md:px-8 md:pt-12">
          <PageHeading className="text-title2 font-semibold text-ink md:text-title1">That time isn’t available</PageHeading>
          <Notice tone="info" className="mt-6 max-w-prose">
            {GONE[status] ?? "That time is no longer on the book."} Nothing has been booked. Pick another time
            {doctor ? ` with ${doctor.short}` : ""}, or ask the clinic assistant for the next free one.
          </Notice>
          <a href={back} className={`${buttonClass("primary", "lg")} mt-6`}>
            {doctor ? `See ${doctor.short}’s times` : "Choose a doctor"}
          </a>
        </div>
      );
    }
    linkedSlot = slot;
  }

  return (
    <DetailsView
      linkedSlot={linkedSlot}
      doctors={doctors}
      account={{ name: user.name, dob: user.dob, mobile: user.mobile, email: user.email }}
      onlinePayments={onlinePaymentsAvailable()}
    />
  );
}
