import { timingSafeEqual } from "node:crypto";
import { now } from "./clock";
import { getOps } from "./ops";
import { loadDoctors } from "./doctors";
import { dispatchDue, queueDailySummaries } from "./notifications/service";
import { releaseExpiredHolds } from "./payments/holds";
import { retryRefunds } from "./payments/service";
import { forgetBlockedSlots } from "./blocked-slots";
import { expireOffers } from "./rebooking";

function same(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Whether a request carries the scheduler's secret: the CRON_SECRET environment variable, or the secret kept in
 * the database that the pg_cron job reads. Either is accepted; neither is ever logged or returned.
 */
export async function cronAuthorised(authorization: string | null): Promise<boolean> {
  const match = /^Bearer (.+)$/.exec(authorization ?? "");
  if (!match) return false;
  const given = match[1]!.trim();
  if (given.length < 16) return false;
  const fromEnv = process.env.CRON_SECRET?.trim();
  if (fromEnv && same(given, fromEnv)) return true;
  try {
    const stored = await (await getOps()).getSetting("cron_secret");
    return typeof stored === "string" && stored.length >= 16 && same(given, stored);
  } catch {
    return false;
  }
}

export interface CronSummary {
  at: string;
  holdsReleased: number;
  /** Displaced patients' offers that lapsed: cancelled, refunded and told. */
  offersExpired: number;
  refundsRetried: number;
  summariesQueued: number;
  notifications: { sent: number; skipped: number; failed: number; cancelled: number };
  errors: string[];
}

/** One scheduler tick: release expired holds, expire displaced patients' offers, retry stuck refunds, queue the doctors' daily schedules, send what is due (reminders included). */
export async function runCron(): Promise<CronSummary> {
  const errors: string[] = [];
  const summary: CronSummary = {
    at: now().toISOString(),
    holdsReleased: 0,
    offersExpired: 0,
    refundsRetried: 0,
    summariesQueued: 0,
    notifications: { sent: 0, skipped: 0, failed: 0, cancelled: 0 },
    errors,
  };
  const step = async (name: string, work: () => Promise<void>) => {
    try {
      await work();
    } catch (error) {
      errors.push(`${name}: ${error instanceof Error ? error.message : "failed"}`);
    }
  };
  await step("holds", async () => {
    summary.holdsReleased = (await releaseExpiredHolds()).length;
    if (summary.holdsReleased > 0) forgetBlockedSlots();
  });
  await step("rebooking", async () => {
    // Runs before the refund retry and the send, so a lapsed offer's refund and final email go out this tick.
    summary.offersExpired = (await expireOffers()).length;
  });
  await step("refunds", async () => {
    summary.refundsRetried = await retryRefunds();
  });
  await step("summaries", async () => {
    await loadDoctors();
    summary.summariesQueued = await queueDailySummaries();
  });
  await step("notifications", async () => {
    // A few rounds so a backlog clears, but never an unbounded run inside one request.
    for (let round = 0; round < 4; round += 1) {
      const result = await dispatchDue(25);
      summary.notifications.sent += result.sent;
      summary.notifications.skipped += result.skipped;
      summary.notifications.failed += result.failed;
      summary.notifications.cancelled += result.cancelled;
      if (result.sent + result.skipped + result.failed + result.cancelled < 25) break;
    }
  });
  return summary;
}
