import { describe, expect, it } from "vitest";
import { formatPhone, normalisePhone, phoneSearchText, validatePhone } from "./phone";

describe("normalisePhone", () => {
  it("accepts Indian mobiles in every common shape", () => {
    for (const input of [
      "9154222171", "09154222171", "+919154222171", "+91 91542 22171", "+91-91542-22171",
      "91 91542 22171", "0091 91542 22171", "+91 (0) 91542 22171", "+91.91542.22171",
    ]) {
      expect(normalisePhone(input), input).toBe("+919154222171");
    }
    expect(normalisePhone("+91 98765 43210")).toBe("+919876543210");
    expect(normalisePhone("9876543210")).toBe("+919876543210");
  });

  it("keeps UK numbers working", () => {
    for (const input of ["07700 900123", "07700900123", "+447700900123", "+44 7700 900123", "+44 (0) 7700 900123", "00447700900123", "(07700) 900-123"]) {
      expect(normalisePhone(input), input).toBe("+447700900123");
    }
    expect(normalisePhone("0131 496 0280")).toBe("+441314960280");
  });

  it("accepts any international number of 7 to 15 digits", () => {
    expect(normalisePhone("+1 (415) 555-0132")).toBe("+14155550132");
    expect(normalisePhone("+61 412 345 678")).toBe("+61412345678");
    expect(normalisePhone("+971 50 123 4567")).toBe("+971501234567");
    expect(normalisePhone("+1234567")).toBe("+1234567");
    expect(normalisePhone("+123456789012345")).toBe("+123456789012345");
    expect(normalisePhone("4155550132")).toBe("4155550132");
  });

  it("rejects what isn't a number", () => {
    for (const input of ["", "  ", "abc", "call me", "+12345", "+1234567890123456", "123456", "+0123456789", "98765 4321x", "++919876543210", "12-34"]) {
      expect(normalisePhone(input), input).toBeNull();
    }
  });
});

describe("validatePhone and formatting", () => {
  it("explains a bad number without naming only the UK", () => {
    expect(validatePhone("")).toBe("Enter a mobile number.");
    expect(validatePhone("12")).toMatch(/\+91 98765 43210/);
    expect(validatePhone("+91 98765 43210")).toBeUndefined();
    expect(validatePhone("9876543210")).toBeUndefined();
  });

  it("reads back as people write numbers", () => {
    expect(formatPhone("+447700900123")).toBe("07700 900123");
    expect(formatPhone("9876543210")).toBe("+91 98765 43210");
    expect(formatPhone("+61412345678")).toBe("+61412345678");
    expect(formatPhone("not a number")).toBe("not a number");
  });

  it("finds a number by how it's written or stored", () => {
    const text = phoneSearchText("+447700900123");
    expect(text).toContain("07700900123");
    expect(text).toContain("447700900123");
    expect(phoneSearchText("07700 900123")).toContain("07700900123");
  });
});
