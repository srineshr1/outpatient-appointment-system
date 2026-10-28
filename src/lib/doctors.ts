import { allDoctors, setStaffDoctors, staffDoctorProfile, type Doctor } from "./data";
import { getStore } from "./store";

/** Re-read the accounts at most this often per server instance. */
const FRESH_MS = 10_000;
let loadedAt = 0;
let pending: Promise<void> | null = null;

async function refresh(): Promise<void> {
  try {
    const users = await (await getStore()).listUsers();
    setStaffDoctors(
      users
        .filter((user) => user.role === "doctor" && !user.disabledAt && user.doctorId === user.id)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(staffDoctorProfile),
    );
    loadedAt = Date.now();
  } catch (error) {
    console.error(`[doctors] Could not load added doctors: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

/**
 * Every doctor patients can book: the practice's own, then doctor accounts that an admin gave
 * their own clinic book (`doctorId` equal to the account id). Also refreshes the list that
 * `findDoctor` and `generateSlots` read. Pass `force` right after changing a role.
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
