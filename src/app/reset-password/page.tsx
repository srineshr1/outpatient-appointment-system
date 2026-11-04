import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { resetTokenValid } from "@/lib/login-codes";
import { normaliseEmail } from "@/lib/passwords";

export const metadata: Metadata = {
  title: "Choose a new password",
  robots: { index: false },
};

interface Props {
  searchParams: Promise<{ email?: string | string[]; token?: string | string[] }>;
}

export default async function ResetPasswordPage({ searchParams }: Props) {
  const query = await searchParams;
  const email = typeof query.email === "string" ? normaliseEmail(query.email) : "";
  const token = typeof query.token === "string" ? query.token : "";
  const valid = Boolean(email && token) && (await resetTokenValid(email, token).catch(() => false));
  return (
    <main className="grid min-h-dvh place-items-center bg-surface px-5 py-12">
      <div className="w-full max-w-sm">
        <h1 className="font-statement text-title1 font-bold tracking-[-0.02em] text-ink">Choose a new password</h1>
        {valid ? (
          <ResetPasswordForm email={email} token={token} />
        ) : (
          <>
            <p className="mt-3 text-body text-ink-2">This reset link has expired or was already used.</p>
            <a href="/sign-in" className="mt-4 inline-block font-medium text-accent">
              Back to sign in to ask for a new one
            </a>
          </>
        )}
      </div>
    </main>
  );
}
