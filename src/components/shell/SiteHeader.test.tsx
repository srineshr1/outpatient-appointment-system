import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { STORAGE_KEY } from "@/lib/booking-state";
import { signOutAction } from "@/server/auth-actions";
import { navigation, renderWithProviders } from "@/test/utils";
import { SiteHeader, currentFor, initialsFor, navLinks, roleLabel } from "./SiteHeader";

// Signing out clears the session cookie on the server; here we only check the client side of it.
vi.mock("@/server/auth-actions", () => ({ signOutAction: vi.fn() }));

const patient = {
  id: "user-patient-demo",
  email: "ann.lee@halden.example",
  name: "Ann Lee",
  role: "patient" as const,
  doctorId: null,
  mobile: "",
  dob: "",
};
const doctor = { ...patient, id: "user-cho", email: "helen.cho@halden.example", name: "Dr Helen Cho", role: "doctor" as const, doctorId: "cho" };

/** The element a disclosure button controls. Only set while it's open. */
function panelOf(button: HTMLElement): HTMLElement {
  const id = button.getAttribute("aria-controls");
  expect(id).toBeTruthy();
  return document.getElementById(id!)!;
}

describe("SiteHeader", () => {
  it("names the practice and has no booking progress bar", () => {
    navigation.pathname = "/doctors/cho";
    renderWithProviders(<SiteHeader user={patient} />);
    expect(screen.getByRole("link", { name: "Westbrook Medical Practice" })).toHaveAttribute("href", "/book");
    expect(screen.queryByRole("navigation", { name: "Booking progress" })).not.toBeInTheDocument();
    expect(screen.queryByText(/current step/)).not.toBeInTheDocument();
  });

  it("signed out: sign-in returns to this page, and the main button starts a booking", () => {
    navigation.pathname = "/doctors/cho";
    renderWithProviders(<SiteHeader user={null} />);
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("link", { name: "Our doctors" })).toHaveAttribute("href", "/#doctors");
    expect(within(nav).getByRole("link", { name: "How it works" })).toHaveAttribute("href", "/#how-it-works");
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in?next=%2Fdoctors%2Fcho");
    expect(screen.getByRole("link", { name: "Book an appointment" })).toHaveAttribute("href", "/sign-in?next=%2Fbook");
    expect(screen.queryByRole("button", { name: /account/ })).not.toBeInTheDocument();
  });

  it("marks the page you're on, and counts choosing a time as part of booking", () => {
    navigation.pathname = "/book";
    const { rerender } = renderWithProviders(<SiteHeader user={patient} />);
    let nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("link", { name: "Book a visit" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Appointments" })).not.toHaveAttribute("aria-current");

    navigation.pathname = "/doctors/cho";
    rerender(<SiteHeader user={patient} />);
    nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("link", { name: "Book a visit" })).toHaveAttribute("aria-current", "true");
  });

  it("account menu shows who is signed in; Escape closes it and returns focus", async () => {
    navigation.pathname = "/book";
    renderWithProviders(<SiteHeader user={patient} />);
    const button = screen.getByRole("button", { name: "Ann Lee, account" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).not.toHaveAttribute("aria-controls");

    await userEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    const panel = panelOf(button);
    expect(panel).toHaveTextContent("ann.lee@halden.example");
    expect(panel).toHaveTextContent("Patient");
    expect(within(panel).getByRole("link", { name: "Your appointments" })).toHaveAttribute("href", "/appointments");
    expect(within(panel).getByRole("button", { name: "Sign out" })).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveFocus();
  });

  it("closes the account menu on a press outside it", async () => {
    renderWithProviders(
      <>
        <SiteHeader user={patient} />
        <p>Page content</p>
      </>,
    );
    const button = screen.getByRole("button", { name: "Ann Lee, account" });
    await userEvent.click(button);
    await userEvent.click(screen.getByText("Page content"));
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("phone menu is a disclosure with the links, the account and sign-out", async () => {
    navigation.pathname = "/appointments";
    renderWithProviders(<SiteHeader user={patient} />);
    const button = screen.getByRole("button", { name: "Menu" });
    await userEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");

    const panel = panelOf(button);
    expect(within(panel).getByRole("link", { name: "Appointments" })).toHaveAttribute("aria-current", "page");
    expect(within(panel).getByRole("link", { name: "Book a visit" })).toHaveAttribute("href", "/book");
    expect(panel).toHaveTextContent("ann.lee@halden.example");
    expect(within(panel).getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    // Plain links, not an ARIA menu widget.
    expect(within(panel).queryByRole("menu")).not.toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveFocus();
  });

  it("closes the menu when the page changes", async () => {
    navigation.pathname = "/book";
    const { rerender } = renderWithProviders(<SiteHeader user={patient} />);
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    navigation.pathname = "/appointments";
    rerender(<SiteHeader user={patient} />);
    expect(screen.getByRole("button", { name: "Menu" })).toHaveAttribute("aria-expanded", "false");
  });

  it("an open menu takes Escape before page shortcuts do", async () => {
    // The Details page listens on window for Escape to go back a step; it skips handled keys.
    const handled: boolean[] = [];
    const pageShortcut = (event: KeyboardEvent) => handled.push(event.defaultPrevented);
    window.addEventListener("keydown", pageShortcut);
    try {
      renderWithProviders(<SiteHeader user={patient} />);
      await userEvent.click(screen.getByRole("button", { name: "Menu" }));
      await userEvent.keyboard("{Escape}");
      expect(handled).toEqual([true]);
    } finally {
      window.removeEventListener("keydown", pageShortcut);
    }
  });

  it("staff get the clinic book, with their role and room", async () => {
    navigation.pathname = "/dashboard";
    renderWithProviders(<SiteHeader user={doctor} />);
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("link", { name: "Clinic book" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Westbrook Medical Practice" })).toHaveAttribute("href", "/dashboard");
    await userEvent.click(screen.getByRole("button", { name: "Dr Helen Cho, account" }));
    expect(screen.getByText("Doctor · Room 3")).toBeInTheDocument();
  });

  it("forgets a held time on sign-out, so the next person on this device starts clean", async () => {
    const held = { id: "cho-2026-10-28-09:00", doctorId: "cho", date: "2026-10-28", time: "09:00" };
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ held, booking: null, flash: null }));
    renderWithProviders(<SiteHeader user={patient} />);
    const button = screen.getByRole("button", { name: "Ann Lee, account" });
    await userEvent.click(button);
    await userEvent.click(within(panelOf(button)).getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(signOutAction).toHaveBeenCalled());
    expect(JSON.parse(window.sessionStorage.getItem(STORAGE_KEY)!).held).toBeNull();
  });
});

describe("header helpers", () => {
  it("makes initials from a name", () => {
    expect(initialsFor("Ann Lee")).toBe("AL");
    expect(initialsFor("Dr Helen Cho")).toBe("HC");
    expect(initialsFor("Mary Ann van der Berg")).toBe("MB");
    expect(initialsFor("  ", "sam@example.com")).toBe("S");
  });

  it("labels roles, including ones it doesn't know", () => {
    expect(roleLabel({ role: "reception", doctorId: null })).toBe("Reception");
    expect(roleLabel({ role: "doctor", doctorId: "cho" })).toBe("Doctor · Room 3");
    expect(roleLabel({ role: "locum" as never, doctorId: null })).toBe("Locum");
  });

  it("gives roles it doesn't know the clinic book", () => {
    expect(navLinks({ role: "locum" as never }).map((link) => link.href)).toEqual(["/dashboard"]);
  });

  it("treats choosing a time and the form as part of booking", () => {
    expect(currentFor("/book", "/book")).toBe("page");
    expect(currentFor("/book", "/doctors/cho")).toBe("true");
    expect(currentFor("/book", "/book/details")).toBe("true");
    expect(currentFor("/appointments", "/book")).toBeUndefined();
    expect(currentFor("/#doctors", "/")).toBeUndefined();
  });
});
