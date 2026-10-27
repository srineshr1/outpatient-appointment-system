import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { PageHeading } from "@/components/shell/PageHeading";
import { destinationFor } from "@/lib/auth-routing";
import { getCurrentUser, safeNext } from "@/lib/session";

export const metadata: Metadata = {
  title: "Create an account",
  robots: { index: false },
};

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const query = await searchParams;
  const nextPath = safeNext(typeof query.next === "string" ? query.next : "/appointments");
  const user = await getCurrentUser();
  if (user) redirect(destinationFor(user.role, nextPath));

  return (
    <div className="relative isolate overflow-hidden px-5 pt-8 pb-20 md:pt-12">
      <div
        aria-hidden="true"
        className="absolute -top-40 left-1/2 -z-10 size-[42rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,var(--color-accent-soft)_0%,transparent_65%)]"
      />
      <PageHeading className="text-center text-title2 font-bold text-ink">Create your account</PageHeading>
      <div className="mt-6">
        <RegisterForm nextPath={nextPath} />
      </div>
    </div>
  );
}
