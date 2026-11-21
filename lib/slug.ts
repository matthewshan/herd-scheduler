// Slug generation (spec §6): kebab(title) + "-" + nanoid(8), unique with retry
// on collision. Exposed for the create flow (Phase 5).

import { customAlphabet } from "nanoid";
import { prisma } from "@/lib/prisma";

// Lowercase alphanumerics only, so slugs stay URL-safe and human-recognizable.
// An 8-char suffix over a 36-char alphabet is ~2.8e12 combinations per title, so
// the collision retry below effectively never fires and the unguessable space
// keeps URLs non-enumerable (spec §9).
const SUFFIX_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";
const SUFFIX_LENGTH = 8;
const nanoid = customAlphabet(SUFFIX_ALPHABET, SUFFIX_LENGTH);

// Cap on the kebab base so a long title (up to LIMITS.title = 200 chars) still
// yields a readable, bounded URL. A full slug is therefore at most
// SLUG_BASE_MAX_LENGTH + 1 + SUFFIX_LENGTH (69) chars.
export const SLUG_BASE_MAX_LENGTH = 60;

/**
 * Shape check for an untrusted slug off the client (the home-screen actions).
 * Single source of truth for "looks like a slug". The upper bound is
 * deliberately generous: slugs minted before the base cap existed can carry an
 * uncapped base (a 200-char title → ~200 + "-" + 8), and those polls must keep
 * resolving — rejecting them made long-titled polls vanish from the guest home.
 */
export const SLUG_RE = /^[a-z0-9-]{1,220}$/;

// Latin letters NFKD doesn't decompose to an ASCII base, transliterated so they
// don't collapse into a hyphen ("Straße" → "strasse", not "stra-e"). Applied
// after lowercasing, so the uppercase forms (ẞ, Æ, Ø, Œ, …) are covered too.
const TRANSLITERATIONS: Readonly<Record<string, string>> = {
  ß: "ss",
  æ: "ae",
  œ: "oe",
  ø: "o",
  ł: "l",
  đ: "d",
  ð: "d",
  þ: "th",
};
const TRANSLITERATION_RE = new RegExp(
  `[${Object.keys(TRANSLITERATIONS).join("")}]`,
  "g",
);

/**
 * Trim a kebab string to at most `max` chars, preferring to cut at a hyphen
 * (word boundary) and never leaving a trailing hyphen. A single over-long word
 * (no hyphen in the back half of the window) is hard-cut instead, so we don't
 * throw away most of the length budget.
 */
function truncateKebab(base: string, max: number): string {
  if (base.length <= max) {
    return base;
  }
  // Look one char past the limit: if that char is a hyphen, the first `max`
  // chars already end exactly on a word boundary.
  const window = base.slice(0, max + 1);
  const lastHyphen = window.lastIndexOf("-");
  const cut =
    lastHyphen >= Math.floor(max / 2)
      ? base.slice(0, lastHyphen)
      : base.slice(0, max);
  return cut.replace(/-+$/, "");
}

/**
 * kebab-case a title: lowercase, transliterate/strip accents, collapse
 * punctuation to "-", and cap at SLUG_BASE_MAX_LENGTH (on a word boundary
 * where possible).
 */
export function slugify(title: string): string {
  const base = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritical marks
    .toLowerCase()
    .replace(TRANSLITERATION_RE, (ch) => TRANSLITERATIONS[ch] ?? "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return truncateKebab(base, SLUG_BASE_MAX_LENGTH) || "poll";
}

/** A single slug candidate: `kebab(title)-<8 char suffix>`. */
export function makeSlug(title: string): string {
  return `${slugify(title)}-${nanoid()}`;
}

/**
 * Generate a slug that doesn't yet exist, retrying on the unique collision.
 * Five tries is astronomically safe given the 36^8 suffix space per title.
 */
export async function generateUniqueSlug(
  title: string,
  maxAttempts = 5,
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = makeSlug(title);
    const existing = await prisma.poll.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing) {
      return candidate;
    }
  }
  throw new Error(
    `Could not generate a unique slug for "${title}" after ${maxAttempts} attempts`,
  );
}
