import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PrintButton } from "@/components/payments/PrintButton";
import { findDoctor, practice, reasons } from "@/lib/data";
import { formatMoney } from "@/lib/fees";
import { formatShortDate } from "@/lib/format";
import { getOps } from "@/lib/ops";
import { refundStatusLabel } from "@/lib/payments/summary";
import { getCurrentUser } from "@/lib/session";
import { getStore } from "@/lib/store";

export const metadata: Metadata = { title: "Receipt", robots: { index: false } };
export const dynamic = "force-dynamic";

function stamp(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(iso)) + " IST";
}

/** A printable receipt for an online payment. Only the patient who paid (or clinic staff) can open it. */
export default async function ReceiptPage({ params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(`/receipt/${paymentId}`)}`);
  const ops = await getOps();
  const payment = await ops.getPayment(paymentId);
  if (!payment || payment.status !== "captured") notFound();
  const visit = await (await getStore()).getAppointment(payment.appointmentId);
  if (!visit) notFound();
  const staff = user.role === "admin" || user.role === "reception";
  if (!staff && visit.patientUserId !== user.id) notFound();
  const refunds = await ops.listRefunds({ paymentId: payment.id });
  const reason = reasons.find((item) => item.id === visit.reasonId)?.label ?? "Appointment";
  const refunded = refunds.filter((refund) => refund.status === "processed").reduce((sum, refund) => sum + refund.amountMinor, 0);

  return (
    <div className="mx-auto max-w-2xl px-5 pt-8 pb-20 md:px-8 md:pt-12 print:max-w-none print:p-0">
      <article className="rounded-card bg-surface p-6 shadow-card print:rounded-none print:shadow-none md:p-8" aria-labelledby="receipt-title">
        <p className="text-callout font-semibold text-muted">{practice.name}</p>
        <h1 id="receipt-title" className="mt-1 text-title2 font-semibold text-ink">
          Payment receipt
        </h1>
        <p className="mt-1 text-callout text-muted">{practice.address}</p>

        <dl className="mt-6 grid gap-3 text-body sm:grid-cols-2">
          <Row term="Receipt number" value={payment.id.slice(0, 8).toUpperCase()} />
          <Row term="Paid on" value={stamp(payment.paidAt)} />
          <Row term="Patient" value={visit.patientName} />
          <Row term="Booking reference" value={visit.reference} />
          <Row term="Visit" value={`${findDoctor(visit.doctorId)?.name ?? "Doctor"} · ${formatShortDate(visit.date)}, ${visit.time}`} />
          <Row term="For" value={reason} />
          <Row term="Payment method" value={payment.method || "Online"} />
          <Row term="Payment reference" value={payment.providerPaymentId ?? ""} />
        </dl>

        <div className="mt-6 flex items-baseline justify-between border-t border-hairline pt-4">
          <p className="text-body font-semibold text-ink">Amount paid</p>
          <p className="tabular text-title3 font-semibold text-ink">{formatMoney(payment.amountMinor)}</p>
        </div>
        {refunds.length > 0 ? (
          <div className="mt-4 border-t border-hairline pt-4">
            <p className="text-body font-semibold text-ink">Refunds</p>
            <ul className="mt-2 grid gap-1 text-callout text-ink-2">
              {refunds.map((refund) => (
                <li key={refund.id}>{refundStatusLabel(refund)}</li>
              ))}
            </ul>
            {refunded > 0 ? <p className="mt-2 text-callout text-ink-2">Refunded so far: {formatMoney(refunded)}</p> : null}
          </div>
        ) : null}
        <p className="mt-6 text-caption text-muted">Amounts are in Indian rupees. Keep this receipt for your records.</p>
      </article>
      <div className="mt-6 print:hidden">
        <PrintButton />
      </div>
    </div>
  );
}

function Row({ term, value }: { term: string; value: string }) {
  return (
    <div>
      <dt className="text-callout text-muted">{term}</dt>
      <dd className="tabular break-words text-ink">{value || "—"}</dd>
    </div>
  );
}
