import { findDoctor } from "../data";
import { feeFor } from "../fees";
import { getOps } from "../ops";

/**
 * What a visit with this doctor costs, in minor units. Read on the server from the database every time,
 * never from the browser: the doctor's stored fee, then the fee on their profile, then the practice's
 * fee for the visit reason. 0 means no payment is taken.
 */
export async function resolveFee(doctorId: string, reasonId: string): Promise<number> {
  try {
    const stored = await (await getOps()).getDoctorFee(doctorId);
    if (stored) return stored.feeMinor;
  } catch (error) {
    console.error(`[payments] Could not read the stored fee for ${doctorId}: ${error instanceof Error ? error.message : "unknown error"}`);
    throw error;
  }
  return feeFor(reasonId, findDoctor(doctorId)?.feePence);
}
