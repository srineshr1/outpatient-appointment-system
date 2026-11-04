import { redirect } from "next/navigation";
import { safeNext } from "@/lib/session";

/** Registering is the sign-up form on the sign-in page. */
export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const query = await searchParams;
  const next = safeNext(typeof query.next === "string" ? query.next : "/");
  redirect(next === "/" ? "/sign-in?mode=signup" : `/sign-in?mode=signup&next=${encodeURIComponent(next)}`);
}
