import { SECTIONS } from "@/components/admin/nav";
import { LoadingRegion, Skeleton } from "@/components/ui/Skeleton";
import { practice } from "@/lib/data";

/**
 * The admin console draws its own shell on every page, so while a page loads this shows the same
 * frame (the section list and the title bar) with grey content, and the console doesn't flash.
 */
export function AdminLoading({ variant, label }: { variant: "overview" | "table" | "detail"; label: string }) {
  return (
    <div className="min-h-dvh bg-canvas text-ink lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      <div aria-hidden="true" className="hidden border-r border-white/[0.08] bg-[#0c0c0f] lg:block">
        <div className="sticky top-0 flex h-dvh flex-col">
          <div className="flex items-center gap-2.5 px-5 pt-4 pb-5">
            <span className="grid size-8 place-items-center rounded-lg bg-cyan-400 bg-gradient-to-br from-cyan-400 to-blue-500 text-zinc-950 shadow-[0_0_14px_rgba(34,211,238,0.3)]">
              <svg width="15" height="15" viewBox="0 0 14 14" fill="currentColor">
                <path d="M5 1h4v4h4v4H9v4H5V9H1V5h4z" />
              </svg>
            </span>
            <span className="leading-tight">
              <span className="block truncate text-sm font-semibold text-ink">{practice.name}</span>
              <span className="block text-xs text-zinc-400">Admin console</span>
            </span>
          </div>
          <ul className="grid gap-0.5 px-2">
            {SECTIONS.map((section) => (
              <li key={section.id} className="flex min-h-10 items-center gap-2.5 rounded-lg px-2.5 text-sm text-zinc-400">
                <Skeleton className="size-4 bg-zinc-800" />
                {section.label}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="min-w-0">
        <div aria-hidden="true" className="sticky top-0 z-20 border-b border-white/[0.08] bg-zinc-950/80 backdrop-blur-xl">
          <div className="flex h-14 items-center gap-3 px-4 md:px-8">
            <Skeleton className="h-4 w-28 bg-zinc-800" />
          </div>
        </div>
        <LoadingRegion label={label} className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
          <div aria-hidden="true">
            <Skeleton className="h-8 w-56 bg-zinc-800" />
            <Skeleton className="mt-3 h-4 w-72 max-w-full bg-zinc-800" />
            <div className="mt-6">
              {variant === "overview" ? <OverviewBody /> : variant === "detail" ? <DetailBody /> : <TableBody />}
            </div>
          </div>
        </LoadingRegion>
      </div>
    </div>
  );
}

function Panel({ rows, className = "" }: { rows: number; className?: string }) {
  return (
    <div className={`rounded-xl border border-hairline bg-surface ${className}`}>
      <div className="border-b border-hairline px-4 py-3">
        <Skeleton className="h-5 w-40 bg-zinc-800" />
      </div>
      <div className="grid gap-3 p-4">
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton key={index} className="h-5 w-full bg-zinc-800" />
        ))}
      </div>
    </div>
  );
}

function OverviewBody() {
  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-hairline bg-hairline lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="bg-surface p-4">
            <Skeleton className="h-4 w-24 bg-zinc-800" />
            <Skeleton className="mt-3 h-6 w-16 bg-zinc-800" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel rows={5} />
        <Panel rows={5} />
      </div>
    </div>
  );
}

function TableBody() {
  return (
    <div className="grid gap-6">
      <div className="grid items-end gap-3 rounded-xl border border-hairline bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-9 w-full bg-zinc-800" />
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border border-hairline bg-surface">
        <div className="border-b border-hairline bg-zinc-900/90 px-4 py-3">
          <Skeleton className="h-4 w-1/3 bg-zinc-800" />
        </div>
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="flex items-center gap-4 border-b border-hairline px-4 py-3 last:border-b-0">
            <Skeleton className="h-4 w-1/4 bg-zinc-800" />
            <Skeleton className="h-4 w-1/5 bg-zinc-800" />
            <Skeleton className="hidden h-4 w-1/6 bg-zinc-800 sm:block" />
            <Skeleton className="ml-auto h-5 w-16 bg-zinc-800" />
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailBody() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Panel rows={6} className="lg:col-span-2" />
      <Panel rows={4} />
    </div>
  );
}
