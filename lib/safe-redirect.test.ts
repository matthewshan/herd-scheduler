import { describe, expect, it } from "vitest";
import { safeCallbackUrl } from "@/lib/safe-redirect";

const ORIGIN = "http://localhost:3000";

describe("safeCallbackUrl", () => {
  it("keeps a same-origin path (with query + hash)", () => {
    expect(safeCallbackUrl("/admin?action=signin#x", ORIGIN).href).toBe(
      "http://localhost:3000/admin?action=signin#x",
    );
  });

  it("falls back to / when missing or empty", () => {
    expect(safeCallbackUrl(null, ORIGIN).href).toBe(`${ORIGIN}/`);
    expect(safeCallbackUrl("", ORIGIN).href).toBe(`${ORIGIN}/`);
  });

  it.each([
    "https://evil.com/",
    "//evil.com",
    "///evil.com",
    "/\\evil.com",
    "/\t/evil.com",
    "javascript:alert(1)",
    "evil.com",
    "admin",
  ])("rejects off-origin or non-path value %j", (raw) => {
    expect(safeCallbackUrl(raw, ORIGIN).href).toBe(`${ORIGIN}/`);
  });
});
