import type { ConsultSession } from "@/lib/clinic-types";
import { describeSession } from "@/lib/sessions";
import { buttonClass } from "@/components/ui/button-styles";
import { PendingButton } from "@/components/ui/PendingButton";
import { archiveSession } from "@/server/profile-actions";
import { SessionForm, defaultsFor } from "./SessionForm";

/** One session the doctor already set up: a summary, a way to change it and a way to remove it. */
export function SessionCard({ session, room }: { session: ConsultSession; room: string }) {
  return (
    <li className="rounded-card bg-surface p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-body font-semibold text-ink">
            {session.label || "Consulting session"}{" "}
            <span className="ml-1 rounded-full bg-accent-soft px-2 py-0.5 text-caption font-semibold text-accent">
              {session.mode === "wave" ? "Wave" : "Stream"}
            </span>
          </h3>
          <p className="mt-1 text-callout text-ink-2">{describeSession(session)}</p>
          <p className="text-callout text-ink-2">{session.room}</p>
        </div>
        <form action={archiveSession} className="group">
          <input type="hidden" name="id" value={session.id} />
          <PendingButton pendingLabel="Removing…" className={buttonClass("plain", "md", "group-has-[[aria-busy=true]]:pointer-events-none")}>
            Remove
          </PendingButton>
        </form>
      </div>
      <details className="mt-4">
        <summary className="inline-flex min-h-11 cursor-pointer items-center text-callout font-medium text-accent">Change this session</summary>
        <div className="mt-3">
          <SessionForm defaults={defaultsFor(session, room)} submitLabel="Save changes" />
        </div>
      </details>
    </li>
  );
}
