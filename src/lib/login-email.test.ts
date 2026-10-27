import { describe, expect, it } from "vitest";
import { loginEmail } from "./login-email";

describe("loginEmail", () => {
  const email = loginEmail({
    code: "042917",
    minutes: 10,
    practiceName: "Westbrook Medical Practice",
    practiceShortName: "Westbrook",
    address: "14 Westbrook Place, Edinburgh EH8 9RL",
  });

  it("puts the code and expiry in the subject, text and HTML", () => {
    expect(email.subject).toBe("042917 is your Westbrook sign-in code");
    expect(email.text).toContain("042917");
    expect(email.text).toContain("expires in 10 minutes");
    expect(email.html).toContain(">042917<");
    expect(email.html).toContain("10 minutes");
  });

  it("escapes practice details in the HTML", () => {
    const html = loginEmail({ code: "1234", minutes: 1, practiceName: "A & <B>", practiceShortName: "A" }).html;
    expect(html).toContain("A &amp; &lt;B&gt;");
    expect(html).toContain("1 minute<");
  });
});
