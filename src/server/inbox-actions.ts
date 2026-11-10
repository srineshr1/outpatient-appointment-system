"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getOps } from "@/lib/ops";
import { getCurrentUser, safeNext } from "@/lib/session";

/**
 * Inbox actions. Each one checks who is signed in and only ever touches that person's own rows,
 * because the store filters by their user id as well as the item id.
 */
async function signedIn() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/inbox");
  return user;
}

/** Open an item: mark it read, then go where it points. */
export async function openInboxItemAction(formData: FormData): Promise<void> {
  const user = await signedIn();
  const id = String(formData.get("id") ?? "");
  const ops = await getOps();
  const item = (await ops.listInbox(user.id, { limit: 200 })).find((row) => row.id === id);
  if (item) await ops.markInboxRead(user.id, item.id);
  revalidatePath("/", "layout");
  redirect(safeNext(item?.href || "/inbox"));
}

export async function markAllReadAction(): Promise<void> {
  const user = await signedIn();
  await (await getOps()).markInboxRead(user.id, "all");
  revalidatePath("/", "layout");
  redirect("/inbox");
}
