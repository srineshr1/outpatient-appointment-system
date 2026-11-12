import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { AuroraBackground } from "@/components/ui/AuroraBackground";
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
    <AuroraBackground className="grid min-h-[calc(100dvh-var(--header-h))] place-items-center bg-canvas px-5 py-12">
      <div className="relative z-10 w-full max-w-md rounded-sheet border border-white/10 bg-surface/80 p-6 shadow-raised backdrop-blur-xl md:p-8">
        <h1 className="font-statement text-title1 font-bold tracking-[-0.02em] text-zinc-50">Choose a new password</h1>
        {valid ? (
          <ResetPasswordForm email={email} token={token} />
        ) : (
          <>
            <p className="mt-3 text-body text-zinc-300">This reset link has expired or was already used.</p>
            <a href="/sign-in" className="mt-4 inline-block font-medium text-cyan-300 hover:underline underline-offset-4">
              Back to sign in to ask for a new one
            </a>
          </>
        )}
      </div>
    </AuroraBackground>
  );
}
