import Link from "next/link";
import { buttonClass } from "@/components/ui/button-styles";
import { practice } from "@/lib/data";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-prose px-5 py-24 text-center md:py-32">
      <p className="text-callout font-semibold text-muted">Page not found</p>
      <h1 className="mt-2 text-title1 font-semibold text-ink">We can’t find that page</h1>
      <p className="mt-4 text-body text-ink-2">
        The link may be out of date, or the doctor may no longer take online bookings. You can still book with
        anyone on the list, or call the desk on{" "}
        <a href={practice.phoneHref} className="tabular text-accent">
          {practice.phoneDisplay}
        </a>
        .
      </p>
      <Link href="/" className={buttonClass("primary", "lg", "mt-8")}>
        See all doctors
      </Link>
    </div>
  );
}
