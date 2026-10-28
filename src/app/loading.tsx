import { DoctorCardsSkeleton } from "@/components/loading/DoctorCardsSkeleton";
import { LoadingRegion, Skeleton } from "@/components/ui/Skeleton";

/** The landing page while it loads: the hero, then the doctor cards. */
export default function Loading() {
  return (
    <LoadingRegion label="Loading the practice">
      <div aria-hidden="true">
        <div className="mx-auto grid max-w-page items-center gap-10 px-5 pt-10 pb-6 md:px-8 md:pt-16 lg:grid-cols-12 lg:gap-6">
          <div className="lg:order-2 lg:col-span-6">
            <Skeleton className="h-4 w-40 rounded-full" />
            <Skeleton className="mt-5 h-10 w-full max-w-md md:h-14" />
            <Skeleton className="mt-3 h-10 w-4/5 max-w-sm md:h-14" />
            <Skeleton className="mt-6 h-5 w-full max-w-prose" />
            <Skeleton className="mt-2 h-5 w-3/4 max-w-prose" />
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Skeleton className="h-12 w-full rounded-full sm:w-56" />
              <Skeleton className="h-12 w-full rounded-full sm:w-44" />
            </div>
          </div>
          <div className="mx-auto aspect-square w-full max-w-[30rem] lg:order-1 lg:col-span-6">
            <Skeleton className="size-full rounded-[18%]" />
          </div>
        </div>
        <div className="mx-auto max-w-page px-5 py-10 md:px-8">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="mt-3 mb-6 h-4 w-72 max-w-full" />
          <DoctorCardsSkeleton count={4} />
        </div>
      </div>
    </LoadingRegion>
  );
}
