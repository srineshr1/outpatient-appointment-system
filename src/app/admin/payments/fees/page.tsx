import type { Metadata } from "next";
import { isClosedStatus } from "@/lib/clinic-types";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminTitle } from "@/components/admin/AdminTitle";
import { TABS } from "@/components/admin/nav";
import { Money, Panel, TableWrap, Td, Th, tableClass, tbodyClass, theadClass } from "@/components/admin/ui";
import { loadSnapshot, navCounts, param, type SearchParams } from "@/lib/admin-data";
import { noticeText } from "@/lib/admin-notices";
import { requireAdminPage } from "@/lib/admin-page";
import { feeTable } from "@/lib/fees";

export const metadata: Metadata = { title: "Fees" };

export default async function FeesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const admin = await requireAdminPage("/admin/payments/fees");
  const query = await searchParams;
  const snapshot = await loadSnapshot();
  const counts = navCounts(snapshot);
  const tabs = (TABS.payments ?? []).map((tab) => (tab.href === "/admin/payments/invoices" ? { ...tab, count: counts.payments } : tab));
  const booked = (reasonId: string) =>
    snapshot.visits.filter((row) => row.visit.reasonId === reasonId && !isClosedStatus(row.visit.status) && row.charge).length;

  return (
    <AdminShell
      admin={admin}
      section="payments"
      crumb="Fees"
      tabs={tabs}
      activeTab="/admin/payments/fees"
      counts={counts}
      notice={noticeText(param(query, "done"))}
    >
      <AdminTitle title="Fees" today={snapshot.today} description="What each kind of visit costs. A visit keeps the fee it was booked at." />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TableWrap label="Fee for each kind of visit">
            <table className={tableClass}>
              <caption className="sr-only">Fee for each kind of visit</caption>
              <thead className={theadClass}>
                <tr>
                  <Th>Visit</Th>
                  <Th align="right">Length</Th>
                  <Th align="right">Fee</Th>
                  <Th align="right">Booked with a fee</Th>
                </tr>
              </thead>
              <tbody className={tbodyClass}>
                {feeTable().map(({ reason, pence }) => (
                  <tr key={reason.id}>
                    <Td className="font-medium">{reason.label}</Td>
                    <Td align="right">{reason.minutes} min</Td>
                    <Td align="right" className="font-medium">
                      <Money pence={pence} />
                    </Td>
                    <Td align="right">{booked(reason.id)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
          <p className="mt-3 text-[13px] text-muted">
            These are the practice’s fees for each reason. A doctor can set their own flat fee on their profile, and that fee is what is charged. Changes affect new bookings only.
          </p>
        </div>

        <Panel id="how" title="How payments work here">
          <ul className="grid list-disc gap-2 pl-5 text-sm text-ink-2">
            <li>When patients book, they choose to pay now online or pay at the desk. Online places are held for a few minutes while they pay.</li>
            <li>The desk records card or cash payments on the visit’s page, in full or in part.</li>
            <li>Cancelling a visit starts a refund of an online payment under the refund policy; it shows as completed once the provider confirms. Money taken at the desk shows as “Refund due” until someone records the refund.</li>
            <li>A fee can be waived with a reason, and every change is written to the activity log.</li>
          </ul>
        </Panel>
      </div>
    </AdminShell>
  );
}
