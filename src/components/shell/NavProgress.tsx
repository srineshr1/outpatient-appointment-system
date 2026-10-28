"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";

type Phase = "idle" | "running" | "done";

/** If a navigation never reports back (a link that didn't go anywhere), stop after this long. */
const GIVE_UP_MS = 15_000;

/**
 * A slim bar across the top of the page while a link or a GET form is taking the person somewhere
 * new. It starts the moment they click, so a slow server never looks like a dead link, and
 * finishes when the address changes. No dependency: it listens for clicks and form submits.
 */
export function NavProgress() {
  return (
    <Suspense fallback={null}>
      <Bar />
    </Suspense>
  );
}

function sameOriginTarget(url: URL): boolean {
  return url.origin === globalThis.location.origin;
}

function differsFromHere(url: URL): boolean {
  const here = globalThis.location;
  return url.pathname !== here.pathname || url.search !== here.search;
}

function Bar() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [phase, setPhase] = useState<Phase>("idle");
  const giveUp = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hide = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const start = useCallback(() => {
    clearTimeout(hide.current);
    clearTimeout(giveUp.current);
    setPhase("running");
    giveUp.current = setTimeout(() => setPhase("done"), GIVE_UP_MS);
  }, []);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || (anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return;
      let url: URL;
      try {
        url = new URL(anchor.href, globalThis.location.href);
      } catch {
        return;
      }
      if (!/^https?:$/.test(url.protocol) || !sameOriginTarget(url) || !differsFromHere(url)) return;
      start();
    }

    function onSubmit(event: SubmitEvent) {
      const form = event.target as HTMLFormElement | null;
      if (!form || (form.method || "get").toLowerCase() !== "get") return;
      const action = form.getAttribute("action") ?? "";
      if (!action || action.startsWith("javascript:")) return;
      try {
        const url = new URL(action, globalThis.location.href);
        url.search = new URLSearchParams(
          [...new FormData(form).entries()].filter((entry): entry is [string, string] => typeof entry[1] === "string"),
        ).toString();
        if (sameOriginTarget(url) && differsFromHere(url)) start();
      } catch {
        // Not a form we can read: leave it to the page's own feedback.
      }
    }

    document.addEventListener("click", onClick);
    document.addEventListener("submit", onSubmit);
    globalThis.addEventListener("popstate", start);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("submit", onSubmit);
      globalThis.removeEventListener("popstate", start);
    };
  }, [start]);

  // The address changed: the new page has arrived (or its loading skeleton has).
  useEffect(() => {
    setPhase((current) => (current === "running" ? "done" : current));
  }, [pathname, search]);

  useEffect(() => {
    if (phase !== "done") return;
    clearTimeout(giveUp.current);
    hide.current = setTimeout(() => setPhase("idle"), 400);
    return () => clearTimeout(hide.current);
  }, [phase]);

  useEffect(
    () => () => {
      clearTimeout(giveUp.current);
      clearTimeout(hide.current);
    },
    [],
  );

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-[3px]">
      <div
        data-nav-progress={phase}
        className={`h-full rounded-r-full bg-accent shadow-[0_0_8px_color-mix(in_srgb,var(--color-accent)_55%,transparent)] ${
          phase === "running"
            ? "[animation:nav-progress_9s_cubic-bezier(0.1,0.6,0.2,1)_forwards]"
            : phase === "done"
              ? "w-full opacity-0 transition-[width,opacity] duration-300 ease-out"
              : "w-0 opacity-0"
        }`}
      />
    </div>
  );
}
