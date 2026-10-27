import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { createPatient, findUserByEmail } from "@/lib/accounts";
import { destinationFor } from "@/lib/auth-routing";
import { finishGoogle, GOOGLE_STATE_COOKIE } from "@/lib/google";
import { safeNext, startSession } from "@/lib/session";

function sameText(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function backToSignIn(reason: string, next: string): never {
  const params = new URLSearchParams({ error: reason });
  if (next !== "/") params.set("next", next);
  redirect(`/sign-in?${params}`);
}

export async function GET(request: NextRequest) {
  const jar = await cookies();
  let saved: { state?: string; verifier?: string; next?: string } = {};
  try {
    saved = JSON.parse(jar.get(GOOGLE_STATE_COOKIE)?.value ?? "{}") as typeof saved;
  } catch {
    saved = {};
  }
  // One use only.
  jar.delete({ name: GOOGLE_STATE_COOKIE, path: "/auth/google" });
  const next = safeNext(saved.next ?? "/");

  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  // Cancelled at Google, or a forged or replayed callback.
  if (params.get("error") || !code) backToSignIn("google-cancelled", next);
  if (!saved.state || !saved.verifier || !sameText(saved.state, params.get("state") ?? "")) {
    backToSignIn("google-failed", next);
  }

  const profile = await finishGoogle(request.nextUrl.origin, code, saved.verifier).catch(() => null);
  if (!profile) backToSignIn("google-failed", next);

  const user = (await findUserByEmail(profile.email)) ?? (await createPatient(profile.email, profile.name));
  await startSession(user.id);
  redirect(destinationFor(user.role, next));
}
