import { renderWithProviders } from "@/test/utils";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { doctors } from "@/lib/data";
import { requestPasswordReset, signInWithPassword, signUpWithPassword } from "@/server/auth-actions";
import { SignInPanel } from "./SignInPanel";

vi.mock("@/server/auth-actions", () => ({
  signInWithPassword: vi.fn(async () => ({ ok: false, error: "That email and password don’t match." })),
  signUpWithPassword: vi.fn(async () => ({ ok: false, error: "There’s already an account for that email." })),
  requestPasswordReset: vi.fn(async () => ({ ok: true, message: "If there’s an account for that email, we’ve sent a link." })),
}));

beforeEach(() => vi.clearAllMocks());

describe("password sign-in", () => {
  it("signs in with email and password and shows the same message for any mismatch", async () => {
    renderWithProviders(<SignInPanel nextPath="/book" mode="patient" doctors={doctors} />);
    await userEvent.type(screen.getByLabelText("Email"), "sam@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "wrong-password");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(vi.mocked(signInWithPassword)).toHaveBeenCalledWith({ email: "sam@example.com", password: "wrong-password", next: "/book" });
    expect(await screen.findByRole("alert")).toHaveTextContent("That email and password don’t match.");
    // No code boxes any more.
    expect(screen.queryByLabelText(/Digit 1/)).toBeNull();
  });

  it("signs up with a name, role and a confirmed password of at least 8 characters", async () => {
    renderWithProviders(<SignInPanel nextPath="/" mode="patient" doctors={doctors} />);
    await userEvent.click(screen.getByRole("button", { name: "Create an account" }));

    await userEvent.type(await screen.findByLabelText("Full name", {}, { timeout: 3000 }), "Asha Rao");
    await userEvent.click(screen.getByLabelText(/A doctor/));
    await userEvent.type(screen.getByLabelText("Email"), "asha@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "short");
    await userEvent.type(screen.getByLabelText("Confirm password"), "short");
    await userEvent.click(screen.getByRole("button", { name: "Create doctor account" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("at least 8 characters");
    expect(vi.mocked(signUpWithPassword)).not.toHaveBeenCalled();

    await userEvent.clear(screen.getByLabelText("Password"));
    await userEvent.type(screen.getByLabelText("Password"), "long-enough-1");
    await userEvent.clear(screen.getByLabelText("Confirm password"));
    await userEvent.type(screen.getByLabelText("Confirm password"), "long-enough-2");
    await userEvent.click(screen.getByRole("button", { name: "Create doctor account" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("don’t match");

    await userEvent.clear(screen.getByLabelText("Confirm password"));
    await userEvent.type(screen.getByLabelText("Confirm password"), "long-enough-1");
    await userEvent.click(screen.getByRole("button", { name: "Create doctor account" }));
    expect(vi.mocked(signUpWithPassword)).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Asha Rao", email: "asha@example.com", password: "long-enough-1", role: "doctor" }),
    );
  });

  it("emails a reset link from 'Forgot password'", async () => {
    renderWithProviders(<SignInPanel nextPath="/" mode="staff" doctors={doctors} />);
    await userEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    await userEvent.type(await screen.findByLabelText("Email", {}, { timeout: 3000 }), "dr@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Email me a reset link" }));
    expect(vi.mocked(requestPasswordReset)).toHaveBeenCalledWith({ email: "dr@example.com" });
    expect(await screen.findByText(/we’ve sent a link/)).toBeInTheDocument();
  });
});
