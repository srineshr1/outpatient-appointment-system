import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { PageHeading } from "@/components/shell/PageHeading";
import { safeNext } from "@/lib/session";

export const metadata: Metadata = {
  title: "Create an account",
  robots: { index: false },
};

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const query = await searchParams;
  const nextPath = safeNext(typeof query.next === "string" ? query.next : "/appointments");

  return (
    <div className="mx-auto max-w-3xl px-5 pt-8 pb-20 md:px-8 md:pt-12">
      <PageHeading className="text-title2 font-semibold text-ink md:text-title1">Create an account</PageHeading>
      <p className="mt-2 max-w-prose text-body text-ink-2">
        Patient accounts can book a time and see it again under Appointments. The same visit appears on that doctor’s clinic book.
      </p>
      <div className="mt-8">
        <RegisterForm nextPath={nextPath} />
      </div>
    </div>
  );
}
