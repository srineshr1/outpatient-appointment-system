import { Skeleton } from "@/components/ui/Skeleton";

/** Placeholder cards in the same two-column grid as the doctor directory. */
export function DoctorCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <ul aria-hidden="true" className="grid gap-3 md:grid-cols-2 md:gap-4">
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className="rounded-sheet bg-surface p-5 shadow-card md:p-6">
          <div className="flex items-start gap-4">
            <Skeleton className="size-20 shrink-0 rounded-[28%]" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-6 w-3/5" />
              <Skeleton className="mt-2 h-5 w-2/5 rounded-full" />
              <Skeleton className="mt-2 h-4 w-3/4" />
            </div>
          </div>
          <Skeleton className="mt-4 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-5/6" />
          <div className="mt-5 flex items-center justify-between border-t border-hairline pt-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-5 w-20" />
          </div>
        </li>
      ))}
    </ul>
  );
}
