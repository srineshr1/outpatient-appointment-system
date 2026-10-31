/**
 * The cancellation and refund policy. Pure maths, no I/O, so it is easy to test and to explain.
 *
 * Patient cancels:  at least 24 h before the visit → full refund; 2 h to 24 h → 50 %; under 2 h → none.
 * Doctor or clinic cancels: always a full refund.
 * The tiers and the doctor rule are settings (clinic_settings.refund_policy), so an admin can change them.
 */

export interface RefundTier {
  /** The tier applies when the visit is at least this many hours away. */
  minHours: number;
  percent: number;
}

export interface RefundPolicy {
  tiers: RefundTier[];
  /** Share refunded when the doctor or the clinic cancels. */
  doctorCancelPercent: number;
}

export const DEFAULT_REFUND_POLICY: RefundPolicy = {
  tiers: [
    { minHours: 24, percent: 100 },
    { minHours: 2, percent: 50 },
    { minHours: 0, percent: 0 },
  ],
  doctorCancelPercent: 100,
};

export type CancelledBy = "patient" | "clinic";

export interface RefundDecision {
  percent: number;
  /** Whole minor units, rounded down so we never refund more than the share. */
  refundMinor: number;
  hoursBefore: number;
  /** A sentence for the patient. */
  explanation: string;
}

function clampPercent(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : fallback;
}

/** Read a stored policy, falling back to the default for anything malformed. Tiers are sorted longest-notice first. */
export function normalisePolicy(raw: unknown): RefundPolicy {
  if (!raw || typeof raw !== "object") return DEFAULT_REFUND_POLICY;
  const candidate = raw as { tiers?: unknown; doctorCancelPercent?: unknown };
  const tiers: RefundTier[] = [];
  if (Array.isArray(candidate.tiers)) {
    for (const item of candidate.tiers) {
      if (!item || typeof item !== "object") continue;
      const { minHours, percent } = item as { minHours?: unknown; percent?: unknown };
      if (typeof minHours !== "number" || !Number.isFinite(minHours) || minHours < 0) continue;
      tiers.push({ minHours, percent: clampPercent(percent, 0) });
    }
  }
  if (tiers.length === 0) return { ...DEFAULT_REFUND_POLICY, doctorCancelPercent: clampPercent(candidate.doctorCancelPercent, 100) };
  tiers.sort((a, b) => b.minHours - a.minHours);
  return { tiers, doctorCancelPercent: clampPercent(candidate.doctorCancelPercent, 100) };
}

/** Hours from `cancelledAt` to the start of the visit. Negative once it has started. */
export function hoursUntil(startsAt: Date, cancelledAt: Date): number {
  return (startsAt.getTime() - cancelledAt.getTime()) / 3_600_000;
}

function hoursText(hours: number): string {
  return Number.isInteger(hours) ? `${hours} hour${hours === 1 ? "" : "s"}` : `${hours} hours`;
}

/** What a cancellation refunds. `paidMinor` is what was actually paid and not yet refunded. */
export function computeRefund(input: {
  paidMinor: number;
  startsAt: Date;
  cancelledAt: Date;
  cancelledBy: CancelledBy;
  policy?: RefundPolicy;
}): RefundDecision {
  const policy = input.policy ?? DEFAULT_REFUND_POLICY;
  const hoursBefore = hoursUntil(input.startsAt, input.cancelledAt);
  let percent: number;
  let explanation: string;
  if (input.cancelledBy === "clinic") {
    percent = policy.doctorCancelPercent;
    explanation = "The practice cancelled this visit, so you are due a full refund.";
  } else {
    const tier = policy.tiers.find((candidate) => hoursBefore >= candidate.minHours) ?? policy.tiers[policy.tiers.length - 1]!;
    percent = tier.percent;
    explanation =
      tier.percent === 100
        ? `You cancelled at least ${hoursText(tier.minHours)} before the visit, so you are due a full refund.`
        : tier.percent === 0
          ? `Cancellations less than ${hoursText(policy.tiers.filter((t) => t.percent > 0).at(-1)?.minHours ?? 0)} before the visit are not refunded.`
          : `You cancelled at least ${hoursText(tier.minHours)} before the visit, so you are due a ${tier.percent}% refund.`;
  }
  const refundMinor = Math.min(input.paidMinor, Math.floor((input.paidMinor * percent) / 100));
  return { percent, refundMinor: Math.max(0, refundMinor), hoursBefore, explanation };
}
