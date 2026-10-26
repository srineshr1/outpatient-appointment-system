"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { practice } from "@/lib/data";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Hook point for an error reporter (Sentry, etc.). Never log patient details.
    console.error(error.digest ?? error.name);
  }, [error]);

  return (
    <div className="mx-auto max-w-prose px-5 py-24 text-center md:py-32" role="alert">
      <p className="text-callout font-semibold text-muted">Something went wrong</p>
      <h1 className="mt-2 text-title1 font-semibold text-ink">We couldn’t load this page</h1>
      <p className="mt-4 text-body text-ink-2">
        Nothing has been booked. Try again, or call the desk on{" "}
        <a href={practice.phoneHref} className="tabular text-accent">
          {practice.phoneDisplay}
        </a>
        .
      </p>
      <Button size="lg" className="mt-8" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
