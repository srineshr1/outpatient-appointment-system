import { router, renderWithProviders, MONDAY_1340 } from "@/test/utils";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { DoctorDirectory } from "@/components/directory/DoctorDirectory";
import { DetailsView } from "@/components/details/DetailsView";
import { ScheduleView } from "@/components/schedule/ScheduleView";
import { STORAGE_KEY } from "@/lib/booking-state";
import { setNow } from "@/lib/clock";
import { doctors } from "@/lib/data";
import { getSlots, getUpcoming } from "@/lib/repository";

beforeEach(() => {
  router.push.mockReset();
  router.replace.mockReset();
  setNow(MONDAY_1340);
});

describe("DoctorDirectory", () => {
  async function setup() {
    renderWithProviders(<DoctorDirectory doctors={doctors} upcoming={await getUpcoming()} />);
  }

  it("lists every doctor with their next time", async () => {
    await setup();
    const list = screen.getByRole("list", { name: "Doctors" });
    expect(within(list).getAllByRole("link")).toHaveLength(5);
    expect(screen.getByRole("link", { name: /Dr Helen Cho/ })).toHaveAttribute("href", "/doctors/cho");
    expect(screen.getByRole("link", { name: /Dr Helen Cho/ })).toHaveAccessibleDescription(/Next available/);
  });

  it("searches by name or specialty and announces the count", async () => {
    await setup();
    await userEvent.type(screen.getByRole("searchbox"), "diabetes");
    await waitFor(() => expect(screen.getByText("1 doctor")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: /Dr Callum Reid/ })).toBeInTheDocument();
  });

  it("filters by specialty chip with arrow keys", async () => {
    await setup();
    await userEvent.click(screen.getByRole("radio", { name: "All doctors" }));
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "General practice" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("1 doctor in general practice")).toBeInTheDocument();
  });

  it("shows a helpful empty state and clears filters", async () => {
    await setup();
    await userEvent.type(screen.getByRole("searchbox"), "zzz");
    expect(await screen.findByText("No doctors found")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    await waitFor(() => expect(screen.getByText("5 doctors")).toBeInTheDocument());
  });
});

describe("ScheduleView", () => {
  it("shows the week, disables unavailable times, and holds a choice", async () => {
    const cho = doctors.find((doctor) => doctor.id === "cho")!;
    renderWithProviders(<ScheduleView doctor={cho} slots={await getSlots("cho")} initialWeek="2026-10-26" />);

    expect(screen.getByRole("button", { name: "Previous week" })).toBeDisabled();
    // 09:20 today has passed at 13:40.
    expect(screen.getAllByRole("radio", { name: /09:20, closed/ })[0]).toBeDisabled();

    const open = screen.getAllByRole("radio").find((radio) => !(radio as HTMLInputElement).disabled)!;
    await userEvent.click(open);
    expect(await screen.findByRole("button", { name: "Continue" })).toBeInTheDocument();
    await waitFor(() => expect(window.sessionStorage.getItem(STORAGE_KEY)).toContain((open as HTMLInputElement).value));

    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(router.push).toHaveBeenCalledWith("/book/details");
  });

  it("moves between weeks", async () => {
    const cho = doctors.find((doctor) => doctor.id === "cho")!;
    renderWithProviders(<ScheduleView doctor={cho} slots={await getSlots("cho")} initialWeek="2026-10-26" />);
    await userEvent.click(screen.getByRole("button", { name: "Next week" }));
    expect(await screen.findByText(/2–6 November 2026 · \d+ times? available/)).toBeInTheDocument();
  });
});

describe("DetailsView", () => {
  async function setupHeld() {
    const open = (await getUpcoming())["cho"]![0]!;
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ held: open, takenIds: [], booking: null, flash: null }));
    renderWithProviders(<DetailsView doctors={doctors} />);
    await screen.findByRole("heading", { name: "Your details" });
    return open;
  }

  it("sends people with nothing held back to the start", async () => {
    renderWithProviders(<DetailsView doctors={doctors} />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
  });

  it("summarises errors and focuses the first problem", async () => {
    await setupHeld();
    await userEvent.click(screen.getByRole("button", { name: "Book appointment" }));
    expect(screen.getByRole("alert", { name: /There are 4 things to fix/ })).toBeInTheDocument();
    expect(screen.getByLabelText("Full name")).toHaveFocus();
    expect(screen.getByLabelText("Mobile number")).toHaveAccessibleDescription("Enter a UK mobile number.");
  });

  it("blocks unregistered patients and points them to the phone", async () => {
    await setupHeld();
    await userEvent.click(screen.getByRole("switch", { name: /not registered/ }));
    expect(screen.getByRole("button", { name: "Book appointment" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Please register first");
  });

  it("books and moves to the confirmation", async () => {
    await setupHeld();
    await userEvent.type(screen.getByLabelText("Full name"), "Ann Lee");
    await userEvent.type(screen.getByLabelText("Date of birth"), "1980-03-14");
    await userEvent.type(screen.getByLabelText("Mobile number"), "07700 900123");
    await userEvent.click(screen.getByRole("radio", { name: /A follow-up/ }));
    expect(screen.getByLabelText("Date of birth")).toHaveAccessibleDescription("46 years old");
    await userEvent.click(screen.getByRole("button", { name: "Book appointment" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/book/confirmed"), { timeout: 2000 });
    const stored = window.sessionStorage.getItem(STORAGE_KEY)!;
    expect(stored).toContain("HSP-");
    expect(stored).not.toContain("Ann Lee");
  });

  it("returns to the schedule with a message when the time is gone", async () => {
    const open = await setupHeld();
    await userEvent.type(screen.getByLabelText("Full name"), "Ann Lee");
    await userEvent.type(screen.getByLabelText("Date of birth"), "1980-03-14");
    await userEvent.type(screen.getByLabelText("Mobile number"), "07700 900123");
    await userEvent.click(screen.getByRole("radio", { name: /A follow-up/ }));
    // The clock moves past the appointment while the form is open.
    act(() => setNow(Date.UTC(2026, 11, 1, 12, 0)));
    await userEvent.click(screen.getByRole("button", { name: "Book appointment" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith(`/doctors/cho?week=${"2026-10-26"}`), { timeout: 2000 });
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toContain(open.id);
  });
});
