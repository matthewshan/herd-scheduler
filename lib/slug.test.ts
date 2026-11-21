import { describe, expect, it } from "vitest";
import { makeSlug, SLUG_BASE_MAX_LENGTH, SLUG_RE, slugify } from "@/lib/slug";

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

  it("transliterates letters NFKD leaves alone instead of hyphenating them", () => {
    expect(slugify("Straße")).toBe("strasse");
    expect(slugify("STRAẞE")).toBe("strasse");
    expect(slugify("Æsir Smørrebrød Œuvre")).toBe("aesir-smorrebrod-oeuvre");
    expect(slugify("Łódź Þing")).toBe("lodz-thing");
  });

  describe("length cap", () => {
    it("caps a max-length (200-char) title at SLUG_BASE_MAX_LENGTH", () => {
      const title = "Quarterly planning offsite ".repeat(8).slice(0, 200);
      expect(title).toHaveLength(200);
      const slug = slugify(title);
      expect(slug.length).toBeLessThanOrEqual(SLUG_BASE_MAX_LENGTH);
      expect(slug.length).toBeGreaterThan(SLUG_BASE_MAX_LENGTH / 2);
      expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/); // no edge/double hyphens
    });

    it("cuts at a hyphen (word boundary), never mid-word", () => {
      // 12 × "word-" … every cut must land on a whole "word".
      const slug = slugify("word ".repeat(40));
      expect(slug).toMatch(/^word(-word)*$/);
      expect(slug.length).toBeLessThanOrEqual(SLUG_BASE_MAX_LENGTH);
    });

    it("handles a word boundary right at the limit", () => {
      // 59 a's + "-b" is 61 chars, so "b" doesn't fit: cut back to the 59 a's.
      const fiftyNine = "a".repeat(59);
      expect(slugify(`${fiftyNine} b c`)).toBe(fiftyNine);
      // A 60-char first word followed by a hyphen fits exactly — keep it all.
      const sixty = "a".repeat(60);
      expect(slugify(`${sixty} more words`)).toBe(sixty);
    });

    it("never leaves a trailing hyphen", () => {
      for (let n = 1; n <= 200; n++) {
        const slug = slugify(`${"x".repeat(n)} ${"y ".repeat(100)}`);
        expect(slug.endsWith("-")).toBe(false);
        expect(slug.length).toBeLessThanOrEqual(SLUG_BASE_MAX_LENGTH);
      }
    });

    it("hard-cuts a single over-long word rather than collapsing to a stub", () => {
      expect(slugify("a".repeat(200))).toBe("a".repeat(SLUG_BASE_MAX_LENGTH));
      // A short lead word + a giant one: don't cut back to just "hi".
      expect(slugify(`hi ${"z".repeat(200)}`)).toBe(
        `hi-${"z".repeat(SLUG_BASE_MAX_LENGTH - 3)}`,
      );
    });

    it("leaves titles under the cap untouched", () => {
      expect(slugify("Game night at Sam's")).toBe("game-night-at-sam-s");
    });
  });
});

describe("SLUG_RE", () => {
  it("accepts freshly minted slugs at the max length", () => {
    const slug = makeSlug("word ".repeat(40));
    expect(SLUG_RE.test(slug)).toBe(true);
  });

  it("accepts legacy uncapped slugs (200-char base + suffix)", () => {
    // Minted before the cap: a 200-char title → 200-char base + "-" + 8.
    const legacy = `${"a".repeat(200)}-x9f2k3m7`;
    expect(legacy).toHaveLength(209);
    expect(SLUG_RE.test(legacy)).toBe(true);
    // The old 80-char bound rejected these — the bug this guards against.
    expect(SLUG_RE.test(`${"long-title-".repeat(9)}x9f2k3m7`)).toBe(true);
  });

  it("rejects junk", () => {
    expect(SLUG_RE.test("")).toBe(false);
    expect(SLUG_RE.test("Game-Night")).toBe(false);
    expect(SLUG_RE.test("game night")).toBe(false);
    expect(SLUG_RE.test("../etc/passwd")).toBe(false);
    expect(SLUG_RE.test("game_night")).toBe(false);
    expect(SLUG_RE.test("game-night\n")).toBe(false);
    expect(SLUG_RE.test("a".repeat(221))).toBe(false);
  });
});

describe("makeSlug", () => {
  it("appends an 8-char lowercase-alphanumeric suffix", () => {
    expect(makeSlug("Game Night")).toMatch(/^game-night-[0-9a-z]{8}$/);
  });

  it("produces a distinct suffix across calls", () => {
    // Astronomically unlikely to collide; guards against a non-random suffix.
    const slugs = new Set(Array.from({ length: 50 }, () => makeSlug("x")));
    expect(slugs.size).toBe(50);
  });
});
