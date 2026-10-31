import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PayButton } from "@/components/payments/PayButton";
import { PageHeading } from "@/components/shell/PageHeading";
import { buttonClass } from "@/components/ui/button-styles";
import { Card, Notice } from "@/components/ui/Card";
import { findDoctor } from "@/lib/data";
import { formatMoney } from "@/lib/fees";
import { formatShortDate } from "@/lib/format";
import { getOps } from "@/lib/ops";
import { onlinePaymentsAvailable } from "@/lib/payments/index";
import { releaseExpiredHolds } from "@/lib/payments/holds";
import { resolveFee } from "@/lib/payments/fees";
import { getCurrentUser } from "@/lib/session";
import { getStore } from "@/lib/store";

export const metadata: Metadata = { title: "Pay for your visit", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function PayPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ start?: string }> }) {
  const { id } = await params;
  const { start } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(`/pay/${id}`)}`);
  await releaseExpiredHolds();
  const visit = await (await getStore()).getAppointment(id);
  if (!visit || visit.patientUserId !== user.id) notFound();
  const payment = await (await getOps()).getPaymentByAppointment(visit.id);
  const amount = payment?.amountMinor ?? (await resolveFee(visit.doctorId, visit.reasonId).catch(() => 0));
  const doctor = findDoctor(visit.doctorId)?.name ?? "your doctor";
  const when = `${formatShortDate(visit.date)}, ${visit.time}`;

  let body: React.ReactNode;
  if (visit.status === "booked" && payment?.status === "captured") {
    body = (
      <>
        <Notice tone="success" role="status">
          Payment received. Your appointment is confirmed, and we have emailed you the details.
        </Notice>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={`/receipt/${payment.id}`} className={buttonClass("primary", "md")}>
            View receipt
          </Link>
          <Link href="/appointments" className={buttonClass("secondary", "md")}>
            Your appointments
          </Link>
        </div>
      </>
    );
  } else if (visit.status === "pending_payment") {
    body = !onlinePaymentsAvailable() ? (
      <Notice tone="info">
        Online payment isn’t switched on yet, so this place can’t be paid for here. Give it up and book again choosing to pay at the desk.
      </Notice>
    ) : (
      <PayButton visitId={visit.id} holdExpiresAt={payment?.holdExpiresAt ?? null} amountLabel={formatMoney(amount)} autoStart={start === "1"} />
    );
  } else if (visit.status === "expired") {
    body = (
      <>
        <Notice tone="danger" role="alert">
          The time to pay ran out, so this place was released for other patients. Nothing was charged. If a payment did go through, it is
          confirmed if the place is still free, and refunded in full if not.
        </Notice>
        <div className="mt-6">
          <Link href={`/doctors/${visit.doctorId}`} className={buttonClass("primary", "md")}>
            Book a new time
          </Link>
        </div>
      </>
    );
  } else {
    body = (
      <Notice tone="info">
        This visit is {visit.status === "cancelled" ? "cancelled" : visit.status === "completed" ? "complete" : "booked"}, so there is nothing to pay here.{" "}
        <Link href="/appointments" className="text-accent hover:underline underline-offset-4">
          Your appointments
        </Link>
      </Notice>
    );
  }

  return (
    <div className="mx-auto max-w-page px-5 pt-8 pb-20 md:px-8 md:pt-12">
      <PageHeading className="text-title2 font-semibold text-ink md:text-title1">Pay for your visit</PageHeading>
      <Card className="mt-6 max-w-xl p-5 md:p-6">
        <dl className="grid gap-3 text-body">
          <div>
            <dt className="text-callout text-muted">Visit</dt>
            <dd className="text-ink">
              {doctor} · <span className="tabular">{when}</span>
            </dd>
          </div>
          <div>
            <dt className="text-callout text-muted">Reference</dt>
            <dd className="tabular text-ink">{visit.reference}</dd>
          </div>
          <div>
            <dt className="text-callout text-muted">Consultation fee</dt>
            <dd className="tabular text-ink">{formatMoney(amount)}</dd>
          </div>
        </dl>
      </Card>
      <div className="mt-6 max-w-xl">{body}</div>
    </div>
  );
}
