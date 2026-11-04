import type { Metadata } from "next";
import { ConfirmedView } from "@/components/confirmed/ConfirmedView";
import { getDoctors } from "@/lib/repository";

export const metadata: Metadata = {
  title: "You’re booked",
  robots: { index: false },
};

export default async function ConfirmedPage() {
  const doctors = await getDoctors();
  return <ConfirmedView doctors={doctors} />;
}
