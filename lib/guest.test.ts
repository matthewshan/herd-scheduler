import { describe, expect, it } from "vitest";
import { isValidGuestKey, mintGuestKey } from "@/lib/guest";

describe("mintGuestKey", () => {
  it("mints distinct keys that pass the server-side shape check", () => {
    const a = mintGuestKey();
    const b = mintGuestKey();
    expect(a).not.toBe(b);
    expect(isValidGuestKey(a)).toBe(true);
    expect(isValidGuestKey(b)).toBe(true);
  });
});

describe("isValidGuestKey", () => {
  it("rejects non-strings, short, long, and out-of-alphabet keys", () => {
    expect(isValidGuestKey(undefined)).toBe(false);
    expect(isValidGuestKey(null)).toBe(false);
    expect(isValidGuestKey(42)).toBe(false);
    expect(isValidGuestKey("")).toBe(false);
    expect(isValidGuestKey("short")).toBe(false);
    expect(isValidGuestKey("x".repeat(65))).toBe(false);
    expect(isValidGuestKey("has spaces not allowed!!")).toBe(false);
    // SQL-ish / path-ish payloads stay out.
    expect(isValidGuestKey("'; DROP TABLE polls;--")).toBe(false);
  });

  it("accepts URL-safe ids between 16 and 64 chars", () => {
    expect(isValidGuestKey("abc123ABC456_-xy")).toBe(true);
    expect(isValidGuestKey("x".repeat(64))).toBe(true);
  });
});
