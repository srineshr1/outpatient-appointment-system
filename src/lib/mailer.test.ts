import { afterEach, describe, expect, it, vi } from "vitest";
import { ownMailConfigured, showsCodeOnScreen } from "./mailer";

afterEach(() => vi.unstubAllEnvs());

describe("sign-in code routing", () => {
  it("needs both RESEND_API_KEY and MAIL_FROM for the app's own mail", () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("MAIL_FROM", "");
    expect(ownMailConfigured()).toBe(false);
    vi.stubEnv("MAIL_FROM", "Westbrook Medical Practice <no-reply@srinesh.in>");
    expect(ownMailConfigured()).toBe(true);
  });

  it("keeps sample accounts on on-screen codes on a demo deployment, even with a mail key", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SHOW_LOGIN_CODES", "1");
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("MAIL_FROM", "Westbrook Medical Practice <no-reply@srinesh.in>");
    expect(showsCodeOnScreen("ann.lee@halden.example")).toBe(true);
    expect(showsCodeOnScreen("helen.cho@halden.example")).toBe(true);
    expect(showsCodeOnScreen("admin@halden.example")).toBe(false);
    expect(showsCodeOnScreen("someone@gmail.com")).toBe(false);
  });

  it("emails sample accounts too once demo codes are off", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SHOW_LOGIN_CODES", "");
    vi.stubEnv("RESEND_API_KEY", "re_test");
    expect(showsCodeOnScreen("ann.lee@halden.example")).toBe(false);
  });
});
