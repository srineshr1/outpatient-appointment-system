import type { ClinicStore, UserAccount } from "./clinic-types";
import { doctorProfileRecord, EMPTY_DOCTOR_PROFILE } from "./profiles";
import { defaultSession } from "./sessions";

/**
 * Doctors an admin adds are ready for patients straight away: the admin route stays the quick way
 * to add a doctor. They get a starter profile and a weekday stream session, and can change both
 * later. Doctors who sign up themselves skip this and finish their own profile and sessions.
 * Nothing is overwritten: a profile or session that already exists is left as it is.
 */
export async function giveStarterSchedule(store: ClinicStore, account: UserAccount, at: string): Promise<void> {
  if (account.role !== "doctor" || account.doctorId !== account.id) return;
  const [profile, sessions] = await Promise.all([store.getProfile(account.id), store.listConsultSessions(account.id)]);
  const room = account.doctorRoom?.trim() || "Room 6";
  if (!profile) {
    await store.putProfile(
      doctorProfileRecord(
        account.id,
        {
          ...EMPTY_DOCTOR_PROFILE,
          specialty: account.doctorInterest?.trim() || "General practice",
          qualification: "MRCGP",
          years: 1,
          room,
          bio: "Recently joined the practice. Happy to see anything, from a new worry to a long-running condition.",
        },
        at,
      ),
    );
  }
  if (sessions.length === 0) await store.createConsultSessionIfAbsent(defaultSession(account.id, room, at));
}
