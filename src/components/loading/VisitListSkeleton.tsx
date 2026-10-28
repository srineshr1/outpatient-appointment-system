import { LoadingRegion, Skeleton } from "@/components/ui/Skeleton";

/** A list of visit cards, as on Your appointments and the clinic book. */
export function VisitListSkeleton({ label, filters = false }: { label: string; filters?: boolean }) {
  return (
    <LoadingRegion label={label} className="mx-auto max-w-page px-5 pt-8 pb-20 md:px-8 md:pt-12">
      <div aria-hidden="true">
        <Skeleton className="h-9 w-64 max-w-full" />
        <Skeleton className="mt-3 h-5 w-96 max-w-full" />
        {filters ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-11 w-28 rounded-full" />
            ))}
          </div>
        ) : null}
        <div className="mt-8 grid gap-10">
          <section>
            <Skeleton className="h-6 w-32" />
            <ul className="mt-4 grid gap-3">
              {Array.from({ length: 3 }, (_, index) => (
                <li key={index} className="rounded-card bg-surface p-5 shadow-card">
                  <div className="flex items-baseline justify-between gap-2">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <Skeleton className="mt-3 h-4 w-3/4" />
                  <Skeleton className="mt-3 h-4 w-1/2" />
                  <div className="mt-4 flex gap-2">
                    <Skeleton className="h-11 w-36 rounded-full" />
                    <Skeleton className="h-11 w-28 rounded-full" />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </LoadingRegion>
  );
}
