import { describe, expect, it } from "vitest";
import { isDemoSignInEmail } from "./demo-accounts";

describe("isDemoSignInEmail", () => {
  it("accepts seeded non-admin accounts on the sample domain", () => {
    expect(isDemoSignInEmail("ann.lee@halden.example")).toBe(true);
    expect(isDemoSignInEmail(" Helen.Cho@Halden.Example ")).toBe(true);
    expect(isDemoSignInEmail("desk@halden.example")).toBe(true);
  });

  it("never covers the admin, real mailboxes, or unknown addresses", () => {
    expect(isDemoSignInEmail("admin@halden.example")).toBe(false);
    expect(isDemoSignInEmail("rudraksha.srinesh@gmail.com")).toBe(false);
    expect(isDemoSignInEmail("someone@halden.example")).toBe(false);
    expect(isDemoSignInEmail("ann.lee@example.com")).toBe(false);
  });
});
