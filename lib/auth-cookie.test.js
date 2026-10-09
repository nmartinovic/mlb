import { describe, expect, it } from "vitest";
import { hasSupabaseAuthCookie } from "./auth-cookie";

describe("hasSupabaseAuthCookie", () => {
  it("is false for an empty or missing cookie string", () => {
    expect(hasSupabaseAuthCookie("")).toBe(false);
    expect(hasSupabaseAuthCookie(undefined)).toBe(false);
  });

  it("detects a single session cookie", () => {
    expect(hasSupabaseAuthCookie("sb-abcd1234-auth-token=base64-eyJ")).toBe(true);
  });

  it("detects a chunked session cookie among others", () => {
    expect(
      hasSupabaseAuthCookie("ph_x=1; sb-abcd1234-auth-token.0=base64-eyJ; sb-abcd1234-auth-token.1=abc")
    ).toBe(true);
  });

  it("ignores the PKCE code-verifier cookie set mid-login", () => {
    expect(hasSupabaseAuthCookie("sb-abcd1234-auth-token-code-verifier=xyz")).toBe(false);
  });

  it("ignores an emptied session cookie", () => {
    expect(hasSupabaseAuthCookie("sb-abcd1234-auth-token=")).toBe(false);
  });

  it("ignores unrelated cookies", () => {
    expect(hasSupabaseAuthCookie("ph_phc_123_posthog=%7B%7D; theme=dark")).toBe(false);
  });
});
