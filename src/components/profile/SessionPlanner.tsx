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
    <div className="mt-10 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <section className="rounded-card bg-surface p-5 shadow-card md:p-6" aria-labelledby="add-session">
        <h2 id="add-session" className="text-title3 font-semibold text-ink">
          {title}
        </h2>
        <div className="mt-5">
          <SessionForm defaults={defaults} submitLabel="Add session" onDraft={setDraft} />
        </div>
      </section>
      <div className="lg:sticky lg:top-4">
        <SessionCalendar sessions={sessions} draft={draft} today={today} />
      </div>
    </div>
  );
}
