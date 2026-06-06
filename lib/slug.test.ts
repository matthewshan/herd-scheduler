import { describe, expect, it } from "vitest";
import { makeSlug, slugify } from "@/lib/slug";

// Pure slug shaping — no DB. (generateUniqueSlug's collision-retry is DB-backed
// and is covered by the Phase 9 integration layer.)
describe("slugify", () => {
  it("kebab-cases a normal title", () => {
    expect(slugify("Game Night")).toBe("game-night");
  });

  it("lowercases and collapses punctuation/whitespace to single dashes", () => {
    expect(slugify("  Friday   Night!! Dinner  ")).toBe("friday-night-dinner");
  });

  it("strips accents/diacritics", () => {
    expect(slugify("Café Crawl")).toBe("cafe-crawl");
  });

  it("trims leading/trailing dashes", () => {
    expect(slugify("!!!hello!!!")).toBe("hello");
  });

  it("falls back to 'poll' when nothing usable remains", () => {
    expect(slugify("!!!")).toBe("poll");
    expect(slugify("")).toBe("poll");
  });
});

describe("makeSlug", () => {
  it("appends a 5-char lowercase-alphanumeric suffix", () => {
    expect(makeSlug("Game Night")).toMatch(/^game-night-[0-9a-z]{5}$/);
  });

  it("produces a distinct suffix across calls", () => {
    // Astronomically unlikely to collide; guards against a non-random suffix.
    const slugs = new Set(Array.from({ length: 50 }, () => makeSlug("x")));
    expect(slugs.size).toBe(50);
  });
});
