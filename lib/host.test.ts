import { describe, expect, it } from "vitest";
import { hostFirstName } from "@/lib/host";

describe("hostFirstName", () => {
  it("returns the first word of the host's name", () => {
    expect(hostFirstName("Alex Rivera")).toBe("Alex");
    expect(hostFirstName("  Sam  ")).toBe("Sam");
  });

  it("returns null (never an email fallback) when there's no usable name", () => {
    expect(hostFirstName(null)).toBeNull();
    expect(hostFirstName(undefined)).toBeNull();
    expect(hostFirstName("   ")).toBeNull();
  });
});
