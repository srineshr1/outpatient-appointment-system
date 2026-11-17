import { renderWithProviders } from "@/test/utils";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { doctors } from "@/lib/data";
import { lookupEmailAccount, requestPasswordReset, signInWithPassword, signUpWithPassword } from "@/server/auth-actions";
import { SignInPanel } from "./SignInPanel";

vi.mock("@/server/auth-actions", () => ({
  lookupEmailAccount: vi.fn(async () => ({ ok: true, exists: true })),
  signInWithPassword: vi.fn(async () => ({ ok: false, error: "That email and password don’t match." })),
  signUpWithPassword: vi.fn(async () => ({ ok: false, error: "There’s already an account for that email." })),
  requestPasswordReset: vi.fn(async () => ({ ok: true, message: "If there’s an account for that email, we’ve sent a link." })),
}));

beforeEach(() => vi.clearAllMocks());

async function continueWithEmail(address: string, exists: boolean) {
  vi.mocked(lookupEmailAccount).mockResolvedValueOnce({ ok: true, exists });
  await userEvent.type(screen.getByLabelText(/email/i), `${address}{enter}`);
  expect(vi.mocked(lookupEmailAccount)).toHaveBeenCalledWith({ email: address });
}

describe("password sign-in", () => {
  it("signs in with email and password and shows the same message for any mismatch", async () => {
    renderWithProviders(<SignInPanel nextPath="/book" mode="patient" doctors={doctors} />);
    await continueWithEmail("sam@example.com", true);
    await userEvent.type(await screen.findByLabelText("Password"), "wrong-password");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(vi.mocked(signInWithPassword)).toHaveBeenCalledWith({ email: "sam@example.com", password: "wrong-password", next: "/book" });
    expect(await screen.findByRole("alert")).toHaveTextContent("That email and password don’t match.");
    expect(screen.getByRole("button", { name: "Forgot password?" })).toBeInTheDocument();
    // No code boxes any more.
    expect(screen.queryByLabelText(/Digit 1/)).toBeNull();
  });

  it("asks a new email to set a password, and signs up with a name, role and a confirmed password of at least 8 characters", async () => {
    renderWithProviders(<SignInPanel nextPath="/" mode="patient" doctors={doctors} />);
    const roleSelect = screen.getByRole("combobox", { name: "Account role" });
    await userEvent.click(roleSelect);
    await userEvent.click(await screen.findByRole("option", { name: /Doctor/i }));

    await continueWithEmail("asha@example.com", false);
    expect(await screen.findByRole("heading", { name: "New here? Set a password to create your account" })).toBeInTheDocument();
    expect(screen.getByText("We’ll create a doctor account for this email.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create an account" })).toBeNull();

    await userEvent.type(screen.getByLabelText("Full name"), "Asha Rao");
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

  it("allows switching between Patient and Doctor roles via GlideSelect dropdown", async () => {
    renderWithProviders(<SignInPanel nextPath="/" mode="patient" doctors={doctors} />);
    const roleSelect = screen.getByRole("combobox", { name: "Account role" });
    expect(roleSelect).toHaveTextContent("Patient");
    expect(screen.getByPlaceholderText("Enter your email...")).toBeInTheDocument();

    // Open dropdown and select Doctor
    await userEvent.click(roleSelect);
    const doctorOption = await screen.findByRole("option", { name: /Doctor/i });
    await userEvent.click(doctorOption);

    expect(roleSelect).toHaveTextContent("Doctor");
    expect(screen.getByPlaceholderText("Enter your practice email...")).toBeInTheDocument();
    expect(screen.getByText("Clinic staff sign-in")).toBeInTheDocument();
  });
});
