"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Phone } from "@/components/icons";
import { StepIndicator } from "@/components/ui/StepIndicator";
import { practice } from "@/lib/data";

export function stepFor(pathname: string): number | null {
  if (pathname === "/") return 0;
  if (pathname.startsWith("/doctors/")) return 1;
  if (pathname === "/book/details") return 2;
  if (pathname === "/book/confirmed") return 3;
  return null;
}

export function SiteHeader() {
  const pathname = usePathname();
  const step = stepFor(pathname);

  return (
    <header className="sticky top-0 z-30 border-b border-black/[0.06] bg-canvas/80 backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto max-w-page px-5 md:px-8">
        <div className="flex h-14 items-center justify-between gap-4">
          <Link href="/" className="group -mx-2 flex items-center gap-2.5 rounded-lg px-2 py-1">
            <span
              aria-hidden="true"
              className="grid size-7 place-items-center rounded-[8px] bg-accent text-white transition-transform duration-200 group-active:scale-95"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <path d="M5 1h4v4h4v4H9v4H5V9H1V5h4z" />
              </svg>
            </span>
            <span className="text-body font-semibold tracking-tight text-ink">
              {practice.shortName}
              <span className="font-normal text-muted"> Practice</span>
            </span>
          </Link>
          <a
            href={practice.phoneHref}
            aria-label={`Call the practice on ${practice.phoneDisplay}`}
            className="tabular inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-callout font-medium text-accent transition-colors hover:bg-accent-soft"
          >
            <Phone size={18} />
            <span className="hidden sm:inline">{practice.phoneDisplay}</span>
          </a>
        </div>
        {step !== null ? (
          <div className="pb-3">
            <StepIndicator current={step} />
          </div>
        ) : null}
      </div>
    </header>
  );
}
