import { LoadingRegion, Skeleton } from "@/components/ui/Skeleton";

/** The sign-in page while it loads: the welcome on the left, the email box on the right. */
export default function Loading() {
  return (
    <LoadingRegion label="Loading sign-in" className="grid min-h-dvh place-items-center bg-surface px-5 py-12">
      <div aria-hidden="true" className="grid w-full max-w-3xl items-center gap-10 md:grid-cols-2 md:gap-16">
        <div className="flex flex-col items-center md:items-start">
          <Skeleton className="size-11 rounded-xl" />
          <Skeleton className="mt-6 h-10 w-64 max-w-full" />
          <Skeleton className="mt-3 h-6 w-44" />
        </div>
        <div className="w-full">
          <Skeleton className="h-14 w-full rounded-full" />
          <Skeleton className="my-4 h-3 w-full" />
          <Skeleton className="h-14 w-full rounded-full" />
        </div>
      </div>
    </LoadingRegion>
  );
}
