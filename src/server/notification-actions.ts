"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { actorOf, recordEvent } from "@/lib/audit";
import type { FormState } from "@/lib/form-state";
import { PREF_KEYS, saveDoctorPrefs, type DoctorNotifyPrefs } from "@/lib/notifications/doctor-prefs";
import { getCurrentUser } from "@/lib/session";

/** A doctor's own email choices. Unticked means off; a missing box is a switch turned off. */
export async function saveNotificationPrefs(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?as=staff&next=/dashboard/notifications");
  if (user.role !== "doctor") redirect("/dashboard");
  const prefs = Object.fromEntries(PREF_KEYS.map((key) => [key, formData.get(key) === "on"])) as unknown as DoctorNotifyPrefs;
  await saveDoctorPrefs(user.id, prefs);
  await recordEvent({
    actor: actorOf(user),
    action: "profile.updated",
    subjectType: "user",
    subjectId: user.id,
    summary: `${user.name} · email notifications`,
  });
  try {
    revalidatePath("/dashboard/notifications");
  } catch {
    // Unit tests run outside the Next.js cache.
  }
  redirect("/dashboard/notifications?saved=1");
}
