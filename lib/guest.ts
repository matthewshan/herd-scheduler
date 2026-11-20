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

/**
 * localStorage key for the one-shot "pending claim" marker: a timestamp written
 * the moment a guest who holds a stored identity starts a Google sign-in. The
 * next signed-in screen consumes it and adopts the guest's ballots into the
 * account. Without it, *any* later sign-in on this browser (a different person
 * on a shared laptop, or the same person days later) would silently absorb the
 * stored guest identity.
 */
export const GUEST_CLAIM_STORAGE_KEY = "herd-guest-claim";
/** A pending-claim marker older than this is ignored (the hop never finished). */
export const PENDING_CLAIM_TTL_MS = 60 * 60 * 1000;

/** The subset of the Web Storage API these helpers need (injectable for tests). */
export type GuestStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/**
 * Record that this browser is about to do the guest → sign-in hop. Only writes
 * when a guest identity is actually stored — with no key there's nothing to
 * claim. Returns whether a marker was written.
 */
export function markPendingClaim(
  storage: GuestStorage,
  now: number = Date.now(),
): boolean {
  if (!storage.getItem(GUEST_ID_STORAGE_KEY)) {
    return false;
  }
  storage.setItem(GUEST_CLAIM_STORAGE_KEY, String(now));
  return true;
}

/**
 * Consume the pending-claim marker: always removes it (one-shot), and returns
 * true only when it was set within the last `PENDING_CLAIM_TTL_MS`. A missing,
 * malformed, future-dated, or stale marker yields false.
 */
export function takePendingClaim(
  storage: GuestStorage,
  now: number = Date.now(),
): boolean {
  const raw = storage.getItem(GUEST_CLAIM_STORAGE_KEY);
  if (raw === null) {
    return false;
  }
  storage.removeItem(GUEST_CLAIM_STORAGE_KEY);
  const at = Number(raw);
  if (!raw.trim() || !Number.isFinite(at)) {
    return false;
  }
  const age = now - at;
  return age >= 0 && age <= PENDING_CLAIM_TTL_MS;
}

/**
 * Forget this browser's guest identity (key, last-used name, pending claim) —
 * after it's been claimed into an account, or when a guest chooses "Start
 * fresh" — so the next person on the device can't inherit it.
 */
export function clearGuestIdentity(storage: GuestStorage): void {
  storage.removeItem(GUEST_ID_STORAGE_KEY);
  storage.removeItem(GUEST_NAME_STORAGE_KEY);
  storage.removeItem(GUEST_CLAIM_STORAGE_KEY);
}
