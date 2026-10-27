import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignInPanel, type SignInRole } from "@/components/auth/SignInPanel";
import { PageHeading } from "@/components/shell/PageHeading";
import { destinationFor } from "@/lib/auth-routing";
import { getDoctors } from "@/lib/repository";
import { getCurrentUser, safeNext } from "@/lib/session";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false },
};

interface Props {
  searchParams: Promise<{ next?: string | string[]; as?: string | string[] }>;
}

export default async function SignInPage({ searchParams }: Props) {
  const query = await searchParams;
  const nextPath = safeNext(typeof query.next === "string" ? query.next : "/");

  // Already signed in: carry straight on.
  const user = await getCurrentUser();
  if (user) redirect(destinationFor(user.role, nextPath));

  const initialRole: SignInRole = query.as === "staff" || nextPath.startsWith("/dashboard") ? "staff" : "patient";
  const doctors = await getDoctors();

  return (
    <div className="relative isolate overflow-hidden px-5 pt-8 pb-20 md:pt-12">
      <div
        aria-hidden="true"
        className="absolute -top-40 left-1/2 -z-10 size-[42rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,var(--color-accent-soft)_0%,transparent_65%)]"
      />
      <PageHeading className="sr-only">Sign in</PageHeading>
      <SignInPanel nextPath={nextPath} initialRole={initialRole} doctors={doctors} />
      <p className="mx-auto mt-10 max-w-md text-center text-caption text-muted">
        This is a demonstration practice. Don’t use a real CHI number or details you want kept private.
      </p>
    </div>
  );
}
