import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/admin/ActionForm";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminTitle } from "@/components/admin/AdminTitle";
import { EventTable } from "@/components/admin/tables";
import {
  AdminField,
  Badge,
  Facts,
  Money,
  Panel,
  PaymentBadge,
  StatusBadge,
  TableWrap,
  Td,
  Th,
  adminButton,
  inputClass,
  tableClass,
  tbodyClass,
  textareaClass,
  theadClass,
} from "@/components/admin/ui";
import { loadSnapshot, navCounts, param, type SearchParams } from "@/lib/admin-data";
import { instantLabel, slotLabel } from "@/lib/admin-format";
import { noticeText } from "@/lib/admin-notices";
import { requireAdminPage } from "@/lib/admin-page";
import { REASON_LIMIT } from "@/lib/billing";
import { addMinutes } from "@/lib/clock";
import { reasons } from "@/lib/data";
import { feeFor, formatMoney, penceToInput } from "@/lib/fees";
import { ageLabel, formatPhone } from "@/lib/format";
import { METHOD_LABELS, refundableByMethod } from "@/lib/payments";
import {
  addFeeAction,
  recordPaymentAction,
  refundAction,
  restoreFeeAction,
  visitStatusAction,
  waiveFeeAction,
} from "@/server/admin-actions";

export const metadata: Metadata = { title: "Visit" };

export default async function VisitPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { id } = await params;
  const path = `/admin/appointments/${id}`;
  const admin = await requireAdminPage(path);
  const query = await searchParams;
  const snapshot = await loadSnapshot();
  const row = snapshot.visitsById.get(id);
  if (!row) notFound();

  const { visit, charge, money, patient } = row;
  const { today } = snapshot;
  const minutes = reasons.find((reason) => reason.id === visit.reasonId)?.minutes ?? 10;
  const refundable = charge ? [...refundableByMethod(charge.entries)] : [];
  const canPay = Boolean(charge) && visit.status !== "cancelled" && !charge?.waiver && money.duePence > 0;
  const canWaive = Boolean(charge) && visit.status !== "cancelled" && !charge?.waiver && money.netPence <= 0 && (charge?.amountPence ?? 0) > 0;
  const events = snapshot.events.filter((event) => event.subjectType === "appointment" && event.subjectId === visit.id);
  const bookedEvent = events.find((event) => event.action === "appointment.booked");

  return (
    <AdminShell
      admin={admin}
      section="appointments"
      crumb={visit.reference}
      counts={navCounts(snapshot)}
      notice={noticeText(param(query, "done"))}
    >
      <AdminTitle
        title={visit.patientName}
        today={today}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={visit.status} />
            <PaymentBadge state={money.state} />
            <span className="tabular-nums">
              {visit.reference} · {row.doctorName} · {slotLabel(visit.date, visit.time, today)}
            </span>
          </span>
        }
        actions={
          <Link href="/admin/appointments" className={adminButton("secondary")}>
            All appointments
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="grid content-start gap-6 lg:col-span-2">
          <Panel id="visit" title="Visit">
            <Facts
              items={[
                { term: "Doctor", value: row.doctorName },
                {
                  term: "When",
                  value: (
                    <span className="tabular-nums">
                      {slotLabel(visit.date, visit.time, today)}–{addMinutes(visit.time, minutes)}
                    </span>
                  ),
                },
                { term: "Reason", value: row.reasonLabel },
                { term: "Reference", value: <span className="tabular-nums">{visit.reference}</span> },
                { term: "Booked", value: `${instantLabel(visit.createdAt, today)}${bookedEvent ? ` by ${bookedEvent.actorName}` : ""}` },
                { term: "Status", value: <StatusBadge status={visit.status} /> },
                { term: "Note for the doctor", value: visit.note ? <span className="whitespace-pre-line">{visit.note}</span> : "None" },
              ]}
            />
          </Panel>

          <Panel id="patient" title="Patient">
            <Facts
              items={[
                { term: "Name", value: visit.patientName },
                { term: "Date of birth", value: visit.patientDob ? `${visit.patientDob} · ${ageLabel(visit.patientDob, today)}` : "Not given" },
                { term: "Mobile", value: visit.patientMobile ? <span className="tabular-nums">{formatPhone(visit.patientMobile)}</span> : "Not given" },
                { term: "CHI number", value: visit.patientChi ? <span className="tabular-nums">{visit.patientChi}</span> : "Not given" },
                {
                  term: "Account",
                  value: patient ? (
                    <Link href={`/admin/people/${patient.id}`} className="text-accent hover:underline underline-offset-4">
                      {patient.email}
                    </Link>
                  ) : (
                    "No account linked"
                  ),
                },
              ]}
            />
          </Panel>

          <Panel id="payment" title="Payment" description="Demo payments: no card is charged and no money moves.">
            {charge ? (
              <>
                <Facts
                  items={[
                    { term: "Fee", value: <Money pence={charge.amountPence} /> },
                    { term: "State", value: <PaymentBadge state={money.state} /> },
                    { term: "Paid", value: <Money pence={money.paidPence} /> },
                    { term: "Refunded", value: <Money pence={money.refundedPence} /> },
                    {
                      term: money.refundDuePence > 0 ? "To give back" : "Still owed",
                      value: <Money pence={money.refundDuePence > 0 ? money.refundDuePence : money.duePence} />,
                    },
                    {
                      term: "Waiver",
                      value: charge.waiver ? `Waived by ${charge.waiver.byName}, ${instantLabel(charge.waiver.at, today)}: ${charge.waiver.reason}` : "None",
                    },
                  ]}
                />
                <h3 className="mt-6 mb-2 text-sm font-semibold text-ink">Payments and refunds</h3>
                {charge.entries.length === 0 ? (
                  <p className="text-sm text-muted">Nothing paid yet.</p>
                ) : (
                  <TableWrap label="Payments and refunds for this visit">
                    <table className={tableClass}>
                      <thead className={theadClass}>
                        <tr>
                          <Th>When</Th>
                          <Th>Type</Th>
                          <Th>Method</Th>
                          <Th align="right">Amount</Th>
                          <Th>By</Th>
                        </tr>
                      </thead>
                      <tbody className={tbodyClass}>
                        {[...charge.entries].reverse().map((entry) => (
                          <tr key={entry.id}>
                            <Td className="whitespace-nowrap tabular-nums">{instantLabel(entry.at, today)}</Td>
                            <Td>
                              {entry.kind === "payment" ? <Badge tone="success">Payment</Badge> : <Badge tone="info">Refund</Badge>}
                              {entry.note ? <span className="mt-1 block text-[13px] text-muted">{entry.note}</span> : null}
                            </Td>
                            <Td className="whitespace-nowrap">{METHOD_LABELS[entry.method]}</Td>
                            <Td align="right" className={entry.kind === "refund" ? "text-[#a51c22]" : ""}>
                              <Money pence={entry.kind === "refund" ? -entry.amountPence : entry.amountPence} />
                            </Td>
                            <Td className="whitespace-nowrap">{entry.byName || "—"}</Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </TableWrap>
                )}
              </>
            ) : (
              <div className="grid gap-3">
                <p className="text-sm text-ink-2">
                  No fee is recorded. This visit was booked before fees started, so nothing is owed unless you add one.
                </p>
                {visit.status !== "cancelled" ? (
                  <ActionForm action={addFeeAction}>
                    <input type="hidden" name="appointmentId" value={visit.id} />
                    <input type="hidden" name="return" value={path} />
                    <SubmitButton variant="secondary" pendingLabel="Adding…">
                      Add the {formatMoney(feeFor(visit.reasonId))} fee
                    </SubmitButton>
                  </ActionForm>
                ) : null}
              </div>
            )}
          </Panel>

          <section aria-labelledby="visit-activity" className="grid gap-3">
            <h2 id="visit-activity" className="text-lg font-semibold text-ink">
              Activity on this visit
            </h2>
            <EventTable events={events} today={today} label="Activity on this visit" empty="Nothing recorded yet." />
          </section>
        </div>

        <div className="grid content-start gap-6">
          {visit.status === "booked" ? (
            <Panel id="visit-actions" title="Visit">
              <ActionForm action={visitStatusAction} className="border-b border-hairline pb-4">
                <input type="hidden" name="id" value={visit.id} />
                <input type="hidden" name="status" value="completed" />
                <input type="hidden" name="return" value={path} />
                <p className="mb-3 text-sm text-ink-2">After the patient has been seen.</p>
                <SubmitButton variant="secondary">Mark complete</SubmitButton>
              </ActionForm>
              <ActionForm action={visitStatusAction} errorId="cancel-error" className="pt-4">
                <input type="hidden" name="id" value={visit.id} />
                <input type="hidden" name="status" value="cancelled" />
                <input type="hidden" name="return" value={path} />
                <AdminField id="cancel-reason" label="Reason for cancelling" hint="Goes in the activity log. The time is freed straight away.">
                  <textarea
                    id="cancel-reason"
                    name="reason"
                    required
                    maxLength={REASON_LIMIT}
                    aria-describedby="cancel-reason-hint"
                    className={textareaClass}
                  />
                </AdminField>
                <SubmitButton variant="danger" pendingLabel="Cancelling…" className="mt-3">
                  Cancel visit
                </SubmitButton>
              </ActionForm>
            </Panel>
          ) : (
            <Panel id="visit-actions" title="Visit">
              <p className="text-sm text-ink-2">
                This visit is {visit.status}. It can’t be changed, but payments can still be refunded.
              </p>
            </Panel>
          )}

          {canPay ? (
            <Panel id="take-payment" title="Take a payment" description={`${formatMoney(money.duePence)} still owed.`}>
              <ActionForm action={recordPaymentAction}>
                <input type="hidden" name="appointmentId" value={visit.id} />
                <input type="hidden" name="return" value={path} />
                <fieldset>
                  <legend className="text-sm font-medium text-ink">Paid by</legend>
                  <div className="mt-2 grid gap-1">
                    {(["desk_card", "cash"] as const).map((method, index) => (
                      <label key={method} className="flex min-h-9 items-center gap-2 text-sm text-ink">
                        <input type="radio" name="method" value={method} defaultChecked={index === 0} className="size-4 accent-accent" />
                        {METHOD_LABELS[method]}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <AdminField id="pay-amount" label="Amount (£)" className="mt-3">
                  <input
                    id="pay-amount"
                    name="amount"
                    inputMode="decimal"
                    autoComplete="off"
                    defaultValue={penceToInput(money.duePence)}
                    className={`${inputClass} max-w-40 tabular-nums`}
                  />
                </AdminField>
                <SubmitButton pendingLabel="Recording…" className="mt-3">
                  Record payment
                </SubmitButton>
              </ActionForm>
            </Panel>
          ) : null}

          {refundable.length > 0 ? (
            <Panel
              id="refund"
              title="Give a refund"
              description={money.refundDuePence > 0 ? `${formatMoney(money.refundDuePence)} should go back.` : "Money goes back the way it was paid."}
            >
              <ActionForm action={refundAction}>
                <input type="hidden" name="appointmentId" value={visit.id} />
                <input type="hidden" name="return" value={path} />
                <AdminField id="refund-method" label="Back to">
                  <select id="refund-method" name="method" className={inputClass}>
                    {refundable.map(([method, pence]) => (
                      <option key={method} value={method}>
                        {`${METHOD_LABELS[method]}, up to ${formatMoney(pence)}`}
                      </option>
                    ))}
                  </select>
                </AdminField>
                <AdminField id="refund-amount" label="Amount (£)" className="mt-3">
                  <input
                    id="refund-amount"
                    name="amount"
                    inputMode="decimal"
                    autoComplete="off"
                    defaultValue={penceToInput(money.refundDuePence > 0 ? Math.min(money.refundDuePence, refundable[0]![1]) : refundable[0]![1])}
                    className={`${inputClass} max-w-40 tabular-nums`}
                  />
                </AdminField>
                <AdminField id="refund-reason" label="Reason" hint="Goes in the activity log." className="mt-3">
                  <textarea
                    id="refund-reason"
                    name="reason"
                    required
                    maxLength={REASON_LIMIT}
                    aria-describedby="refund-reason-hint"
                    className={textareaClass}
                  />
                </AdminField>
                <SubmitButton pendingLabel="Refunding…" className="mt-3">
                  Record refund
                </SubmitButton>
              </ActionForm>
            </Panel>
          ) : null}

          {canWaive ? (
            <Panel id="waive" title="Waive the fee" description="For a visit the practice won’t charge for.">
              <ActionForm action={waiveFeeAction}>
                <input type="hidden" name="appointmentId" value={visit.id} />
                <input type="hidden" name="return" value={path} />
                <AdminField id="waive-reason" label="Reason" hint="Goes in the activity log.">
                  <textarea
                    id="waive-reason"
                    name="reason"
                    required
                    maxLength={REASON_LIMIT}
                    aria-describedby="waive-reason-hint"
                    className={textareaClass}
                  />
                </AdminField>
                <SubmitButton variant="secondary" pendingLabel="Waiving…" className="mt-3">
                  Waive {formatMoney(charge?.amountPence ?? 0)}
                </SubmitButton>
              </ActionForm>
            </Panel>
          ) : null}

          {charge?.waiver && visit.status !== "cancelled" ? (
            <Panel id="restore" title="Fee waived" description={`By ${charge.waiver.byName}: ${charge.waiver.reason}`}>
              <ActionForm action={restoreFeeAction}>
                <input type="hidden" name="appointmentId" value={visit.id} />
                <input type="hidden" name="return" value={path} />
                <SubmitButton variant="secondary" pendingLabel="Saving…">
                  Charge the fee again
                </SubmitButton>
              </ActionForm>
            </Panel>
          ) : null}
        </div>
      </div>
    </AdminShell>
  );
}
