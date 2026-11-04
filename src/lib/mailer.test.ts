import { afterEach, describe, expect, it, vi } from "vitest";
import { resetEmail } from "./login-email";
import { MailNotConfiguredError, ownMailConfigured, sendPasswordReset } from "./mailer";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("password-reset mail", () => {
  it("needs both RESEND_API_KEY and MAIL_FROM for the app's own mail", () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("MAIL_FROM", "");
    expect(ownMailConfigured()).toBe(false);
    vi.stubEnv("MAIL_FROM", "Westbrook Medical Practice <no-reply@srinesh.in>");
    expect(ownMailConfigured()).toBe(true);
  });

  it("refuses in production without a mail key, so a link is never silently lost", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RESEND_API_KEY", "");
    await expect(sendPasswordReset("sam@gmail.com", "https://x.test/reset")).rejects.toBeInstanceOf(MailNotConfiguredError);
  });

  it("sends one email with the link through Resend", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("MAIL_FROM", "Westbrook <no-reply@srinesh.in>");
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(sendPasswordReset("sam@gmail.com", "https://site.test/reset-password?t=abc")).resolves.toBe("email");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body.to).toEqual(["sam@gmail.com"]);
    expect(body.text).toContain("https://site.test/reset-password?t=abc");
  });

  it("escapes the link in the HTML part", () => {
    const mail = resetEmail({ link: "https://a.test/?a=1&b=<x>", minutes: 30, practiceName: "P", practiceShortName: "P" });
    expect(mail.html).toContain("a=1&amp;b=&lt;x&gt;");
    expect(mail.subject).toBe("Reset your P password");
  });
});
