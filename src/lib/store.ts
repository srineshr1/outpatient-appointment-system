import path from "node:path";
import type { ClinicStore } from "./clinic-types";
import { seedDemoUsers } from "./seed";

function databaseFile(): string {
  if (process.env.CLINIC_DB) return process.env.CLINIC_DB;
  if (process.env.VITEST) return ":memory:";
  return path.join(process.cwd(), "data", "clinic.sqlite");
}

let opening: Promise<ClinicStore> | null = null;

/**
 * One store per process. DATA_STORE=supabase picks the practice's Supabase Postgres. Otherwise
 * Vercel Blob when a token is set, and SQLite locally and in tests.
 */
export function getStore(): Promise<ClinicStore> {
  opening ??= openStore();
  return opening;
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
