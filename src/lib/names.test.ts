import { describe, expect, it } from "vitest";
import { salutation } from "./names";

describe("salutation", () => {
  it("uses the surname after a doctor's title, never the bare title", () => {
    expect(salutation("Dr Callum Reid")).toBe("Dr Reid");
    expect(salutation("Dr. Amara Adeyemi")).toBe("Dr Adeyemi");
    expect(salutation("dr  Srinesh")).toBe("Dr Srinesh");
    expect(salutation("Dr")).toBe("Doctor");
  });
  it("uses the first name for everyone else", () => {
    expect(salutation("Test Patient p3a")).toBe("Test");
    expect(salutation("  Ann Lee ")).toBe("Ann");
    expect(salutation("")).toBe("there");
  });
});
