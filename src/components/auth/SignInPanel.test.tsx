import { renderWithProviders } from "@/test/utils";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { doctors } from "@/lib/data";
import { requestCode, verifyCode } from "@/server/auth-actions";
import { SignInPanel } from "./SignInPanel";

// The server decides how long the code is: 4 for the app's own codes, 6 when Supabase sent it.
vi.mock("@/server/auth-actions", () => ({
  requestCode: vi.fn(),
  verifyCode: vi.fn(async () => ({ ok: false, error: "That code isn’t right. 4 tries left." })),
  completeSignup: vi.fn(),
}));

async function reachCodeStep(codeLength: number) {
  vi.mocked(requestCode).mockResolvedValueOnce({ ok: true, email: "sam@example.com", resendInMs: 60_000, codeLength });
  renderWithProviders(<SignInPanel nextPath="/book" mode="patient" doctors={doctors} />);
  await userEvent.type(screen.getByLabelText("Email"), "sam@example.com");
  await userEvent.click(screen.getByRole("button", { name: "Continue with email" }));
  await screen.findByLabelText(`Digit 1 of ${codeLength}`, {}, { timeout: 3000 });
  const boxes = screen.getAllByRole("textbox", { name: new RegExp(`Digit \\d of ${codeLength}`) });
  return { boxes, row: screen.getByRole("group") };
}

describe("code boxes", () => {
  it("shows four boxes in one row for the app's own 4-digit code", async () => {
    const { boxes, row } = await reachCodeStep(4);
    expect(boxes).toHaveLength(4);
    expect(row).toHaveClass("flex", "flex-nowrap");
    expect(row).not.toHaveClass("grid-cols-4");
  });

  it("shows six boxes in one row when Supabase sent a 6-digit code, and submits all six", async () => {
    const { boxes, row } = await reachCodeStep(6);
    expect(boxes).toHaveLength(6);
    expect(row).toHaveClass("flex", "flex-nowrap");
    for (const box of boxes) expect(box).toHaveClass("flex-1", "min-w-0");

    await userEvent.click(boxes[0]!);
    await userEvent.paste("123456");
    expect(vi.mocked(verifyCode)).toHaveBeenCalledWith(expect.objectContaining({ code: "123456" }));
  });
});
