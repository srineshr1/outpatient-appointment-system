import { LoadingRegion, Skeleton } from "@/components/ui/Skeleton";

/** The details form while it loads: the form on the left, the summary on the right. */
export default function Loading() {
  return (
    <LoadingRegion label="Loading your details" className="mx-auto max-w-page px-5 pt-8 pb-20 md:px-8 md:pt-12">
      <div aria-hidden="true">
        <Skeleton className="h-9 w-64 max-w-full" />
        <Skeleton className="mt-3 h-5 w-80 max-w-full" />
        <div className="mt-8 grid gap-8 lg:grid-cols-12">
          <div className="grid gap-6 lg:col-span-7">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index}>
                <Skeleton className="h-4 w-28" />
                <Skeleton className="mt-2 h-12 w-full rounded-field" />
              </div>
            ))}
            <Skeleton className="h-12 w-full rounded-full sm:w-56" />
          </div>
          <div className="rounded-card bg-surface p-5 shadow-card lg:col-span-5">
            <div className="flex items-center gap-4">
              <Skeleton className="size-12 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-5 w-3/5" />
                <Skeleton className="mt-2 h-4 w-2/5" />
              </div>
            </div>
            <Skeleton className="mt-5 h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-3/4" />
          </div>
        </div>
      </div>
    </LoadingRegion>
  );
}
