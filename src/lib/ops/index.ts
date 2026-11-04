import { getStore } from "../store";
import { MemoryOps } from "./memory-ops";
import type { OpsStore } from "./types";

let opening: Promise<OpsStore> | null = null;

/**
 * One ops store per process: Supabase when DATA_STORE=supabase (production), otherwise in memory on
 * top of the clinic store (tests and local development).
 */
export function getOps(): Promise<OpsStore> {
  opening ??= (async () => {
    if (process.env.DATA_STORE === "supabase") return new (await import("./supabase-ops")).SupabaseOps();
    return new MemoryOps(await getStore());
  })().catch((error: unknown) => {
    opening = null;
    throw error;
  });
  return opening;
}

/** Tests: forget the cached store so the next call builds a fresh one. */
export function resetOpsForTests(): void {
  opening = null;
}
