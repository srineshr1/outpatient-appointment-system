"use client";

import { useEffect } from "react";
import { AuroraBackground } from "@/components/ui/AuroraBackground";
import { Button } from "@/components/ui/Button";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import { practice } from "@/lib/data";

export default function ErrorPage({
  error,
  reset,
  retry,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  retry?: () => void;
}) {
  useEffect(() => {
    // Hook point for an error reporter (Sentry, etc.). Never log patient details.
    console.error(error.digest ?? error.name);
  }, [error]);

  return (
    <AuroraBackground className="px-5 py-20 md:py-28">
      <div className="mx-auto max-w-xl">
        <SpotlightCard
          role="alert"
          spotlightColor="rgba(248, 113, 113, 0.12)"
          glowColor="rgba(248, 113, 113, 0.06)"
          className="p-8 text-center md:p-10"
        >
          <p className="inline-flex items-center rounded-full border border-red-400/25 bg-red-950/60 px-3 py-1 text-caption font-semibold text-red-200">
            Something went wrong
          </p>
          <h1 className="mt-4 text-title1 font-semibold text-ink">We couldn’t load this page</h1>
          <p className="mt-4 text-body text-ink-2">
            Nothing has been booked. Try again, or call the desk on{" "}
            <a href={practice.phoneHref} className="tabular font-medium text-cyan-300">
              {practice.phoneDisplay}
            </a>
            .
          </p>
          <Button size="lg" className="mt-8" onClick={() => (retry ? retry() : reset())}>
            Try again
          </Button>
        </SpotlightCard>
      </div>
    </AuroraBackground>
  );
}
