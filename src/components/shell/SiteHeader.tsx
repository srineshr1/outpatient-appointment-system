"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, type FocusEvent, type RefObject } from "react";
import { Bell, ChevronDown, ChevronRight, Close, Menu, Phone, SignOut } from "@/components/icons";
import { useBooking } from "@/components/providers/BookingProvider";
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
      { href: "/dashboard/sessions", label: "Sessions" },
      { href: "/dashboard/profile", label: "Profile" },
    ];
  }
  return [{ href: "/dashboard", label: "Clinic book" }];
}

/** Links in the account menu: the account's own pages. */
function accountLinks(user: LinkUser): NavLink[] {
  if (user.role === "admin") return [{ href: "/admin", label: "Admin console" }];
  if (user.role === "patient") {
    return [
      { href: "/appointments", label: "Your appointments" },
      { href: "/payments", label: "Payments and refunds" },
      { href: "/profile", label: "Your profile" },
    ];
  }
  return keepsOwnBook(user)
    ? [
        { href: "/dashboard", label: "Clinic book" },
        { href: "/dashboard/sessions", label: "Consulting sessions" },
        { href: "/dashboard/profile", label: "Your profile" },
      ]
    : [{ href: "/dashboard", label: "Clinic book" }];
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
  const homeHref = user ? homeFor(user.role) : "/";
  const onAuthPage = pathname === "/sign-in" || pathname === "/register";
  // Come back to the same page after signing in. A held time on /doctors/* survives in sessionStorage.
  const signInHref = pathname === "/" || onAuthPage ? "/sign-in" : `/sign-in?next=${encodeURIComponent(pathname)}`;
  const bookHref = `/sign-in?next=${encodeURIComponent("/book")}`;
  const displayName = user ? user.name.trim() || user.email : "";
  // Forget any half-filled form, so the next person on this device starts clean.
  const forgetBooking = () => dispatch({ type: "startOver" });

  return (
    <>
      <header
        ref={headerRef}
        onBlur={(event) => {
          if (menuOpen && leftBy(event)) setMenuOpen(false);
        }}
        className="sticky top-0 z-40 border-b border-white/[0.07] bg-zinc-950/85 shadow-[0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl backdrop-saturate-150"
      >
        <div className="mx-auto flex h-(--header-h) max-w-page items-center gap-1.5 px-4 min-[360px]:gap-2 min-[360px]:px-5 md:gap-8 md:px-8">
          <Brand href={homeHref} />

          <nav aria-label="Main" className="hidden h-full md:block">
            <ul className="flex h-full">
              {links.map((link) => (
                <li key={link.href} className="h-full">
                  <DesktopLink link={link} current={currentFor(link.href, pathname)} />
                </li>
              ))}
            </ul>
          </nav>

          <div className="ml-auto flex items-center gap-0.5 min-[360px]:gap-1 md:gap-2">
            <a
              href={practice.phoneHref}
              aria-label={`Call the practice on ${practice.phoneDisplay}`}
              className={`tabular min-h-11 min-w-11 items-center justify-center gap-2 rounded-full px-2.5 text-callout font-medium text-zinc-300 transition-colors hover:bg-white/[0.06] hover:text-zinc-50 lg:px-3 ${
                user ? "inline-flex" : "hidden lg:inline-flex"
              }`}
            >
              <Phone size={18} />
              <span className="hidden lg:inline">{practice.phoneDisplay}</span>
            </a>

            {user ? (
              <Link
                href="/inbox"
                aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
                aria-current={pathname === "/inbox" ? "page" : undefined}
                className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-zinc-300 transition-colors hover:bg-white/[0.06] hover:text-zinc-50"
              >
                <Bell size={20} />
                {unread > 0 ? (
                  <span
                    aria-hidden="true"
                    className="tabular absolute top-1 right-0.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[11px] leading-[18px] font-bold text-white shadow-[0_0_8px_rgba(220,38,38,0.45)]"
                  >
                    {unread > 99 ? "99+" : unread}
                  </span>
                ) : null}
              </Link>
            ) : null}

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
                  className="inline-flex min-h-11 items-center rounded-full px-3 text-callout font-medium text-zinc-300 transition-colors hover:bg-white/[0.06] hover:text-zinc-50 max-[359px]:hidden"
                >
                  Sign in
                </Link>
                <Link
                  href={bookHref}
                  className="hidden min-h-10 items-center rounded-full bg-cyan-400 bg-gradient-to-r from-cyan-400 to-blue-500 px-4 text-callout font-semibold text-zinc-950 shadow-[0_0_16px_rgba(34,211,238,0.3)] transition-all hover:from-cyan-300 hover:to-blue-400 hover:shadow-[0_0_24px_rgba(34,211,238,0.45)] md:inline-flex"
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
              className="-mr-2 inline-flex min-h-11 min-w-11 items-center justify-center gap-0 rounded-full px-2.5 text-callout font-medium text-zinc-200 transition-colors hover:bg-white/[0.06] aria-expanded:bg-white/[0.06] min-[360px]:gap-1.5 min-[360px]:px-3 md:hidden"
            >
              {menuOpen ? <Close size={20} /> : <Menu size={20} />}
              {/* Under 360px there's only room for the icon; the word stays as the button's name. */}
              <span className="max-[359px]:sr-only">Menu</span>
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
              className="absolute inset-x-0 top-full max-h-[calc(100dvh-var(--header-h))] overflow-y-auto border-t border-white/[0.08] bg-zinc-950/95 shadow-raised backdrop-blur-xl outline-none md:hidden"
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
                              current ? "bg-cyan-400/15 text-cyan-300" : "text-zinc-200 hover:bg-white/[0.06] hover:text-zinc-50"
                            }`}
                          >
                            {link.label}
                            <ChevronRight size={18} className={current ? "text-cyan-300" : "text-zinc-400"} />
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
                        <p className="truncate text-body font-semibold text-zinc-100">{displayName}</p>
                        <p className="truncate text-callout text-zinc-400">{user.email}</p>
                      </div>
                      <span className="shrink-0 rounded-full border border-white/[0.06] bg-fill px-2.5 py-0.5 text-caption font-medium text-zinc-200">
                        {roleLabel(user)}
                      </span>
                    </div>
                    <form action={signOutAction} onSubmit={forgetBooking} className="mt-4">
                      <SignOutButton
                        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-fill text-body font-medium text-zinc-100 transition-colors hover:bg-fill-strong"
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
                      className="flex min-h-12 items-center justify-center rounded-xl bg-cyan-400 bg-gradient-to-r from-cyan-400 to-blue-500 text-body font-semibold text-zinc-950 shadow-[0_0_16px_rgba(34,211,238,0.25)] transition-all"
                    >
                      Book an appointment
                    </Link>
                    <Link
                      href={signInHref}
                      onClick={() => setMenuOpen(false)}
                      className="flex min-h-12 items-center justify-center rounded-xl border border-white/10 bg-fill text-body font-medium text-zinc-100 transition-colors hover:bg-fill-strong"
                    >
                      Sign in
                    </Link>
                  </div>
                )}

                <div className="mx-3 mt-4 flex items-center gap-3 rounded-xl border border-white/[0.08] bg-zinc-900/90 px-4 py-2">
                  <Phone size={20} className="shrink-0 text-zinc-400" />
                  <div className="min-w-0">
                    <a
                      href={practice.phoneHref}
                      className="tabular inline-flex min-h-11 items-center text-body font-semibold text-cyan-300 no-underline"
                    >
                      {practice.phoneDisplay}
                    </a>
                    <p className="-mt-1.5 pb-1 text-caption text-zinc-400">{practice.hours}</p>
                  </div>
                </div>
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
            className="fixed inset-0 z-30 bg-black/60 md:hidden"
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
      className="group -mx-1.5 flex shrink-0 items-center gap-2 rounded-xl px-1.5 py-1 min-[360px]:gap-2.5"
    >
      <span
        aria-hidden="true"
        className="grid size-8 place-items-center rounded-[9px] bg-cyan-400 bg-gradient-to-br from-cyan-400 to-blue-500 text-zinc-950 shadow-[0_0_14px_rgba(34,211,238,0.4)] transition-transform duration-200 group-active:scale-95 md:size-9 md:rounded-[10px]"
      >
        <svg width="16" height="16" viewBox="0 0 14 14" fill="currentColor">
          <path d="M5 1h4v4h4v4H9v4H5V9H1V5h4z" />
        </svg>
      </span>
      <span className="flex flex-col">
        <span className="text-[1rem] leading-[1.15] font-bold tracking-[-0.015em] text-zinc-100 min-[360px]:text-[1.0625rem]">{practice.shortName}</span>
        {descriptor ? (
          <span className="text-[0.625rem] leading-[1.25] font-semibold tracking-[0.06em] text-zinc-400 uppercase min-[360px]:text-[0.6875rem] min-[360px]:tracking-[0.07em]">
            {descriptor}
          </span>
        ) : null}
      </span>
    </Link>
  );
}

function DesktopLink({ link, current }: { link: NavLink; current: "page" | "true" | undefined }) {
  return (
    <Link
      href={link.href}
      aria-current={current}
      className={`group relative flex h-full items-center px-1 text-callout font-medium no-underline outline-none transition-colors ${
        current ? "text-cyan-300" : "text-zinc-300 hover:text-zinc-50"
      }`}
    >
      <span
        className={`rounded-lg px-3 py-2 transition-colors group-focus-visible:outline-3 group-focus-visible:outline-cyan-400/55 group-focus-visible:outline-solid ${
          current ? "group-hover:bg-cyan-400/10" : "group-hover:bg-white/[0.06]"
        }`}
      >
        {link.label}
      </span>
      {current ? (
        <motion.span
          layoutId="nav-current"
          transition={spring.snap}
          aria-hidden="true"
          className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 shadow-[0_0_12px_rgba(34,211,238,0.65)]"
        />
      ) : null}
    </Link>
  );
}

function Avatar({ name, email, large = false }: { name: string; email: string; large?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-full bg-cyan-400 bg-gradient-to-br from-cyan-400 to-blue-500 font-semibold tracking-wide text-zinc-950 ${
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
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const close = useCallback(
    (refocus: boolean) => {
      setOpen(false);
      if (refocus) buttonRef.current?.focus();
    },
    [setOpen],
  );
  useDismiss(open, close, rootRef);

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
        onClick={() => setOpen(!open)}
        className="flex min-h-11 items-center gap-2 rounded-full py-1 pr-2.5 pl-1 text-callout font-medium text-zinc-200 transition-colors hover:bg-white/[0.06] aria-expanded:bg-white/[0.06]"
      >
        <Avatar name={name} email={user.email} />
        <span className="max-w-40 truncate">{name}</span>
        <ChevronDown size={16} className={`text-zinc-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            id={panelId}
            tabIndex={-1}
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={spring.press}
            className="absolute top-full right-0 mt-2 w-76 origin-top-right rounded-2xl border border-white/10 bg-zinc-900/95 p-1.5 shadow-raised ring-1 ring-white/[0.06] backdrop-blur-xl outline-none"
          >
            <div className="flex items-center gap-3 px-2.5 pt-2.5 pb-3">
              <Avatar name={name} email={user.email} large />
              <div className="min-w-0">
                <p className="truncate text-callout font-semibold text-zinc-100">{name}</p>
                <p className="truncate text-caption text-zinc-400">{user.email}</p>
                <p className="mt-1.5">
                  <span className="inline-flex rounded-full border border-white/[0.06] bg-fill px-2 py-0.5 text-caption font-medium text-zinc-200">
                    {roleLabel(user)}
                  </span>
                </p>
              </div>
            </div>
            <div aria-hidden="true" className="mx-1.5 h-px bg-white/[0.06]" />
            <ul className="py-1">
              {accountLinks(user).map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="flex min-h-11 items-center rounded-xl px-3 text-callout text-zinc-300 no-underline transition-colors hover:bg-white/[0.06] hover:text-zinc-100"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div aria-hidden="true" className="mx-1.5 h-px bg-white/[0.06]" />
            <form action={signOutAction} onSubmit={onSignOut} className="pt-1">
              <SignOutButton
                className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-callout font-medium text-zinc-300 transition-colors hover:bg-white/[0.06] hover:text-zinc-100"
                icon={<SignOut size={18} className="text-zinc-400" />}
              >
                Sign out
              </SignOutButton>
            </form>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
