import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ClinicBookView } from "@/components/dashboard/ClinicBookView";
import { DisplacedPatients } from "@/components/profile/DisplacedPatients";
import { Notice } from "@/components/ui/Card";
import { paymentLabels } from "@/lib/billing";
import { now, PRACTICE_TZ, todayIso } from "@/lib/clock";
import { allDoctors, findDoctor } from "@/lib/data";
import { doctorStatus } from "@/lib/doctor-status";
import { loadDoctors } from "@/lib/doctors";
import { getOps } from "@/lib/ops";
import type { InboxItem } from "@/lib/ops/types";
import { displacedFor } from "@/lib/rebooking";
import { getCurrentUser } from "@/lib/session";
import { getStore } from "@/lib/store";
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

async function safeInbox(userId: string): Promise<InboxItem[]> {
  try {
    return await (await getOps()).listInbox(userId, { limit: 8 });
  } catch {
    return [];
  }
}

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
  const store = await getStore();
  const ownBook = user.role === "doctor" && user.doctorId === user.id;
  const setup = ownBook ? await doctorStatus(store, user) : null;
  const requested = typeof query.doctor === "string" ? query.doctor : "";
  const wholeBook = seesWholeBook(user);
  const filter = wholeBook && Boolean(findDoctor(requested)) ? requested : "";
  const noticeKey = typeof query.notice === "string" ? query.notice : "";
  const notice = notices[noticeKey];
  const all = visitsFor(user);

  const [everyVisit, payments, moves, displaced, trims, inboxItems] = await Promise.all([
    all,
    paymentLabels(all),
    reschedulesFor(user),
    ownBook ? displacedFor(user.id) : Promise.resolve([]),
    ownBook ? store.listSessionTrims(user.id) : Promise.resolve([]),
    safeInbox(user.id),
  ]);

  const visits = everyVisit.filter((visit) => (filter ? visit.doctorId === filter : true));
  const today = todayIso(now());
  const returnTo = filter ? `/dashboard?doctor=${filter}` : "/dashboard";
  const doctor = user.doctorId ? findDoctor(user.doctorId) : null;
  const room = doctor?.room ?? user.doctorRoom ?? null;
  const expiresLabel = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: PRACTICE_TZ,
  }).format(new Date(user.expiresAt));

  const doctorOptions = wholeBook
    ? allDoctors().map((item) => ({ id: item.id, short: item.short, name: item.name }))
    : [];
  const doctorNames: Record<string, string> = {};
  for (const visit of visits) {
    if (!doctorNames[visit.doctorId]) {
      doctorNames[visit.doctorId] = findDoctor(visit.doctorId)?.name ?? "Your doctor";
    }
  }

  const pendingDisplaced = displaced.filter((entry) => entry.status === "pending");

  const noticeSlot = notice ? (
    noticeKey === "moved" ? (
      <output className="mt-6 block">
        <Notice tone="success">{notice}</Notice>
      </output>
    ) : (
      <Notice tone="danger" role="alert" className="mt-6">
        {notice}
      </Notice>
    )
  ) : null;

  const displacedSlot =
    pendingDisplaced.length > 0 ? <DisplacedPatients entries={pendingDisplaced} /> : null;

  return (
    <ClinicBookView
      key={filter || "all"}
      userName={user.name}
      userRole={user.role}
      room={room}
      expiresAt={user.expiresAt}
      expiresLabel={expiresLabel}
      setup={setup}
      sessions={setup?.sessions ?? []}
      trims={trims}
      inboxItems={inboxItems}
      wholeBook={wholeBook}
      filterDoctorId={filter}
      doctorOptions={doctorOptions}
      doctorNames={doctorNames}
      visits={visits}
      today={today}
      returnTo={returnTo}
      payments={payments}
      moves={moves}
      pendingDisplacedCount={pendingDisplaced.length}
      noticeSlot={noticeSlot}
      displacedSlot={displacedSlot}
    />
  );
}
