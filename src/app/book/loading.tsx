import { DoctorCardsSkeleton } from "@/components/loading/DoctorCardsSkeleton";
import { LoadingRegion, Skeleton } from "@/components/ui/Skeleton";

/** The doctor picker while it loads: the greeting, the search bar, then the cards. */
export default function Loading() {
  return (
    <LoadingRegion label="Loading doctors" className="pb-20">
      <div aria-hidden="true">
        <div className="border-b border-hairline bg-canvas">
          <div className="mx-auto max-w-page px-5 py-4 md:px-8 md:py-5">
            <Skeleton className="h-7 w-72 max-w-full md:h-8" />
            <Skeleton className="mt-4 h-11 w-full rounded-full lg:max-w-sm" />
          </div>
        </div>
        <div className="mx-auto grid max-w-page gap-6 px-5 pt-6 md:px-8">
          <Skeleton className="h-5 w-full max-w-prose" />
          <DoctorCardsSkeleton count={4} />
        </div>
      </div>
    </LoadingRegion>
  );
}
