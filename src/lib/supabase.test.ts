import { describe, expect, it } from "vitest";
import { isAuthCookie } from "./supabase";

describe("isAuthCookie", () => {
  it("matches Supabase auth cookies, chunked or not", () => {
    expect(isAuthCookie("sb-abcd1234-auth-token")).toBe(true);
    expect(isAuthCookie("sb-abcd1234-auth-token.0")).toBe(true);
    expect(isAuthCookie("sb-abcd1234-auth-token.12")).toBe(true);
    expect(isAuthCookie("sb-abcd1234-auth-token-code-verifier")).toBe(true);
  });

  it("leaves other cookies alone", () => {
    expect(isAuthCookie("hsp_session")).toBe(false);
    expect(isAuthCookie("sb-abcd1234-other")).toBe(false);
    expect(isAuthCookie("theme")).toBe(false);
  });
});
