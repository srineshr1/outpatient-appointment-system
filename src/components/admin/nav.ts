/** The admin console's sections and their tabs. Client-safe: no store access. */

export type SectionId = "overview" | "appointments" | "payments" | "people" | "activity" | "security";

export interface SectionDef {
  id: SectionId;
  label: string;
  href: string;
}

export const SECTIONS: readonly SectionDef[] = [
  { id: "overview", label: "Overview", href: "/admin" },
  { id: "appointments", label: "Appointments", href: "/admin/appointments" },
  { id: "payments", label: "Payments", href: "/admin/payments" },
  { id: "people", label: "People", href: "/admin/people" },
  { id: "activity", label: "Activity", href: "/admin/activity" },
  { id: "security", label: "Sign-in security", href: "/admin/security" },
];

export interface TabDef {
  href: string;
  label: string;
}

export const TABS: Readonly<Partial<Record<SectionId, readonly TabDef[]>>> = {
  payments: [
    { href: "/admin/payments", label: "Payments" },
    { href: "/admin/payments/invoices", label: "Visit fees" },
    { href: "/admin/payments/takings", label: "Daily takings" },
    { href: "/admin/payments/fees", label: "Fees" },
  ],
  people: [
    { href: "/admin/people", label: "Patients" },
    { href: "/admin/people/staff", label: "Staff" },
    { href: "/admin/people/new", label: "Add staff member" },
  ],
  security: [
    { href: "/admin/security", label: "Signed in" },
    { href: "/admin/security/attempts", label: "Sign-in attempts" },
    { href: "/admin/security/setup", label: "Setup" },
  ],
};

export function sectionOf(id: SectionId): SectionDef {
  return SECTIONS.find((section) => section.id === id) ?? SECTIONS[0]!;
}

export interface JumpTarget {
  href: string;
  label: string;
  /** Extra words that should find it. */
  keywords: string;
}

/** Everything the "Search or jump to" box can open directly. One entry per address. */
export const JUMP_TARGETS: readonly JumpTarget[] = dedupe([
  ...SECTIONS.map((section) => ({ href: section.href, label: section.label, keywords: "" })),
  ...Object.entries(TABS).flatMap(([id, tabs]) =>
    (tabs ?? [])
      .filter((tab) => tab.href !== sectionOf(id as SectionId).href)
      .map((tab) => ({ href: tab.href, label: `${sectionOf(id as SectionId).label} › ${tab.label}`, keywords: "" })),
  ),
  { href: "/admin/appointments?when=today", label: "Appointments › Today", keywords: "today clinic" },
  { href: "/admin/payments/takings", label: "Takings today", keywords: "cash card report collection money" },
  { href: "/admin/payments/invoices?money=owed", label: "Who still owes money", keywords: "unpaid due outstanding debt" },
  { href: "/admin/payments/invoices?money=refund_due", label: "Refunds to give back", keywords: "refund due" },
  { href: "/admin/people/new", label: "Add a staff member", keywords: "invite new doctor reception admin" },
  { href: "/dashboard", label: "Clinic book (every doctor)", keywords: "dashboard diary" },
  { href: "/", label: "Practice website", keywords: "home landing" },
]);

/** The first label for an address wins; later ones become extra search words. */
function dedupe(targets: readonly JumpTarget[]): JumpTarget[] {
  const byHref = new Map<string, JumpTarget>();
  for (const target of targets) {
    const existing = byHref.get(target.href);
    if (existing) existing.keywords = `${existing.keywords} ${target.label} ${target.keywords}`.trim();
    else byHref.set(target.href, { ...target });
  }
  return [...byHref.values()];
}
