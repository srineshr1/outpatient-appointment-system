import { LoadingRegion, Skeleton } from "@/components/ui/Skeleton";

/** A doctor's page while it loads: the profile, then the week of times. */
export default function Loading() {
  return (
    <LoadingRegion label="Loading this doctor’s times" className="mx-auto max-w-page px-5 pt-6 pb-16 md:px-8 md:pt-10">
      <div aria-hidden="true">
        <Skeleton className="h-6 w-28 rounded-full" />
        <div className="mt-4 flex items-start gap-4 md:gap-6">
          <Skeleton className="size-20 shrink-0 rounded-full md:size-24" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-8 w-64 max-w-full" />
            <Skeleton className="mt-3 h-4 w-80 max-w-full" />
            <Skeleton className="mt-2 h-4 w-60 max-w-full" />
          </div>
        </div>
        <div className="mt-10 flex items-end justify-between gap-4">
          <div>
            <Skeleton className="h-6 w-36" />
            <Skeleton className="mt-2 h-4 w-52" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="size-11 rounded-full" />
            <Skeleton className="size-11 rounded-full" />
          </div>
        </div>
        <div className="mt-5 grid gap-3">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="rounded-card bg-surface p-4 shadow-card md:flex md:gap-6 md:p-5">
              <Skeleton className="mb-3 h-5 w-40 md:mb-0 md:w-52 md:shrink-0" />
              <div className="flex flex-1 flex-wrap gap-2">
                {Array.from({ length: 6 }, (_, slot) => (
                  <Skeleton key={slot} className="h-11 w-20 rounded-full" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </LoadingRegion>
  );
}
