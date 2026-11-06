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
          <PageHeading className="text-title2 font-semibold text-ink md:text-title1">Notifications</PageHeading>
          <p className="mt-2 text-body text-ink-2">
            {unread === 0 ? "You’re all caught up." : `${unread} unread`}
          </p>
        </div>
        {unread > 0 ? (
          <form action={markAllReadAction}>
            <button
              type="submit"
              className="inline-flex min-h-11 items-center rounded-full px-4 text-callout font-medium text-accent transition-colors hover:bg-accent-soft"
            >
              Mark all read
            </button>
          </form>
        ) : null}
      </div>

      {items.length === 0 ? (
        <p className="mt-10 rounded-2xl bg-fill px-5 py-8 text-center text-body text-ink-2">
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
                  className={`flex w-full items-start gap-3 rounded-2xl px-4 py-3 text-left transition-colors hover:bg-fill ${
                    item.readAt ? "bg-surface" : "bg-accent-soft/60"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`mt-2 size-2.5 shrink-0 rounded-full ${item.readAt ? "bg-transparent" : "bg-accent"}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className={`block text-body text-ink ${item.readAt ? "" : "font-semibold"}`}>
                      {item.title}
                      {item.readAt ? null : <span className="sr-only"> (unread)</span>}
                    </span>
                    {item.body ? <span className="mt-0.5 block text-callout text-ink-2">{item.body}</span> : null}
                    <span className="mt-1 block text-caption text-muted">{WHEN.format(new Date(item.createdAt))}</span>
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
