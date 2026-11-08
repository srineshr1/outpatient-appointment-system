import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { defaultsFor } from "@/lib/session-defaults";
import { SessionPlanner } from "@/components/profile/SessionPlanner";
import { todayIso } from "@/lib/clock";
import { PageHeading } from "@/components/shell/PageHeading";
import { Notice } from "@/components/ui/Card";
import { doctorStatus } from "@/lib/doctor-status";
import { readDoctorProfile } from "@/lib/profiles";
import { getCurrentUser } from "@/lib/session";
import { getStore } from "@/lib/store";

export const metadata: Metadata = { title: "Consulting sessions", robots: { index: false } };

const SAVED: Record<string, string> = {
  created: "Session added.",
  updated: "Session changed.",
  removed: "Session removed.",
};

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; saved?: string; notice?: string; n?: string; v?: string }>;
}) {
  const [user, query] = await Promise.all([getCurrentUser(), searchParams]);
  if (!user) redirect("/sign-in?as=staff&next=/dashboard/sessions");
  if (user.role !== "doctor" || user.doctorId !== user.id) redirect("/dashboard");
  const store = await getStore();
  const [status, record] = await Promise.all([doctorStatus(store, user), store.getProfile(user.id)]);
  const room = readDoctorProfile(record).room || user.doctorRoom || "Room 6";
  const welcome = query.welcome === "1";
  const saved = SAVED[query.saved ?? ""];
  const busy = query.notice === "busy";

  return (
    <div className="mx-auto max-w-[92rem] px-5 pt-8 pb-20 md:px-8 xl:px-10 md:pt-12">
      <Link
        href="/dashboard"
        className="-ml-2 inline-flex min-h-11 items-center rounded-full pr-3 pl-2 text-body text-accent hover:bg-accent-soft"
      >
        Clinic book
      </Link>
      <PageHeading className="mt-2 text-title2 font-semibold text-ink md:text-title1">
        {welcome ? "Set up your consulting sessions" : "Consulting sessions"}
      </PageHeading>
      <p className="mt-2 max-w-prose text-body text-ink-2">
        A session is a block of hours on the days you choose — in a <strong>stream</strong> each patient keeps their own slot,
        in a <strong>wave</strong> patients arrive within the wave and are seen in token order. A one-off session takes a
        weekly session&rsquo;s place on its date. Edit a session by clicking it below.
      </p>
      {saved ? (
        <Notice tone="success" role="status" className="mt-6">
          {saved} {status.visible ? "Patients can book you." : ""}
        </Notice>
      ) : null}
      {busy ? (
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
          <Link href="/dashboard/profile" className="text-accent underline underline-offset-4">
            Finish your profile
          </Link>{" "}
          as well as adding a session.
        </Notice>
      ) : null}

      <SessionPlanner
        key={query.v ?? ""}
        sessions={status.sessions}
        defaults={defaultsFor(null, room)}
        today={todayIso()}
        addTitle={status.sessions.length > 0 ? "Add another session" : "Add your first session"}
      />
    </div>
  );
}
