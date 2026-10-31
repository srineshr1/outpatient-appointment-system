import { SYSTEM_ACTOR, recordEvent, visitSummary } from "../audit";
import { now } from "../clock";
import { queueNotice } from "../notifications/service";
import { getOps } from "../ops";
import { getStore } from "../store";

/**
 * Release payment holds that have run out: the place goes back on sale, the payment is marked expired and
 * the patient is told. Cheap when nothing has expired, so booking and browsing call it before they read
 * availability, and the cron calls it every few minutes. Never throws.
 */
export async function releaseExpiredHolds(): Promise<string[]> {
  try {
    const ops = await getOps();
    const released = await ops.expireHolds(now());
    if (released.length === 0) return [];
    const store = await getStore();
    for (const id of released) {
      const visit = await store.getAppointment(id);
      if (!visit) continue;
      await queueNotice("hold_expired", visit, { dedupe: `hold_expired:${visit.id}` });
      await recordEvent({
        actor: SYSTEM_ACTOR,
        action: "payment.hold_expired",
        subjectType: "appointment",
        subjectId: visit.id,
        summary: `Held place released, payment not received · ${visitSummary(visit)}`,
      });
    }
    return released;
  } catch (error) {
    console.error(`[payments] Could not release expired holds: ${error instanceof Error ? error.message : "unknown error"}`);
    return [];
  }
}
