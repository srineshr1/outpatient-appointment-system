import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

/** A Supabase auth cookie: sb-<ref>-auth-token, its numbered chunks, or the PKCE code verifier. */
export function isAuthCookie(name: string): boolean {
  return /^sb-.+-auth-token(-code-verifier)?(\.\d+)?$/.test(name);
}

/** Server Supabase client. Session cookies are written when Auth sets them. */
export async function createSupabase() {
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
    {
      cookies: {
        getAll() {
          return jar.getAll();
        },
        setAll(batch) {
          try {
            for (const { name, value, options } of batch) jar.set(name, value, options);
          } catch {
            // A Server Component can read cookies but not always write them. Route handlers and actions can.
          }
        },
      },
    },
  );
}
