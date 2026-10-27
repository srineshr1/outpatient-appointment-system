import Link from "next/link";
import type { ComponentType, ReactNode, SVGProps } from "react";
import { CommandPalette } from "@/components/admin/CommandPalette";
import { DoneNotice } from "@/components/admin/DoneNotice";
import {
  ActivityIcon,
  CalendarIcon,
  ExternalIcon,
  GridIcon,
  PeopleIcon,
  PoundIcon,
  ShieldIcon,
} from "@/components/admin/icons";
import { MobileMenu } from "@/components/admin/MobileMenu";
import { SECTIONS, sectionOf, type SectionId } from "@/components/admin/nav";
import type { NavCounts } from "@/lib/admin-data";
import type { SessionUser } from "@/lib/clinic-types";
import { practice } from "@/lib/data";
import { monogram } from "@/lib/format";
import { signOutAction } from "@/server/auth-actions";

type IconComponent = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;

const ICONS: Record<SectionId, IconComponent> = {
  overview: GridIcon,
  appointments: CalendarIcon,
  payments: PoundIcon,
  people: PeopleIcon,
  activity: ActivityIcon,
  security: ShieldIcon,
};

/** The number beside a section, and what it counts, for screen readers. */
function countFor(id: SectionId, counts: NavCounts): { value: number; label: string; tone: "plain" | "warn" } | null {
  if (id === "appointments") return { value: counts.appointments, label: "today", tone: "plain" };
  if (id === "payments") return counts.payments > 0 ? { value: counts.payments, label: "to settle", tone: "warn" } : null;
  if (id === "people") return { value: counts.people, label: "accounts", tone: "plain" };
  if (id === "security") return counts.security > 0 ? { value: counts.security, label: "with failed sign-ins", tone: "warn" } : null;
  return null;
}

function SectionNav({ current, counts, label }: { current: SectionId; counts: NavCounts; label: string }) {
  return (
    <nav aria-label={label} className="px-2">
      <ul className="grid gap-0.5">
        {SECTIONS.map((section) => {
          const Icon = ICONS[section.id];
          const count = countFor(section.id, counts);
          const active = section.id === current;
          return (
            <li key={section.id}>
              <Link
                href={section.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-9 items-center gap-2.5 rounded-md px-2.5 text-sm no-underline transition-colors ${
                  active ? "bg-[#d7e6ef] font-semibold text-ink" : "text-ink hover:bg-black/5"
                }`}
              >
                <Icon size={18} className={active ? "text-accent" : "text-ink-2"} />
                <span className="flex-1">{section.label}</span>
                {count ? (
                  <span
                    className={`rounded px-1.5 text-xs font-medium tabular-nums ${
                      count.tone === "warn" ? "bg-[#fff0d5] text-[#774b06]" : "text-ink-2"
                    }`}
                  >
                    <span className="sr-only">, </span>
                    {count.value}
                    <span className="sr-only"> {count.label}</span>
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Brand() {
  return (
    <Link href="/admin" className="flex items-center gap-2.5 rounded-md px-2 py-1 no-underline">
      <span aria-hidden="true" className="grid size-8 place-items-center rounded-lg bg-accent text-white">
        <svg width="15" height="15" viewBox="0 0 14 14" fill="currentColor">
          <path d="M5 1h4v4h4v4H9v4H5V9H1V5h4z" />
        </svg>
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-sm font-semibold text-ink">{practice.name}</span>
        <span className="block text-xs text-ink-2">Admin console</span>
      </span>
    </Link>
  );
}

function AccountFooter({ admin }: { admin: SessionUser }) {
  return (
    <div className="mt-auto border-t border-[#d4e0e7] p-3">
      <div className="flex items-center gap-2.5 px-1">
        <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-xs font-semibold text-ink-2">
          {monogram(admin.name)}
        </span>
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-sm font-medium text-ink">{admin.name}</span>
          <span className="block truncate text-xs text-ink-2">{admin.email}</span>
        </span>
      </div>
      <div className="mt-3 grid gap-1">
        <Link href="/" className="flex min-h-9 items-center gap-2 rounded-md px-2.5 text-sm text-ink no-underline hover:bg-black/5">
          <ExternalIcon size={16} className="text-ink-2" />
          Practice website
        </Link>
        <form action={signOutAction}>
          <button type="submit" className="flex min-h-9 w-full items-center rounded-md px-2.5 text-left text-sm text-ink hover:bg-black/5">
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}

export interface ShellTab {
  href: string;
  label: string;
  count?: number;
}

interface AdminShellProps {
  admin: SessionUser;
  section: SectionId;
  /** The page's own name, after the section in the breadcrumb. */
  crumb?: string;
  tabs?: readonly ShellTab[];
  /** The href of the tab for this page. */
  activeTab?: string;
  counts: NavCounts;
  /** Confirmation after an action, from the `done` query value. */
  notice?: string | null;
  children: ReactNode;
}

export function AdminShell({ admin, section, crumb, tabs, activeTab, counts, notice, children }: AdminShellProps) {
  const current = sectionOf(section);
  return (
    <div className="min-h-dvh bg-surface text-ink lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      <a
        href="#admin-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-ink focus:px-4 focus:py-2.5 focus:text-sm focus:font-medium focus:text-white"
      >
        Skip to page content
      </a>

      <div className="hidden border-r border-[#d4e0e7] bg-[#edf5f9] lg:block print:hidden">
        <div className="sticky top-0 flex h-dvh flex-col overflow-y-auto">
          <div className="px-3 pt-4 pb-5">
            <Brand />
          </div>
          <SectionNav current={section} counts={counts} label="Admin" />
          <AccountFooter admin={admin} />
        </div>
      </div>

      <div className="min-w-0">
        <div className="sticky top-0 z-20 border-b border-hairline bg-surface/95 backdrop-blur print:hidden">
          <div className="flex h-14 items-center gap-3 px-4 md:px-8">
            <MobileMenu>
              <div className="px-3 pb-5">
                <Brand />
              </div>
              <SectionNav current={section} counts={counts} label="Admin (menu)" />
              <AccountFooter admin={admin} />
            </MobileMenu>
            <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
              <ol className="flex items-center gap-2 text-sm">
                <li className={crumb ? "hidden min-w-0 sm:block" : "min-w-0"}>
                  {crumb ? (
                    <Link href={current.href} className="truncate text-ink-2 no-underline hover:text-ink hover:underline underline-offset-4">
                      {current.label}
                    </Link>
                  ) : (
                    <span aria-current="page" className="truncate font-medium text-ink">
                      {current.label}
                    </span>
                  )}
                </li>
                {crumb ? (
                  <li className="flex min-w-0 items-center gap-2">
                    <span aria-hidden="true" className="hidden text-muted sm:inline">
                      ›
                    </span>
                    <span aria-current="page" className="truncate font-medium text-ink">
                      {crumb}
                    </span>
                  </li>
                ) : null}
              </ol>
            </nav>
            <p className="hidden items-center gap-1.5 rounded-md border border-hairline px-2 py-1 text-xs text-ink-2 xl:flex">
              Acting as
              <span className="rounded bg-[#e8f1fb] px-1.5 py-0.5 font-medium text-[#0b4f8a]">Admin</span>
              <span className="max-w-40 truncate font-medium text-ink">{admin.name}</span>
            </p>
            <CommandPalette />
          </div>
        </div>

        {tabs && tabs.length > 0 ? (
          <div className="border-b border-hairline px-4 md:px-8 print:hidden">
            <nav aria-label={`${current.label} pages`} className="relative -mb-px overflow-x-auto [scrollbar-width:none]">
              <ul className="flex gap-1">
                {tabs.map((tab) => {
                  const active = tab.href === activeTab;
                  return (
                    <li key={tab.href} className="shrink-0">
                      <Link
                        href={tab.href}
                        aria-current={active ? "page" : undefined}
                        className={`inline-flex min-h-11 items-center gap-2 border-b-2 px-2 text-sm font-medium no-underline transition-colors ${
                          active ? "border-accent text-ink" : "border-transparent text-ink-2 hover:border-hairline hover:text-ink"
                        }`}
                      >
                        {tab.label}
                        {tab.count !== undefined ? (
                          <span className="rounded bg-fill px-1.5 text-xs text-ink-2 tabular-nums">
                            <span className="sr-only">, </span>
                            {tab.count}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>
        ) : null}

        <div id="admin-content" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-6 outline-none md:px-8 md:py-8">
          {notice ? <DoneNotice message={notice} /> : null}
          {children}
        </div>
      </div>
    </div>
  );
}
