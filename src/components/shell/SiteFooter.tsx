import { practice } from "@/lib/data";

export function SiteFooter() {
  return (
    <footer className="relative border-t border-hairline bg-canvas">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent"
      />
      <div className="mx-auto grid max-w-page gap-6 px-5 py-10 text-callout text-zinc-400 md:grid-cols-3 md:px-8">
        <div>
          <p className="font-semibold text-zinc-100">{practice.name}</p>
          <p className="mt-1">{practice.address}</p>
        </div>
        <div>
          <p>{practice.hours}</p>
          <p className="mt-1">
            Desk:{" "}
            <a href={practice.phoneHref} className="tabular font-medium text-cyan-300 hover:underline underline-offset-4">
              {practice.phoneDisplay}
            </a>
          </p>
        </div>
        <div>
          <p>
            <span className="font-semibold text-zinc-100">In an emergency, call 999.</span> If it’s urgent but not
            life-threatening, call NHS 24 on{" "}
            <a href="tel:111" className="font-medium text-cyan-300 hover:underline underline-offset-4">
              111
            </a>
            .
          </p>
        </div>
      </div>
    </footer>
  );
}
