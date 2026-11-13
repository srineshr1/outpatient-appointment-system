"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Calendar, ClipboardList, Sliders, UserCircle } from "@/components/icons";
import { Dock, type DockItemData } from "@/components/reactbits/Dock";

export interface DoctorDockCounts {
  todayVisits: number;
  activeSessions: number;
  pendingAlerts: number;
}

export function DoctorDock({ counts }: { counts: DoctorDockCounts }) {
  const pathname = usePathname();

  const items: DockItemData[] = [
    {
      href: "/dashboard",
      label: "Clinic book",
      ariaLabel: `Clinic book (${counts.todayVisits} today)`,
      icon: <ClipboardList size={20} />,
      active: pathname === "/dashboard",
      badge: counts.todayVisits > 0 ? counts.todayVisits : undefined,
    },
    {
      href: "/dashboard/sessions",
      label: "View schedule",
      ariaLabel: `View schedule (${counts.activeSessions} sessions)`,
      icon: <Calendar size={20} />,
      active: pathname === "/dashboard/sessions",
      badge: counts.activeSessions > 0 ? counts.activeSessions : undefined,
    },
    {
      href: "/dashboard/sessions/manage",
      label: "Edit sessions",
      ariaLabel: "Edit sessions",
      icon: <Sliders size={20} />,
      active: pathname === "/dashboard/sessions/manage",
    },
    {
      href: "/dashboard/profile",
      label: "Profile",
      ariaLabel: "Doctor profile",
      icon: <UserCircle size={20} />,
      active: pathname === "/dashboard/profile",
    },
    {
      href: "/dashboard/notifications",
      label: "Alerts",
      ariaLabel: "Notification alerts",
      icon: <Bell size={20} />,
      active: pathname === "/dashboard/notifications",
      badge: counts.pendingAlerts > 0 ? counts.pendingAlerts : undefined,
    },
  ];

  return (
    <>
      {/* Desktop & tablet floating React Bits Dock — centered to clear the bottom-right AssistantDock */}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-30 hidden justify-center px-24 sm:flex">
        <Dock
          items={items}
          ariaLabel="Doctor workspace dock"
          panelHeight={64}
          baseItemSize={44}
          magnification={60}
          distance={140}
        />
      </div>

      {/* Compact mobile React Bits dock bar */}
      <nav
        aria-label="Doctor workspace dock"
        className="fixed inset-x-3 bottom-3 z-30 flex items-center justify-between gap-1 rounded-2xl border border-hairline bg-surface/92 px-2 py-1.5 shadow-float backdrop-blur-xl sm:hidden"
      >
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href!}
            aria-current={item.active ? "page" : undefined}
            className={`relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[11px] font-medium no-underline transition-colors ${
              item.active ? "bg-accent-soft text-accent" : "text-ink-2 hover:bg-fill hover:text-ink"
            }`}
          >
            <span className="relative">
              {item.icon}
              {item.badge ? (
                <span className="tabular absolute -top-1 -right-2 rounded-full bg-accent px-1 text-[9px] leading-tight font-bold text-accent-ink">
                  {item.badge}
                </span>
              ) : null}
            </span>
            <span className="max-w-full truncate">{item.label.split(" ")[0]}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
