import type { ConsultSession, ProfileRecord, UserAccount } from "./clinic-types";
import { allDoctors, setConsultSessions, setDoctorFees, setStaffDoctors, staffDoctorProfile, type Doctor } from "./data";
import { isDoctorProfileComplete, readDoctorProfile } from "./profiles";
import { getOps } from "./ops";
import { getStore } from "./store";

/** Re-read the accounts at most this often per server instance. */
const FRESH_MS = 10_000;
let loadedAt = 0;
let pending: Promise<void> | null = null;

/**
 * Split the doctor accounts that have their own clinic book into those patients can book and those
 * who are not ready yet. A doctor is ready when their profile is complete and they have at least
 * one live consulting session.
 */
export function splitDoctors(
  users: readonly UserAccount[],
  profiles: readonly ProfileRecord[],
  sessions: readonly ConsultSession[],
): { listed: Doctor[]; unlisted: Doctor[] } {
  const profileOf = new Map(profiles.map((profile) => [profile.userId, profile]));
  const withSession = new Set(sessions.filter((session) => !session.archivedAt).map((session) => session.doctorId));
  const listed: Doctor[] = [];
  const unlisted: Doctor[] = [];
  const accounts = users
    .filter((user) => user.role === "doctor" && !user.disabledAt && user.doctorId === user.id)
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const account of accounts) {
    const record = profileOf.get(account.id);
    const profile = readDoctorProfile(record);
    const ready = Boolean(record) && isDoctorProfileComplete(account.name, profile) && withSession.has(account.id);
    (ready ? listed : unlisted).push(staffDoctorProfile(account, record ? profile : undefined));
  }
  return { listed, unlisted };
}

async function refresh(): Promise<void> {
  try {
    const store = await getStore();
    const [users, profiles, sessions] = await Promise.all([
      store.listUsers(),
      store.listProfiles("doctor"),
      store.listConsultSessions(),
    ]);
    const { listed, unlisted } = splitDoctors(users, profiles, sessions);
    // Fees live in their own table. If it cannot be read, keep the last known fees rather than guess.
    try {
      const fees = await (await getOps()).listDoctorFees();
      setDoctorFees(Object.fromEntries(fees.map((fee) => [fee.doctorId, fee.feeMinor])));
    } catch (error) {
      console.error(`[doctors] Could not load fees: ${error instanceof Error ? error.message : "unknown error"}`);
    }
    setConsultSessions(sessions);
    setStaffDoctors(listed, unlisted);
    loadedAt = Date.now();
  } catch (error) {
    console.error(`[doctors] Could not load added doctors: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

/**
 * Every doctor patients can book: the practice's own, then doctors who signed up or were added by an
 * admin and have finished their profile and set up a session. Also refreshes the doctors and
 * sessions that `findDoctor` and `generateSlots` read. Pass `force` right after changing an account,
 * a profile or a session.
 */
export async function loadDoctors(force = false): Promise<Doctor[]> {
  if (force) await refresh();
  else if (Date.now() - loadedAt > FRESH_MS) {
    pending ??= refresh().finally(() => {
      pending = null;
    });
    await pending;
  }
  return allDoctors();
}
