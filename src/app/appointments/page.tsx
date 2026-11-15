import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PatientPortal } from "@/components/patient/PatientPortal";
import { Notice } from "@/components/ui/Card";
import { now, todayIso } from "@/lib/clock";
import { getCurrentUser } from "@/lib/session";
import { paymentLabels } from "@/lib/billing";
import { getStore } from "@/lib/store";
import { reschedulesFor, visitsFor } from "@/lib/visits";
import { getPatientMedicalData } from "@/lib/patient-reports";
import { rebookPath } from "@/lib/rebooking";
import type { RebookingOffer } from "@/lib/clinic-types";

export const metadata: Metadata = {
  title: "Patient Health Hub · Westbrook Medical Practice",
  description: "View appointments, diagnostic reports, prescriptions, and health metrics.",
  robots: { index: false },
};

const notices: Record<string, string> = {
  unavailable: "That visit can’t be changed.",
  missing: "That visit is no longer on the book.",
  moved: "Visit moved. The other side has been told by email.",
};

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string | string[] }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/appointments");

  const query = await searchParams;
  const noticeKey = typeof query.notice === "string" ? query.notice : "";
  const notice = notices[noticeKey];

  const all = visitsFor({ ...user, role: "patient", doctorId: null });
  const [visits, payments, moves] = await Promise.all([
    all,
    paymentLabels(all),
    reschedulesFor({ ...user, role: "patient", doctorId: null }),
  ]);
  const today = todayIso(now());

  // Visits the doctor moved off removed hours that still need an answer: link straight to the offer.
  const displaced = visits.filter((visit) => visit.status === "displaced");
  const store = displaced.length > 0 ? await getStore() : null;
  const open: { visit: (typeof visits)[number]; offer: RebookingOffer; href: string }[] = store
    ? (
        await Promise.all(
          displaced.map(async (visit) => {
            const offer = (await store.listRebookingOffers({ appointmentId: visit.id, status: "pending" }))[0] ?? null;
            return {
              visit,
              offer,
              href: offer ? rebookPath(offer.id) : "",
            };
          }),
        )
      ).filter((item): item is { visit: (typeof visits)[number]; offer: RebookingOffer; href: string } => Boolean(item.offer && item.href))
    : [];

  const noticeSlot = notice ? (
    <Notice
      tone={noticeKey === "moved" ? "success" : "danger"}
      role={noticeKey === "moved" ? "status" : "alert"}
      className="mt-6"
    >
      {notice}
    </Notice>
  ) : null;

  const medicalData = getPatientMedicalData(user);

  return (
    <PatientPortal
      user={user}
      visits={visits}
      today={today}
      payments={payments}
      moves={moves}
      openOffers={open}
      noticeSlot={noticeSlot}
      medicalData={medicalData}
    />
  );
}
