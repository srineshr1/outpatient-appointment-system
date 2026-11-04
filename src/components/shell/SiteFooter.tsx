import { practice } from "@/lib/data";

export function SiteFooter() {
  return (
    <footer className="border-t border-hairline">
      <div className="mx-auto grid max-w-page gap-6 px-5 py-10 text-callout text-muted md:grid-cols-3 md:px-8">
        <div>
          <p className="font-semibold text-ink">{practice.name}</p>
          <p className="mt-1">{practice.address}</p>
        </div>
        <div>
          <p>{practice.hours}</p>
          <p className="mt-1">
            Desk:{" "}
            <a href={practice.phoneHref} className="tabular text-accent hover:underline underline-offset-4">
              {practice.phoneDisplay}
            </a>
          </p>
        </div>
        <div>
          <p>
            <span className="font-semibold text-ink">In an emergency, call 999.</span> If it’s urgent but not
            life-threatening, call NHS 24 on{" "}
            <a href="tel:111" className="text-accent hover:underline underline-offset-4">
              111
            </a>
            .
          </p>
        </div>
      </div>
    </footer>
  );
}
