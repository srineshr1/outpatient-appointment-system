import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DetailsView } from "@/components/details/DetailsView";
import { PageHeading } from "@/components/shell/PageHeading";
import { buttonClass } from "@/components/ui/button-styles";
import { Notice } from "@/components/ui/Card";
import { getDoctors } from "@/lib/repository";
import { getCurrentUser } from "@/lib/session";
import { signOutAction } from "@/server/auth-actions";

export const metadata: Metadata = {
  title: "Your details",
  robots: { index: false },
};

export default async function DetailsPage() {
  const [doctors, user] = await Promise.all([getDoctors(), getCurrentUser()]);
  // Booking needs a patient account. The held time waits in sessionStorage meanwhile.
  if (!user) redirect(`/sign-in?next=${encodeURIComponent("/book/details")}`);

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
          <button type="submit" className={buttonClass("primary", "lg")}>
            Sign out and switch account
          </button>
        </form>
      </div>
    );
  }

  return (
    <DetailsView doctors={doctors} account={{ name: user.name, dob: user.dob, mobile: user.mobile, email: user.email }} />
  );
}
