import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeading } from "@/components/shell/PageHeading";
import { Card } from "@/components/ui/Card";
import { findDoctor } from "@/lib/data";
import { formatMoney } from "@/lib/fees";
import { formatShortDate } from "@/lib/format";
import { paymentHistory, refundStatusLabel } from "@/lib/payments/summary";
import { getCurrentUser } from "@/lib/session";
import { visitsFor } from "@/lib/visits";

export const metadata: Metadata = { title: "Payments and refunds", robots: { index: false } };
export const dynamic = "force-dynamic";

function paidOn(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(iso)) + " IST";
}

export default async function PaymentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/payments");
  const items = await paymentHistory(await visitsFor({ ...user, role: "patient", doctorId: null }));

  return (
    <div className="mx-auto max-w-page px-5 pt-8 pb-20 md:px-8 md:pt-12">
      <PageHeading className="text-title2 font-semibold text-ink md:text-title1">Payments and refunds</PageHeading>
      <p className="mt-2 max-w-prose text-body text-ink-2">
        What you have paid online, any refunds and where they are. A refund shows as pending until your bank confirms it, which usually takes
        5 to 7 working days.
      </p>
      {items.length === 0 ? (
        <p className="mt-8 max-w-prose text-body text-ink-2">
          No online payments yet. Visits paid at the desk are recorded by the practice.{" "}
          <Link href="/appointments" className="text-accent hover:underline underline-offset-4">
            Your appointments
          </Link>
        </p>
      ) : (
        <ul className="mt-8 grid max-w-2xl gap-3">
          {items.map(({ payment, visit, refunds }) => (
            <li key={payment.id}>
              <Card className="p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-body font-semibold text-ink">{findDoctor(visit.doctorId)?.name ?? "Your doctor"}</h2>
                  <p className="tabular text-body font-semibold text-ink">{formatMoney(payment.amountMinor)}</p>
                </div>
                <p className="mt-1 text-callout text-ink-2">
                  <span className="tabular">
                    {formatShortDate(visit.date)}, {visit.time}
                  </span>{" "}
                  · Reference <span className="tabular text-ink">{visit.reference}</span>
                  {visit.status === "cancelled" ? " · Cancelled" : ""}
                </p>
                <p className="mt-1 text-callout text-muted">
                  Paid {paidOn(payment.paidAt)}
                  {payment.method ? ` by ${payment.method}` : ""}
                </p>
                {refunds.length > 0 ? (
                  <ul className="mt-3 grid gap-1 border-t border-hairline pt-3 text-callout text-ink-2">
                    {refunds.map((refund) => (
                      <li key={refund.id}>
                        {refundStatusLabel(refund)}
                        {refund.reason ? <span className="block text-muted">{refund.reason}</span> : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <p className="mt-3 text-callout">
                  <Link href={`/receipt/${payment.id}`} className="text-accent hover:underline underline-offset-4">
                    View receipt
                  </Link>
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
