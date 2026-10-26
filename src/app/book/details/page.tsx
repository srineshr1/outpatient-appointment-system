import type { Metadata } from "next";
import { DetailsView } from "@/components/details/DetailsView";
import { getDoctors } from "@/lib/repository";

export const metadata: Metadata = {
  title: "Your details",
  robots: { index: false },
};

export default async function DetailsPage() {
  const doctors = await getDoctors();
  return <DetailsView doctors={doctors} />;
}
