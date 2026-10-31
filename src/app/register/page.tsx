import { redirect } from "next/navigation";
import { safeNext } from "@/lib/session";

/** Accounts are created on first sign-in now, so registering is the same page. */
export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const query = await searchParams;
  const next = safeNext(typeof query.next === "string" ? query.next : "/");
  redirect(next === "/" ? "/sign-in" : `/sign-in?next=${encodeURIComponent(next)}`);
}
