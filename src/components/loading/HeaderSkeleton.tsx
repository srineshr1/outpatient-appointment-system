import { Skeleton } from "@/components/ui/Skeleton";
import { practice } from "@/lib/data";

/** The site header's frame while it finds out who is signed in. Same height, so nothing jumps. */
export function HeaderSkeleton() {
  const descriptor = practice.name.replace(practice.shortName, "").trim();
  return (
    <header className="sticky top-0 z-40 bg-surface/85 shadow-[0_1px_0_rgb(0_0_0/0.08)] backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex h-(--header-h) max-w-page items-center gap-2 px-5 md:gap-8 md:px-8">
        <span className="flex items-center gap-2.5">
          <span aria-hidden="true" className="grid size-8 place-items-center rounded-[9px] bg-accent text-white md:size-9 md:rounded-[10px]">
            <svg width="15" height="15" viewBox="0 0 14 14" fill="currentColor">
              <path d="M5 1h4v4h4v4H9v4H5V9H1V5h4z" />
            </svg>
          </span>
          <span className="flex flex-col">
            <span className="text-[1.0625rem] leading-[1.15] font-bold tracking-[-0.015em] text-ink">{practice.shortName}</span>
            {descriptor ? (
              <span className="text-[0.6875rem] leading-[1.25] font-semibold tracking-[0.07em] text-muted uppercase">{descriptor}</span>
            ) : null}
          </span>
        </span>
        <div aria-hidden="true" className="ml-auto flex items-center gap-2">
          <Skeleton className="h-9 w-20 rounded-full" />
        </div>
      </div>
    </header>
  );
}
