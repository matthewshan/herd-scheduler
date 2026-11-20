import { describe, expect, it } from "vitest";
import { slugsToPrune } from "@/lib/guest-history";

// The guest home's prune decision (Phase 12): only a successful summary fetch
// may drop history entries; a failed one must leave the list intact.
describe("slugsToPrune", () => {
  const requested = [
    "game-night-x9f2k3m7",
    "brunch-a1b2c3d4",
    "offsite-z9y8x7w6",
  ];

  it("prunes nothing when the fetch failed", () => {
    expect(slugsToPrune(requested, null)).toEqual([]);
  });

  it("prunes slugs the server didn't return (deleted polls)", () => {
    expect(
      slugsToPrune(requested, ["game-night-x9f2k3m7", "offsite-z9y8x7w6"]),
    ).toEqual(["brunch-a1b2c3d4"]);
  });

  it("prunes nothing when every poll came back", () => {
    expect(slugsToPrune(requested, [...requested].reverse())).toEqual([]);
  });

  it("prunes everything on a successful but empty response", () => {
    expect(slugsToPrune(requested, [])).toEqual(requested);
  });

  it("keeps a legacy long-titled slug the server returned", () => {
    const legacy = `${"a".repeat(200)}-x9f2k3m7`;
    expect(slugsToPrune([legacy], [legacy])).toEqual([]);
  });
});
