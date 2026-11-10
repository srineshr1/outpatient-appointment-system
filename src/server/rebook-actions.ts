"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { forgetBlockedSlots } from "@/lib/blocked-slots";
import { acceptOffer, cancelOffer } from "@/lib/rebooking";

/**
 * A displaced patient's answers, from /rebook/<token>. The link token is the only credential (the
 * patient may not be signed in on this device), so every action re-reads the offer from it. Opening a
 * link never acts: only these POSTs do, after the patient pressed the button.
 */

const TOKEN = /^[A-Za-z0-9_-]{20,100}$/;

function tokenOf(formData: FormData): string {
  const token = String(formData.get("token") ?? "");
  return TOKEN.test(token) ? token : "";
}

function refresh(): void {
  forgetBlockedSlots();
  try {
    revalidatePath("/", "layout");
  } catch {
    // Unit tests run outside the Next.js cache.
  }
}

/** Move the displaced visit to the chosen time (an offered one, or any open time with the doctor). */
export async function acceptRebookingAction(formData: FormData): Promise<void> {
  const token = tokenOf(formData);
  if (!token) redirect("/rebook/invalid");
  const here = `/rebook/${token}`;
  const slot = String(formData.get("slot") ?? "");
  const more = formData.get("more") === "1" ? "&more=1" : "";
  if (!slot) redirect(`${here}?notice=pick${more}`);
  const result = await acceptOffer(token, slot);
  refresh();
  if (!result.ok) redirect(`${here}?notice=${result.reason}${more}`);
  redirect(`${here}?done=moved`);
}

/** Cancel the displaced visit and refund it in full. Needs the explicit confirmation box. */
export async function cancelRebookingAction(formData: FormData): Promise<void> {
  const token = tokenOf(formData);
  if (!token) redirect("/rebook/invalid");
  const here = `/rebook/${token}`;
  if (formData.get("confirm") !== "yes") redirect(`${here}?cancel=1&notice=confirm`);
  const result = await cancelOffer(token);
  refresh();
  if (!result.ok) redirect(`${here}?notice=${result.reason}`);
  redirect(`${here}?done=cancelled`);
}
