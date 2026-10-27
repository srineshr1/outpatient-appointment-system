import type { Metadata } from "next";
import { SignInPanel } from "@/components/auth/SignInPanel";
import { PageHeading } from "@/components/shell/PageHeading";
import { safeNext } from "@/lib/session";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false },
};

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const query = await searchParams;
  const nextPath = safeNext(typeof query.next === "string" ? query.next : "/");

  return (
    <div className="mx-auto max-w-page px-5 pt-8 pb-20 md:px-8 md:pt-12">
      <PageHeading className="text-title2 font-semibold text-ink md:text-title1">Sign in</PageHeading>
      <p className="mt-2 max-w-prose text-body text-ink-2">
        Demonstration clinic. Use a sample account, or register with details you’re happy to store in this demo.
      </p>
      <div className="mt-8">
        <SignInPanel nextPath={nextPath} />
      </div>
    </div>
  );
}
