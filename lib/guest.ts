// Persistent guest identity (Phase 9, spec §6/§9). A guest is remembered on
// their own device via a soft, per-browser identity in localStorage — an opaque
// client-minted key, never a server-side login. The key is the guest's *only*
// credential: it lives in their browser, is sent only with their own
// submits/loads, and is never returned to any other viewer (anonymity guard).
//
// Client-safe module: no Prisma / server-only imports. Both the VoteForm client
// and the server actions (shape validation) import from here so the storage
// keys and the key format can't drift.

import { customAlphabet } from "nanoid";

/** localStorage key for the durable per-browser guest key (global, not per-poll). */
export const GUEST_ID_STORAGE_KEY = "herd-guest-id";
/** localStorage key for the last display name the guest used (pre-fill everywhere). */
export const GUEST_NAME_STORAGE_KEY = "herd-guest-name";

// Lowercase+digit alphabet (same family as slugs); 21 chars ≈ 108 bits — far
// beyond guessable, so a key can't be enumerated to read someone else's ballot.
const KEY_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";
const KEY_LENGTH = 21;
const makeKey = customAlphabet(KEY_ALPHABET, KEY_LENGTH);

/** Mint a fresh guest key (client-side, on first guest interaction). */
export function mintGuestKey(): string {
  return makeKey();
}

/**
 * Server-side shape check for a client-supplied guest key. Deliberately a bit
 * looser than what `mintGuestKey` produces (any URL-safe id, 16–64 chars) so a
 * future format tweak doesn't strand existing browsers' stored keys.
 */
export function isValidGuestKey(key: unknown): key is string {
  return typeof key === "string" && /^[0-9A-Za-z_-]{16,64}$/.test(key);
}
