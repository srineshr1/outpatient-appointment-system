"use server";

import { loadPatientDetails, type PatientDetailsResult } from "@/lib/patient-details";
import { getCurrentUser } from "@/lib/session";

/** The details panel on the queue board. The visit's own doctor, reception and admins only. */
export async function getPatientDetails(visitId: string): Promise<PatientDetailsResult> {
  const user = await getCurrentUser();
  return loadPatientDetails(user, typeof visitId === "string" ? visitId.slice(0, 200) : "");
}
