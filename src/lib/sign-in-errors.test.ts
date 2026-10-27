import { afterEach, describe, expect, it, vi } from "vitest";
import { SEND_FAILED, sendCodeErrorMessage } from "./sign-in-errors";

describe("sendCodeErrorMessage", () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  afterEach(() => log.mockClear());

  it("explains an address Supabase refuses, without logging the address", () => {
    const message = sendCodeErrorMessage({
      code: "email_address_invalid",
      status: 400,
      message: 'Email address "qa.patient@example.com" is invalid',
    });
    expect(message).toMatch(/can’t send a code to that address/);
    expect(log).toHaveBeenCalledOnce();
    expect(String(log.mock.calls[0]?.[0])).not.toContain("qa.patient");
  });

  it("says when the email rate limit is hit", () => {
    expect(sendCodeErrorMessage({ code: "over_email_send_rate_limit", status: 429 })).toMatch(/Too many sign-in codes/);
  });

  it("talks about a code, not a confirmation email, for anything else", () => {
    expect(sendCodeErrorMessage({ status: 500 })).toBe(SEND_FAILED);
    expect(SEND_FAILED).toMatch(/sign-in code/);
    expect(SEND_FAILED).not.toMatch(/confirmation/);
  });
});
