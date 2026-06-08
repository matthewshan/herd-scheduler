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

/** kebab-case a title: lowercase, strip accents/punctuation, collapse to "-". */
export function slugify(title: string): string {
  const base = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritical marks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "poll";
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
