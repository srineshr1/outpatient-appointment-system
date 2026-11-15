"use client";

import { useState, useTransition } from "react";
import { buttonClass } from "@/components/ui/button-styles";
import { signInAsDemo } from "@/server/auth-actions";

/** Small one-click demo sign-in, pinned to the bottom of the page. */
export function DemoLoginButtons({
  nextPath = "/",
  appearance = "solid",
}: {
  nextPath?: string;
  /** Quiet text buttons for the sign-in screen. Solid matches the landing page. */
  appearance?: "solid" | "minimal";
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const minimal = appearance === "minimal";

  function signIn(who: "patient" | "doctor") {
    setError(null);
    startTransition(async () => {
      const result = await signInAsDemo({ who, next: nextPath });
      if (!result.ok) setError(result.error);
    });
  }

  const quiet =
    "h-8 rounded-full border border-hairline bg-surface/70 px-3.5 text-footnote font-medium text-ink-2 backdrop-blur-sm transition-colors hover:border-control/70 hover:text-ink disabled:opacity-50";

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-3 z-30 flex justify-center px-4">
      <div className="pointer-events-auto flex flex-col items-center gap-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={minimal ? quiet : buttonClass("secondary", "sm")}
            disabled={pending}
            onClick={() => signIn("patient")}
          >
            Patient
          </button>
          <button
            type="button"
            className={minimal ? quiet : buttonClass("primary", "sm")}
            disabled={pending}
            onClick={() => signIn("doctor")}
          >
            Doctor
          </button>
        </div>
        {error ? (
          <p role="alert" className="text-caption text-red-700 dark:text-red-300">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
