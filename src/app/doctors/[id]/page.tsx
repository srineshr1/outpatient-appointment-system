import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ScheduleView } from "@/components/schedule/ScheduleView";
import { isIsoDate, now } from "@/lib/clock";
import { clampWeek, nextOpening } from "@/lib/schedule";
import { getDoctor, getSlots, getWindow } from "@/lib/repository";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ week?: string | string[] }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const doctor = await getDoctor(id);
  if (!doctor) return { title: "Doctor not found" };
  return {
    title: `Choose a time with ${doctor.name}`,
    description: `See open GP appointments with ${doctor.name} (${doctor.interest}) and book online.`,
  };
}

export default async function DoctorPage({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const doctor = await getDoctor(id);
  if (!doctor) notFound();

  const [slots, window] = await Promise.all([getSlots(doctor.id), getWindow()]);
  const requested = typeof query.week === "string" && isIsoDate(query.week) ? query.week : null;
  const firstOpen = nextOpening(slots, doctor.id, [], now());
  const initialWeek = clampWeek(requested, window, firstOpen?.date);

  return <ScheduleView doctor={doctor} slots={slots} initialWeek={initialWeek} />;
}
