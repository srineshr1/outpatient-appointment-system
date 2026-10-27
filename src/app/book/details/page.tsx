import type { Metadata } from "next";
import { DetailsView } from "@/components/details/DetailsView";
import { getDoctors } from "@/lib/repository";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Your details",
  robots: { index: false },
};

export default async function DetailsPage() {
  const [doctors, user] = await Promise.all([getDoctors(), getCurrentUser()]);
  return (
    <DetailsView
      doctors={doctors}
      account={user ? { name: user.name, dob: user.dob, mobile: user.mobile, email: user.email } : null}
    />
  );
}
