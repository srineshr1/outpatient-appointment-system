import { renderWithProviders } from "@/test/utils";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { signInAsDemo } from "@/server/auth-actions";
import { DemoLoginButtons } from "./DemoLoginButtons";

vi.mock("@/server/auth-actions", () => ({
  signInAsDemo: vi.fn(async () => ({ ok: true, message: "/appointments" })),
}));

describe("demo login buttons", () => {
  it("signs in as the demo patient, doctor or receptionist in one click", async () => {
    renderWithProviders(<DemoLoginButtons nextPath="/" />);
    await userEvent.click(screen.getByRole("button", { name: "Patient" }));
    expect(vi.mocked(signInAsDemo)).toHaveBeenCalledWith({ who: "patient", next: "/" });
    await userEvent.click(screen.getByRole("button", { name: "Doctor" }));
    expect(vi.mocked(signInAsDemo)).toHaveBeenCalledWith({ who: "doctor", next: "/" });
    await userEvent.click(screen.getByRole("button", { name: "Receptionist" }));
    expect(vi.mocked(signInAsDemo)).toHaveBeenCalledWith({ who: "reception", next: "/" });
  });

  it("keeps the same one-click actions when the buttons are minimal", async () => {
    renderWithProviders(<DemoLoginButtons nextPath="/book" appearance="minimal" />);
    await userEvent.click(screen.getByRole("button", { name: "Patient" }));
    expect(vi.mocked(signInAsDemo)).toHaveBeenCalledWith({ who: "patient", next: "/book" });
    await userEvent.click(screen.getByRole("button", { name: "Doctor" }));
    expect(vi.mocked(signInAsDemo)).toHaveBeenCalledWith({ who: "doctor", next: "/book" });
    await userEvent.click(screen.getByRole("button", { name: "Receptionist" }));
    expect(vi.mocked(signInAsDemo)).toHaveBeenCalledWith({ who: "reception", next: "/book" });
  });
});
