import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { doctors } from "@/lib/data";
import { getUpcoming } from "@/lib/repository";
import { renderWithProviders } from "@/test/utils";
import { DoctorDirectory } from "./DoctorDirectory";

/** The bar that stays under the header (sticky on screens tall enough for it). */
function pinnedBar(): HTMLElement {
  const bar = screen.getByRole("searchbox").closest<HTMLElement>(".tall\\:sticky");
  expect(bar).not.toBeNull();
  return bar!;
}

describe("DoctorDirectory finder bar", () => {
  it("on the booking page, pins the greeting with the search and filters; the cards and intro scroll", async () => {
    renderWithProviders(
      <DoctorDirectory
        doctors={doctors}
        upcoming={await getUpcoming()}
        labelledBy="greeting"
        heading={<h1 id="greeting">Hi Ann, who would you like to see?</h1>}
        lead={<p>Choose a doctor, then pick a time.</p>}
      />,
    );
    const bar = pinnedBar();
    expect(screen.getByRole("region", { name: "Hi Ann, who would you like to see?" })).toContainElement(bar);
    expect(bar).toContainElement(screen.getByRole("heading", { level: 1 }));
    expect(bar).toContainElement(screen.getByRole("radiogroup", { name: "Filter by specialty" }));
    expect(bar).not.toContainElement(screen.getByText("Choose a doctor, then pick a time."));
    expect(bar).not.toContainElement(screen.getByRole("list", { name: "Doctors" }));
    // The page brings its own heading, so there's no second one.
    expect(screen.queryByRole("heading", { name: "Meet our doctors" })).not.toBeInTheDocument();
  });

  it("on the landing page, the introduction scrolls away and only the finder is pinned", async () => {
    renderWithProviders(<DoctorDirectory doctors={doctors} upcoming={await getUpcoming()} />);
    const bar = pinnedBar();
    expect(screen.getByRole("region", { name: "Meet our doctors" })).toContainElement(bar);
    expect(bar).not.toContainElement(screen.getByRole("heading", { name: "Meet our doctors" }));
    expect(bar).toContainElement(screen.getByRole("radiogroup", { name: "Filter by specialty" }));
    expect(bar).not.toContainElement(screen.getByRole("list", { name: "Doctors" }));
  });

  it("keeps focus in the finder after clearing, since the pressed button goes away", async () => {
    renderWithProviders(<DoctorDirectory doctors={doctors} upcoming={await getUpcoming()} />);
    const search = screen.getByRole("searchbox");
    await userEvent.type(search, "zzz");
    await userEvent.click(await screen.findByRole("button", { name: "Clear filters" }));
    expect(search).toHaveFocus();
    expect(search).toHaveValue("");

    await userEvent.type(search, "cho");
    await userEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(search).toHaveFocus();
    await waitFor(() => expect(screen.getByText("5 doctors")).toBeInTheDocument());
  });
});
