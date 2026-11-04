import path from "node:path";
import type { ClinicStore } from "./clinic-types";
import { seedDemoUsers } from "./seed";

function databaseFile(): string {
  if (process.env.CLINIC_DB) return process.env.CLINIC_DB;
  if (process.env.VITEST) return ":memory:";
  return path.join(process.cwd(), "data", "clinic.sqlite");
}

let opening: Promise<ClinicStore> | null = null;
let failedAt = 0;
/** After the store fails to open, answer "unavailable" straight away for this long instead of retrying on every request. */
const RETRY_AFTER_MS = 15_000;

/** The data store could not be opened (missing key, suspended, unreachable). Public pages degrade; actions say so. */
export class StoreUnavailableError extends Error {
  constructor(cause?: unknown) {
    super(`The data store is unavailable${cause instanceof Error ? `: ${cause.message}` : ""}`);
    this.name = "StoreUnavailableError";
  }
}

export const STORE_UNAVAILABLE_MESSAGE =
  "Sign-in is temporarily unavailable while we restore our systems. Please try again in a little while.";

/** True when the store opens. Never throws. */
export async function storeAvailable(): Promise<boolean> {
  try {
    await getStore();
    return true;
  } catch {
    return false;
  }
}

/**
 * One store per process. DATA_STORE=supabase picks the practice's Supabase Postgres. Otherwise
 * Vercel Blob when a token is set, and SQLite locally and in tests.
 */
export function getStore(): Promise<ClinicStore> {
  if (opening) return opening;
  if (failedAt && Date.now() - failedAt < RETRY_AFTER_MS) return Promise.reject(new StoreUnavailableError());
  const attempt = openStore().catch((error: unknown) => {
    // Do not remember the failure for good: a fixed key or a restored quota should work on the next try.
    if (opening === attempt) opening = null;
    failedAt = Date.now();
    console.error(`[store] Could not open the data store: ${error instanceof Error ? error.message : "unknown error"}`);
    throw new StoreUnavailableError(error);
  });
  opening = attempt;
  return attempt;
}

async function openStore(): Promise<ClinicStore> {
  const store: ClinicStore =
    process.env.DATA_STORE === "supabase"
      ? new (await import("./supabase-store")).SupabaseClinicStore()
      : process.env.BLOB_READ_WRITE_TOKEN
        ? new (await import("./blob-store")).BlobClinicStore()
        : new (await import("./sqlite-store")).SqliteClinicStore(databaseFile());
  await store.ensureReady();
  await seedDemoUsers(store);
  return store;
}
