import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeading } from "@/components/shell/PageHeading";
import { getOps } from "@/lib/ops";
import { getCurrentUser } from "@/lib/session";
import { markAllReadAction, openInboxItemAction } from "@/server/inbox-actions";

export const metadata: Metadata = { title: "Notifications", robots: { index: false } };

const WHEN = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Calcutta",
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Everything that has happened to your visits, newest first. Opening one marks it read. */
export default async function InboxPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/inbox");
  const items = await (await getOps()).listInbox(user.id, { limit: 100 });
  const unread = items.filter((item) => !item.readAt).length;

  return (
    <div className="mx-auto max-w-3xl px-5 pt-8 pb-20 md:px-8 md:pt-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <PageHeading className="text-title2 font-semibold text-zinc-50 md:text-title1">Notifications</PageHeading>
          <p className="mt-2 text-body text-zinc-300">
            {unread === 0 ? "You’re all caught up." : `${unread} unread`}
          </p>
        </div>
        {unread > 0 ? (
          <form action={markAllReadAction}>
            <button
              type="submit"
              className="inline-flex min-h-11 items-center rounded-full border border-cyan-400/25 bg-cyan-400/10 px-4 text-callout font-medium text-cyan-300 transition-colors hover:bg-cyan-400/15"
            >
              Mark all read
            </button>
          </form>
        ) : null}
      </div>

      {items.length === 0 ? (
        <p className="mt-10 rounded-2xl border border-hairline bg-surface-2 px-5 py-8 text-center text-body text-zinc-300">
          Nothing yet. When a visit is booked, moved or cancelled, it shows up here.
        </p>
      ) : (
        <ul className="mt-6 grid gap-2">
          {items.map((item) => (
            <li key={item.id}>
              <form action={openInboxItemAction}>
                <input type="hidden" name="id" value={item.id} />
                <button
                  type="submit"
                  className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
                    item.readAt
                      ? "border-hairline bg-surface hover:bg-fill"
                      : "border-cyan-400/30 bg-cyan-400/10 hover:bg-cyan-400/15"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`mt-2 size-2.5 shrink-0 rounded-full ${
                      item.readAt ? "bg-transparent" : "bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]"
                    }`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className={`block text-body text-zinc-50 ${item.readAt ? "" : "font-semibold"}`}>
                      {item.title}
                      {item.readAt ? null : <span className="sr-only"> (unread)</span>}
                    </span>
                    {item.body ? <span className="mt-0.5 block text-callout text-zinc-300">{item.body}</span> : null}
                    <span className="mt-1 block text-caption text-zinc-400">{WHEN.format(new Date(item.createdAt))}</span>
                  </span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
