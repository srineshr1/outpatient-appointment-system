import Link from "next/link";
import { AuroraBackground } from "@/components/ui/AuroraBackground";
import { buttonClass } from "@/components/ui/button-styles";
import { GradientBadge } from "@/components/ui/GradientBadge";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import { practice } from "@/lib/data";

export default function NotFound() {
  return (
    <AuroraBackground className="px-5 py-20 md:py-28">
      <div className="mx-auto max-w-xl">
        <SpotlightCard className="p-8 text-center md:p-10">
          <div className="flex justify-center">
            <GradientBadge>Page not found</GradientBadge>
          </div>
          <h1 className="mt-4 text-title1 font-semibold text-ink">We can’t find that page</h1>
          <p className="mt-4 text-body text-ink-2">
            The link may be out of date, or the doctor may no longer take online bookings. You can still book with
            anyone on the list, or call the desk on{" "}
            <a href={practice.phoneHref} className="tabular font-medium text-accent dark:text-cyan-300">
              {practice.phoneDisplay}
            </a>
            .
          </p>
          <Link href="/" className={buttonClass("primary", "lg", "mt-8")}>
            See all doctors
          </Link>
        </SpotlightCard>
      </div>
    </AuroraBackground>
  );
}
