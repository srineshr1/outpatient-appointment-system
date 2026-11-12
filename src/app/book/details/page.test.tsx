import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setNow } from "@/lib/clock";
import { getUpcoming } from "@/lib/repository";
import { MONDAY_1340 } from "@/test/utils";

const session = vi.hoisted(() => ({ user: null as null | Record<string, unknown> }));
vi.mock("@/lib/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/session")>()),
  getCurrentUser: vi.fn(async () => session.user),
}));
const redirects = vi.hoisted(() => ({ to: "" }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  redirect: (to: string) => {
    redirects.to = to;
    throw new Error("NEXT_REDIRECT");
  },
}));
// Only the server lookup is under test here; the form itself is covered in flow.test.tsx.
vi.mock("@/components/details/DetailsView", () => ({
  DetailsView: ({ linkedSlot }: { linkedSlot: { id: string } | null }) => <p>Booking form for {linkedSlot?.id ?? "nothing"}</p>,
}));

const { default: DetailsPage } = await import("./page");

const patient = {
  id: "user-patient-demo",
  email: "ann.lee@halden.example",
  name: "Ann Lee",
  role: "patient" as const,
  doctorId: null,
  mobile: "07700 900123",
  dob: "1980-03-14",
  expiresAt: "2099-01-01T00:00:00.000Z",
};

beforeEach(() => {
  setNow(MONDAY_1340);
  session.user = patient;
  redirects.to = "";
});

describe("/book/details?slot=", () => {
  it("passes an open linked slot to the booking form", async () => {
    const open = (await getUpcoming())["cho"]![0]!;
    render(await DetailsPage({ searchParams: Promise.resolve({ slot: open.id }) }));
    expect(screen.getByText(`Booking form for ${open.id}`)).toBeInTheDocument();
  });

  it("explains when the linked time no longer exists, and books nothing", async () => {
    render(await DetailsPage({ searchParams: Promise.resolve({ slot: "no-such-slot" }) }));
    expect(screen.getByRole("heading", { name: "That time isn’t available" })).toBeInTheDocument();
    expect(screen.getByText(/Nothing has been booked/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Choose a doctor" })).toHaveAttribute("href", "/book");
  });

  it("sends signed-out people to sign in and back to the same time", async () => {
    session.user = null;
    await expect(DetailsPage({ searchParams: Promise.resolve({ slot: "abc 1" }) })).rejects.toThrow("NEXT_REDIRECT");
    expect(redirects.to).toBe(`/sign-in?next=${encodeURIComponent("/book/details?slot=abc%201")}`);
  });
});
