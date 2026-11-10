"use client";

import { useState } from "react";
import type { ConsultSession } from "@/lib/clinic-types";
import type { SessionDefaults } from "@/lib/session-defaults";
import { SessionCalendar } from "./SessionCalendar";
import { SessionForm } from "./SessionForm";

/** The "add a session" form beside a calendar that previews the draft as the doctor types. */
export function SessionPlanner({
  sessions,
  defaults,
  today,
  title,
}: {
  sessions: ConsultSession[];
  defaults: SessionDefaults;
  today: string;
  title: string;
}) {
  const [draft, setDraft] = useState<ConsultSession | null>(null);
  return (
    <div className="mt-8 grid items-start gap-5 lg:grid-cols-[minmax(20rem,24rem)_minmax(0,1fr)] xl:grid-cols-[minmax(22rem,26rem)_minmax(0,1fr)] xl:gap-6">
      <section className="rounded-card bg-surface p-4 shadow-card md:p-5 lg:sticky lg:top-4" aria-labelledby="add-session">
        <h2 id="add-session" className="text-title3 font-semibold text-ink">
          {title}
        </h2>
        <div className="mt-4">
          <SessionForm defaults={defaults} submitLabel="Add session" onDraft={setDraft} />
        </div>
      </section>
      <div className="min-w-0">
        <SessionCalendar sessions={sessions} draft={draft} today={today} />
      </div>
    </div>
  );
}
