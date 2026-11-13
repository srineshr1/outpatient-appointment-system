"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type RefObject,
} from "react";
import { Bell, Check, ChevronDown, ChevronRight, Close, Menu, Phone, SignOut } from "@/components/icons";
import { useBooking } from "@/components/providers/BookingProvider";
import { useTheme } from "@/components/providers/ThemeProvider";
import { GLIDE_EASE_TUPLE, useGlidePill } from "@/components/reactbits/GlideSelect";
import { RubberSegment } from "@/components/reactbits/RubberSegment";
import { buttonClass } from "@/components/ui/button-styles";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { homeFor } from "@/lib/auth-routing";
import type { PublicUser } from "@/lib/clinic-types";
import { practice, findDoctor } from "@/lib/data";
import { spring } from "@/lib/motion";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { signOutAction } from "@/server/auth-actions";

type HeaderUser = Pick<PublicUser, "name" | "email" | "role" | "doctorId"> & Partial<Pick<PublicUser, "id">>;
type LinkUser = Pick<PublicUser, "role"> & Partial<Pick<PublicUser, "id" | "doctorId">>;

/** A doctor with their own clinic book: they set up their own profile and sessions. */
function keepsOwnBook(user: LinkUser): boolean {
  return user.role === "doctor" && Boolean(user.id) && user.doctorId === user.id;
}

export interface NavLink {
  href: string;
  label: string;
  tag?: string;
}

/** The main links for whoever is signed in. Roles the header doesn't know get the clinic book. */
export function navLinks(user: LinkUser | null): NavLink[] {
  if (!user) {
    return [
      { href: "/#doctors", label: "Our doctors" },
      { href: "/#how-it-works", label: "How it works" },
    ];
  }
  if (user.role === "patient") {
    return [
      { href: "/book", label: "Book a visit" },
      { href: "/appointments", label: "Appointments" },
    ];
  }
  if (user.role === "admin") {
    return [
      { href: "/admin", label: "Admin console" },
      { href: "/dashboard", label: "Clinic book" },
    ];
  }
  if (keepsOwnBook(user)) {
    return [
      { href: "/dashboard", label: "Clinic book" },
      { href: "/dashboard/sessions", label: "View sessions" },
      { href: "/dashboard/sessions/manage", label: "Edit sessions" },
    ];
  }
  return [{ href: "/dashboard", label: "Clinic book" }];
}

/** Links in the account menu: the account's own pages. */
export function accountLinks(user: LinkUser): NavLink[] {
  if (user.role === "admin") return [{ href: "/admin", label: "Admin console", tag: "Manage" }];
  if (user.role === "patient") {
    return [
      { href: "/appointments", label: "Your appointments", tag: "Visits" },
      { href: "/payments", label: "Payments and refunds", tag: "Billing" },
      { href: "/profile", label: "Your profile", tag: "Details" },
    ];
  }
  return keepsOwnBook(user)
    ? [
        { href: "/dashboard/profile", label: "Your profile", tag: "Bio" },
        { href: "/dashboard/notifications", label: "Email alerts", tag: "Prefs" },
      ]
    : [];
}

/**
 * aria-current for a nav link: "page" on its own page, "true" further into its section (choosing a
 * time and filling in the form are part of booking), otherwise nothing.
 */
export function currentFor(href: string, pathname: string): "page" | "true" | undefined {
  if (href.includes("#")) return undefined;
  if (pathname === href) return "page";
  if (href === "/book" && (pathname.startsWith("/book/") || pathname.startsWith("/doctors/"))) return "true";
  return undefined;
}

const ROLE_LABELS: Record<string, string> = {
  patient: "Patient",
  doctor: "Doctor",
  reception: "Reception",
  admin: "Practice admin",
};

export function roleLabel(user: Pick<PublicUser, "role" | "doctorId">): string {
  const role = String(user.role);
  const base = ROLE_LABELS[role] ?? role.charAt(0).toUpperCase() + role.slice(1);
  const doctor = user.doctorId ? findDoctor(user.doctorId) : undefined;
  return doctor ? `${base} · ${doctor.room}` : base;
}

/** "Ann Lee" → "AL", "Dr Helen Cho" → "HC". Falls back to the email's first letter. */
export function initialsFor(name: string, email = ""): string {
  const words = name
    .trim()
    .replace(/^(dr|mr|mrs|ms|miss|mx|prof)\.?\s+/i, "")
    .split(/\s+/)
    .filter(Boolean);
  const picked = words.length > 1 ? [words[0]!, words[words.length - 1]!] : words;
  const initials = picked.map((word) => word.charAt(0)).join("").toUpperCase();
  return initials || email.charAt(0).toUpperCase() || "?";
}

/** While `open`: Escape closes and returns focus to the button; a press outside `root` closes. */
function useDismiss(open: boolean, close: (refocus: boolean) => void, root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (event.target instanceof Node && root.current?.contains(event.target)) return;
      close(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      // Handled here, so page-level Escape shortcuts (Details goes back a step) leave it alone.
      event.preventDefault();
      close(true);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close, root]);
}

/** Close when focus moves to something outside `event.currentTarget` (tabbing out of the menu). */
function leftBy(event: FocusEvent<HTMLElement>): boolean {
  const next = event.relatedTarget;
  return next instanceof Node && !event.currentTarget.contains(next);
}

export function SiteHeader({ user, unread = 0 }: { user: HeaderUser | null; unread?: number }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme } = useTheme();
  const { dispatch } = useBooking();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [openedOn, setOpenedOn] = useState(pathname);
  // Arriving on a new page closes whatever was open.
  if (openedOn !== pathname) {
    setOpenedOn(pathname);
    setMenuOpen(false);
    setAccountOpen(false);
  }

  const headerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const closeMenu = useCallback((refocus: boolean) => {
    setMenuOpen(false);
    if (refocus) menuButtonRef.current?.focus();
  }, []);
  useDismiss(menuOpen, closeMenu, headerRef);

  const links = navLinks(user);
  const activeHref = links.find((link) => currentFor(link.href, pathname) !== undefined)?.href ?? "";
  const homeHref = user ? homeFor(user.role) : "/";
  const onAuthPage = pathname === "/sign-in" || pathname === "/register";
  // Come back to the same page after signing in. A held time on /doctors/* survives in sessionStorage.
  const signInHref = pathname === "/" || onAuthPage ? "/sign-in" : `/sign-in?next=${encodeURIComponent(pathname)}`;
  const bookHref = `/sign-in?next=${encodeURIComponent("/book")}`;
  const displayName = user ? user.name.trim() || user.email : "";
  const showPracticePhone = !user || user.role === "patient";
  // Forget any half-filled form, so the next person on this device starts clean.
  const forgetBooking = () => dispatch({ type: "startOver" });

  return (
    <>
      <header
        ref={headerRef}
        onBlur={(event) => {
          if (menuOpen && leftBy(event)) setMenuOpen(false);
        }}
        className="sticky top-0 z-40 border-b border-hairline bg-canvas/90 backdrop-blur-md"
      >
        <div className="mx-auto flex h-(--header-h) max-w-page items-center gap-1.5 px-3 min-[360px]:gap-2 min-[400px]:px-5 md:gap-4 md:px-6 lg:gap-8 lg:px-8">
          <Brand href={homeHref} />

          <div className="hidden min-w-0 md:block">
            <RubberSegment
              aria-label="Main"
              items={links.map((link) => ({
                value: link.href,
                label: link.label,
                href: link.href,
                "aria-current": currentFor(link.href, pathname),
              }))}
              value={activeHref}
              onChange={(href) => router.push(href)}
              equalSlots={false}
              size="md"
              radius={999}
              inset={3}
              trackColor="var(--v-surface-2)"
              thumbColor="var(--v-ink)"
              textColor="var(--v-ink)"
              activeTextColor="var(--v-canvas)"
              className="border border-hairline shadow-xs"
            />
          </div>

          <div className="ml-auto flex items-center gap-1 min-[360px]:gap-1.5 md:gap-2">
            {showPracticePhone ? (
              <a
                href={practice.phoneHref}
                aria-label={`Call the practice on ${practice.phoneDisplay}`}
                className={`tabular size-9 items-center justify-center gap-2 rounded-full text-callout font-medium whitespace-nowrap text-ink-2 transition-colors hover:bg-fill hover:text-ink min-[480px]:size-10 md:size-10 lg:w-auto lg:px-3 ${
                  user ? "inline-flex" : "hidden lg:inline-flex"
                }`}
              >
                <Phone size={18} />
                <span className="hidden lg:inline">{practice.phoneDisplay}</span>
              </a>
            ) : null}

            {user ? (
              <Link
                href="/inbox"
                aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
                aria-current={pathname === "/inbox" ? "page" : undefined}
                className="relative inline-flex size-9 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-fill hover:text-ink min-[480px]:size-10 md:size-10"
              >
                <Bell size={19} />
                {unread > 0 ? (
                  <span
                    aria-hidden="true"
                    className="tabular absolute top-0.5 right-0 inline-flex min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[11px] leading-[18px] font-bold text-accent-ink min-[480px]:top-1 min-[480px]:right-0.5"
                  >
                    {unread > 99 ? "99+" : unread}
                  </span>
                ) : null}
              </Link>
            ) : null}

            <ThemeToggle className="size-9! md:size-10!" />

            {user ? (
              <AccountMenu
                user={user}
                name={displayName}
                open={accountOpen}
                setOpen={setAccountOpen}
                onSignOut={forgetBooking}
              />
            ) : onAuthPage ? null : (
              <>
                <Link
                  href={signInHref}
                  className="inline-flex min-h-11 items-center rounded-full px-2.5 text-callout font-medium text-ink-2 transition-colors hover:bg-fill hover:text-ink max-[359px]:hidden min-[400px]:px-3"
                >
                  Sign in
                </Link>
                <Link
                  href={bookHref}
                  className={buttonClass("primary", "md", "hidden md:inline-flex md:px-4 lg:px-5")}
                >
                  Book an appointment
                </Link>
              </>
            )}

            <button
              ref={menuButtonRef}
              type="button"
              aria-expanded={menuOpen}
              aria-controls={menuOpen ? menuId : undefined}
              onClick={() => setMenuOpen((open) => !open)}
              className="-mr-1.5 inline-flex size-9 items-center justify-center gap-0 rounded-full text-callout font-medium text-ink transition-colors hover:bg-fill aria-expanded:bg-fill min-[480px]:h-11 min-[480px]:w-auto min-[480px]:gap-1.5 min-[480px]:px-3 md:hidden"
            >
              {menuOpen ? <Close size={20} /> : <Menu size={20} />}
              {/* Under 480px there's only room for the icon; the word stays as the button's name. */}
              <span className="max-[479px]:sr-only">Menu</span>
            </button>
          </div>
        </div>

        {/* Phone and tablet menu: a disclosure (WAI-ARIA APG), not role="menu". */}
        <AnimatePresence>
          {menuOpen ? (
            <motion.div
              id={menuId}
              tabIndex={-1}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={spring.gentle}
              className="absolute inset-x-0 top-full max-h-[calc(100dvh-var(--header-h))] overflow-y-auto border-t border-hairline bg-surface shadow-raised outline-none md:hidden"
            >
              <div className="mx-auto max-w-page px-3 pt-2 pb-5">
                <nav aria-label="Main">
                  <ul className="grid gap-0.5">
                    {links.map((link) => {
                      const current = currentFor(link.href, pathname);
                      return (
                        <li key={link.href}>
                          <Link
                            href={link.href}
                            aria-current={current}
                            onClick={() => setMenuOpen(false)}
                            className={`flex min-h-12 items-center justify-between rounded-xl px-3 text-body font-medium no-underline transition-colors ${
                              current ? "bg-accent-soft text-accent" : "text-ink-2 hover:bg-fill hover:text-ink"
                            }`}
                          >
                            {link.label}
                            <ChevronRight size={18} className={current ? "text-accent" : "text-muted"} />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </nav>

                <div aria-hidden="true" className="mx-3 my-3 h-px bg-hairline" />

                {user ? (
                  <div className="px-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={displayName} email={user.email} large />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-body font-semibold text-ink">{displayName}</p>
                        <p className="truncate text-callout text-muted">{user.email}</p>
                      </div>
                      <span className="shrink-0 rounded-full border border-hairline bg-surface-2 px-2.5 py-0.5 text-caption font-medium text-ink-2">
                        {roleLabel(user)}
                      </span>
                    </div>
                    <form action={signOutAction} onSubmit={forgetBooking} className="mt-4">
                      <SignOutButton
                        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-hairline bg-fill text-body font-medium text-ink transition-colors hover:bg-fill-strong"
                        icon={<SignOut size={18} />}
                      >
                        Sign out
                      </SignOutButton>
                    </form>
                  </div>
                ) : (
                  <div className="grid gap-2 px-3">
                    <Link
                      href={bookHref}
                      onClick={() => setMenuOpen(false)}
                      className={buttonClass("primary", "lg", "w-full")}
                    >
                      Book an appointment
                    </Link>
                    <Link
                      href={signInHref}
                      onClick={() => setMenuOpen(false)}
                      className={buttonClass("secondary", "lg", "w-full")}
                    >
                      Sign in
                    </Link>
                  </div>
                )}

                {showPracticePhone ? (
                  <div className="mx-3 mt-4 flex items-center gap-3 rounded-xl border border-hairline bg-surface-2 px-4 py-2">
                    <Phone size={20} className="shrink-0 text-muted" />
                    <div className="min-w-0">
                      <a
                        href={practice.phoneHref}
                        className="tabular inline-flex min-h-11 items-center text-body font-semibold text-accent no-underline hover:text-accent-hover hover:underline underline-offset-4"
                      >
                        {practice.phoneDisplay}
                      </a>
                      <p className="-mt-1.5 pb-1 text-caption text-muted">{practice.hours}</p>
                    </div>
                  </div>
                ) : null}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </header>

      {/* Dims the page under the open phone menu. A press on it closes the menu (see useDismiss). */}
      <AnimatePresence>
        {menuOpen ? (
          <motion.div
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-30 bg-black/40 dark:bg-black/60 md:hidden"
          />
        ) : null}
      </AnimatePresence>
    </>
  );
}

function Brand({ href }: { href: string }) {
  // "Westbrook" set large, "Medical Practice" small underneath.
  const descriptor = practice.name.replace(practice.shortName, "").trim();
  return (
    <Link
      href={href}
      aria-label={practice.name}
      className="group -mx-1 flex shrink-0 items-center gap-1.5 rounded-xl px-1 py-1 min-[360px]:gap-2.5"
    >
      <span
        aria-hidden="true"
        className="grid size-8 place-items-center rounded-[9px] bg-ink text-canvas transition-transform duration-200 group-active:scale-95 md:size-9 md:rounded-[10px]"
      >
        <svg width="16" height="16" viewBox="0 0 14 14" fill="currentColor">
          <path d="M5 1h4v4h4v4H9v4H5V9H1V5h4z" />
        </svg>
      </span>
      <span className="flex flex-col">
        <span className="text-[1rem] leading-[1.15] font-bold tracking-[-0.015em] text-ink min-[360px]:text-[1.0625rem]">
          {practice.shortName}
        </span>
        {descriptor ? (
          <span className="text-[0.625rem] leading-[1.25] font-semibold tracking-[0.03em] text-muted uppercase min-[360px]:text-[0.6875rem] min-[360px]:tracking-[0.07em]">
            {descriptor}
          </span>
        ) : null}
      </span>
    </Link>
  );
}

function Avatar({ name, email, large = false }: { name: string; email: string; large?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-full bg-ink font-semibold tracking-wide text-canvas ${
        large ? "size-10 text-callout" : "size-8 text-caption"
      }`}
    >
      {initialsFor(name, email)}
    </span>
  );
}

function AccountMenu({
  user,
  name,
  open,
  setOpen,
  onSignOut,
}: {
  user: HeaderUser;
  name: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  onSignOut: () => void;
}) {
  const pathname = usePathname();
  const { theme } = useTheme();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<(HTMLElement | null)[]>([]);
  const instant = useRef(false);
  const panelId = useId();

  const links = accountLinks(user);
  const currentIndex = links.findIndex((link) => currentFor(link.href, pathname) !== undefined);
  const [active, setActive] = useState<number | null>(null);
  const isSignOutActive = active === links.length;

  const close = useCallback(
    (refocus: boolean) => {
      setOpen(false);
      if (refocus) buttonRef.current?.focus();
    },
    [setOpen],
  );
  useDismiss(open, close, rootRef);

  const consumeInstant = useCallback(() => {
    const jump = instant.current;
    instant.current = false;
    return jump;
  }, []);

  useGlidePill({
    pillRef,
    active,
    enabled: open,
    consumeInstant,
    measure: (i) => {
      const el = rowRefs.current[i];
      const container = listContainerRef.current;
      if (!el) return null;
      if (!container) return { top: el.offsetTop, height: el.offsetHeight };
      const elRect = el.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const hasRect = Boolean(containerRect && (containerRect.top || containerRect.bottom || containerRect.height));
      const top = hasRect ? Math.round(elRect.top - containerRect.top) : el.offsetTop;
      const height = elRect.height || el.offsetHeight;
      return { top, height };
    },
  });

  const openMenu = () => {
    instant.current = true;
    setActive(currentIndex >= 0 ? currentIndex : 0);
    setOpen(true);
  };

  const toggleMenu = () => {
    if (open) {
      setOpen(false);
      return;
    }
    openMenu();
  };

  const focusRow = (index: number) => {
    const count = links.length + 1;
    const clamped = ((index % count) + count) % count;
    setActive(clamped);
    const node = rowRefs.current[clamped];
    const target = node?.matches("a,button") ? node : node?.querySelector<HTMLElement>("a,button");
    target?.focus();
  };

  const onPanelKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const cur = active ?? (currentIndex >= 0 ? currentIndex : 0);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusRow(cur + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusRow(cur - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusRow(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusRow(links.length);
    }
  };

  const glideVars: CSSProperties =
    theme === "dark"
      ? ({
          "--gs-surface": "#27272a",
          "--gs-highlight": "#3f3f46",
          "--gs-highlight-danger": "rgba(248, 113, 113, 0.16)",
          "--gs-text": "#f5f5f5",
          "--gs-accent": "#f5f5f5",
          "--gs-muted": "rgba(245, 245, 245, 0.72)",
          "--gs-border": "rgba(255, 255, 255, 0.1)",
          "--gs-shadow": "0 12px 32px rgba(0, 0, 0, 0.45)",
        } as CSSProperties)
      : ({
          "--gs-surface": "#ffffff",
          "--gs-highlight": "#f4f4f5",
          "--gs-highlight-danger": "#fee2e2",
          "--gs-text": "#18181b",
          "--gs-accent": "#18181b",
          "--gs-muted": "#52525b",
          "--gs-border": "rgba(24, 24, 27, 0.1)",
          "--gs-shadow": "0 8px 28px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.06)",
        } as CSSProperties);

  return (
    <div
      ref={rootRef}
      className="relative hidden md:block"
      onBlur={(event) => {
        if (open && leftBy(event)) setOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-label={`${name}, account`}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={toggleMenu}
        onKeyDown={(event) => {
          if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
            event.preventDefault();
            openMenu();
          }
        }}
        className="flex min-h-10 items-center gap-1 rounded-full border border-hairline bg-surface py-1 pr-2 pl-1.5 lg:gap-2 lg:pr-3 text-callout font-medium text-ink transition-[background-color,border-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:border-control/70 hover:bg-surface-2 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent aria-expanded:border-control aria-expanded:bg-surface-2 aria-expanded:outline-none"
      >
        <Avatar name={name} email={user.email} />
        {/* Tablets and phones held sideways have no room for the name beside the nav: avatar only. */}
        <span className="hidden max-w-40 truncate lg:inline">{name}</span>
        <ChevronDown
          size={15}
          className={`text-muted transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            id={panelId}
            tabIndex={-1}
            style={glideVars}
            onKeyDown={onPanelKeyDown}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.18, ease: GLIDE_EASE_TUPLE }}
            className="absolute top-full right-0 mt-2 w-72 origin-top-right rounded-[12px] border p-1.5 outline-none [border-color:var(--gs-border)] [background:var(--gs-surface)] [box-shadow:var(--gs-shadow)] [color:var(--gs-text)]"
          >
            <div className="flex items-center gap-3 px-2.5 py-2">
              <Avatar name={name} email={user.email} large />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 flex-1 truncate text-[13.5px] leading-snug font-semibold [color:var(--gs-text)]">
                    {name}
                  </p>
                  <span className="inline-flex shrink-0 rounded-[6px] border px-1.5 py-0.5 text-[11px] leading-none font-medium [border-color:var(--gs-border)] [background:var(--gs-highlight)] [color:var(--gs-text)]">
                    {roleLabel(user)}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-[12px] leading-snug [color:var(--gs-muted)]">{user.email}</p>
              </div>
            </div>
            <div aria-hidden="true" className="mx-1.5 my-1 h-px [background:var(--gs-border)]" />
            <div
              ref={listContainerRef}
              className="relative"
              onPointerLeave={() => setActive(currentIndex >= 0 ? currentIndex : null)}
            >
              <span
                ref={pillRef}
                aria-hidden="true"
                style={{
                  backgroundColor: isSignOutActive
                    ? "var(--gs-highlight-danger)"
                    : "var(--gs-highlight)",
                }}
                className="pointer-events-none absolute top-0 right-0 left-0 z-0 rounded-[8px] opacity-0 [transition:transform_220ms_cubic-bezier(0.23,1,0.32,1),height_220ms_cubic-bezier(0.23,1,0.32,1),background-color_180ms_ease,opacity_150ms_ease] motion-reduce:[transition:opacity_150ms_ease]"
              />
              <ul className="relative z-[1] grid gap-0.5">
                {links.map((link, index) => {
                  const isCurrent = currentFor(link.href, pathname) !== undefined;
                  return (
                    <li key={link.href}>
                      <Link
                        ref={(el) => {
                          rowRefs.current[index] = el;
                        }}
                        href={link.href}
                        aria-current={isCurrent ? "page" : undefined}
                        onClick={() => setOpen(false)}
                        onPointerEnter={() => setActive(index)}
                        onFocus={() => setActive(index)}
                        className="relative flex min-h-9 items-center gap-2 rounded-[8px] px-2.5 text-[13px] font-medium no-underline outline-none select-none [color:var(--gs-text)]"
                      >
                        <span className="min-w-0 flex-1 truncate">{link.label}</span>
                        {link.tag ? (
                          <span aria-hidden="true" className="shrink-0 text-[11px] font-normal [color:var(--gs-muted)]">
                            {link.tag}
                          </span>
                        ) : null}
                        <span
                          aria-hidden="true"
                          className={`inline-flex w-4 shrink-0 items-center justify-center [color:var(--gs-accent)] ${isCurrent ? "visible" : "invisible"}`}
                        >
                          <Check size={14} strokeWidth={2.4} />
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              {links.length > 0 ? (
                <div aria-hidden="true" className="relative z-[1] mx-1.5 my-1 h-px [background:var(--gs-border)]" />
              ) : null}
              <form action={signOutAction} onSubmit={onSignOut} className="relative z-[1]">
                <div
                  ref={(el) => {
                    rowRefs.current[links.length] = el;
                  }}
                  onPointerEnter={() => setActive(links.length)}
                  onFocus={() => setActive(links.length)}
                >
                  <SignOutButton
                    className={`group flex min-h-9 w-full items-center justify-between gap-2 rounded-[8px] px-2.5 text-left text-[13px] font-medium outline-none select-none transition-colors duration-150 ${
                      isSignOutActive
                        ? "text-danger dark:text-red-400"
                        : "[color:var(--gs-text)] hover:text-danger dark:hover:text-red-400"
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate">Sign out</span>
                    <span
                      aria-hidden="true"
                      className={`inline-flex w-4 shrink-0 items-center justify-center transition-colors duration-150 ${
                        isSignOutActive
                          ? "text-danger dark:text-red-400"
                          : "[color:var(--gs-muted)] group-hover:text-danger dark:group-hover:text-red-400"
                      }`}
                    >
                      <SignOut size={14} />
                    </span>
                  </SignOutButton>
                </div>
              </form>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
