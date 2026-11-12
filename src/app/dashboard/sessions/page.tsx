import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { defaultsFor } from "@/lib/session-defaults";
import { DisplacedPatients } from "@/components/profile/DisplacedPatients";
import { SessionPlanner } from "@/components/profile/SessionPlanner";
import { PendingButton } from "@/components/ui/PendingButton";
import { buttonClass } from "@/components/ui/button-styles";
import { todayIso } from "@/lib/clock";
import { PageHeading } from "@/components/shell/PageHeading";
import { Notice } from "@/components/ui/Card";
import { occupiesTime } from "@/lib/elastic-scheduling";
import { doctorStatus } from "@/lib/doctor-status";
import { readDoctorProfile } from "@/lib/profiles";
import { getCurrentUser } from "@/lib/session";
import { getStore } from "@/lib/store";
import { displacedFor } from "@/lib/rebooking";
import { archiveSession } from "@/server/profile-actions";

export const metadata: Metadata = { title: "Consulting sessions", robots: { index: false } };

const SAVED: Record<string, string> = {
  created: "Session added.",
  updated: "Session changed.",
  removed: "Session removed.",
};

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; saved?: string; notice?: string; n?: string; v?: string; lent?: string; displaced?: string; displace?: string }>;
}) {
  const [user, query] = await Promise.all([getCurrentUser(), searchParams]);
  if (!user) redirect("/sign-in?as=staff&next=/dashboard/sessions");
  if (user.role !== "doctor" || user.doctorId !== user.id) redirect("/dashboard");
  const store = await getStore();
  const today = todayIso();
  const [status, record, appointments, trims, displaced] = await Promise.all([
    doctorStatus(store, user),
    store.getProfile(user.id),
    store.listAppointments({ doctorId: user.id }),
    store.listSessionTrims(user.id),
    displacedFor(user.id),
  ]);
  const room = readDoctorProfile(record).room || user.doctorRoom || "Room 6";
  const welcome = query.welcome === "1";
  const saved = SAVED[query.saved ?? ""];
  const occupying = appointments
    .filter((visit) => occupiesTime(visit) && visit.date >= today)
    .map((visit) => ({ date: visit.date, time: visit.time, endTime: visit.endTime ?? null, sessionId: visit.sessionId ?? null }));
  const busy = query.notice === "busy";
  const moved = Number(query.displaced ?? 0);
  const removing = busy && query.displace ? status.sessions.find((session) => session.id === query.displace) : undefined;
  const count = Number(query.n ?? 0);

  return (
    <div className="mx-auto max-w-[92rem] px-5 pt-8 pb-20 md:px-8 xl:px-10 md:pt-12">
      <Link
        href="/dashboard"
        className="-ml-2 inline-flex min-h-11 items-center rounded-full pr-3 pl-2 text-body text-cyan-300 transition-colors hover:bg-accent-soft"
      >
        Clinic book
      </Link>
      <PageHeading className="mt-2 text-title2 font-semibold text-ink md:text-title1">
        {welcome ? "Set up your consulting sessions" : "Consulting sessions"}
      </PageHeading>
      <p className="mt-2 max-w-prose text-body text-ink-2">
        A session is a block of hours on the days you choose — in a <strong>stream</strong> each patient keeps their own slot,
        in a <strong>wave</strong> patients arrive within the wave and are seen in token order. A one-off session takes a
        weekly session&rsquo;s place on its date. The week comes first. Add a session, or choose Edit a session and pick a highlighted block.
      </p>
      {saved ? (
        <Notice tone="success" role="status" className="mt-6">
          {saved} {query.lent ?? ""}{" "}
          {moved > 0 ? `${moved === 1 ? "1 patient was" : `${moved} patients were`} moved off the removed hours and offered new times. ` : ""}
          {status.visible ? "Patients can book you." : ""}
        </Notice>
      ) : null}
      {removing && count > 0 ? (
        <section aria-labelledby="remove-displace" role="alert" className="mt-6 rounded-card border border-red-400/25 bg-danger-soft px-5 py-4 text-callout text-ink">
          <h2 id="remove-displace" className="text-body font-semibold">
            {count === 1 ? "1 patient is" : `${count} patients are`} booked in {removing.label || "that session"}
          </h2>
          <p className="mt-1">
            Move or cancel {count === 1 ? "that visit" : "those visits"} from your clinic book first, or remove the session and
            notify {count === 1 ? "the patient" : "them"}: each is offered the nearest free times with you (held for 24 hours) and can
            pick one or cancel for a full refund. Unpaid holds are released.
          </p>
          <form action={archiveSession} className="group mt-3 grid gap-3">
            <input type="hidden" name="id" value={removing.id} />
            <input type="hidden" name="displace" value="confirm" />
            <input type="hidden" name="displaceCount" value={count} />
            <label htmlFor="remove-displace-reason" className="font-semibold">
              Message for the patients <span className="font-normal text-ink-2">(optional)</span>
            </label>
            <input id="remove-displace-reason" name="displaceReason" maxLength={200} className="field" />
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <PendingButton pendingLabel="Notifying…" className={buttonClass("primary", "md", "group-has-[[aria-busy=true]]:pointer-events-none")}>
                Notify them and offer new times
              </PendingButton>
              <Link href="/dashboard/sessions" className={buttonClass("plain", "md")}>
                Keep the session
              </Link>
            </div>
          </form>
        </section>
      ) : busy ? (
        <Notice tone="danger" role="alert" className="mt-6">
          {query.n ?? "Some"} booked visits use that session. Move or cancel them from your clinic book first.
        </Notice>
      ) : query.notice === "missing" ? (
        <Notice tone="danger" role="alert" className="mt-6">
          That session was already removed.
        </Notice>
      ) : null}
      {!status.steps[0]!.done ? (
        <Notice tone="info" className="mt-6">
          Patients can&rsquo;t see you yet.{" "}
          <Link href="/dashboard/profile" className="text-cyan-300 underline underline-offset-4">
            Finish your profile
          </Link>{" "}
          as well as adding a session.
        </Notice>
      ) : null}

      <SessionPlanner
        key={query.v ?? ""}
        sessions={status.sessions}
        defaults={defaultsFor(null, room)}
        today={today}
        visits={occupying}
        trims={trims}
        addTitle={status.sessions.length > 0 ? "Add another session" : "Add your first session"}
      />
      <DisplacedPatients entries={displaced} />
    </div>
  );
}
