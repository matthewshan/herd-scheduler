import { describe, expect, it } from "vitest";
import {
  GUEST_CLAIM_STORAGE_KEY,
  GUEST_ID_STORAGE_KEY,
  GUEST_NAME_STORAGE_KEY,
  PENDING_CLAIM_TTL_MS,
  clearGuestIdentity,
  isValidGuestKey,
  markPendingClaim,
  mintGuestKey,
  takePendingClaim,
} from "@/lib/guest";

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

// Minimal in-memory Storage for the localStorage helpers (node env has none).
function memoryStorage(seed: Record<string, string> = {}) {
  const map = new Map(Object.entries(seed));
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

const KEY = "abc123abc123abc123abc";
const NOW = 1_800_000_000_000;

describe("markPendingClaim", () => {
  it("writes the marker only when a guest identity is stored", () => {
    const empty = memoryStorage();
    expect(markPendingClaim(empty, NOW)).toBe(false);
    expect(empty.map.has(GUEST_CLAIM_STORAGE_KEY)).toBe(false);

    const guest = memoryStorage({ [GUEST_ID_STORAGE_KEY]: KEY });
    expect(markPendingClaim(guest, NOW)).toBe(true);
    expect(guest.map.get(GUEST_CLAIM_STORAGE_KEY)).toBe(String(NOW));
  });
});

describe("takePendingClaim", () => {
  it("is false when no marker is set (an ordinary signed-in visit)", () => {
    expect(takePendingClaim(memoryStorage(), NOW)).toBe(false);
  });

  it("is true for a fresh marker, and is one-shot", () => {
    const s = memoryStorage({ [GUEST_CLAIM_STORAGE_KEY]: String(NOW - 5000) });
    expect(takePendingClaim(s, NOW)).toBe(true);
    expect(s.map.has(GUEST_CLAIM_STORAGE_KEY)).toBe(false);
    expect(takePendingClaim(s, NOW)).toBe(false);
  });

  it("rejects (and clears) a stale, future-dated, or malformed marker", () => {
    for (const raw of [
      String(NOW - PENDING_CLAIM_TTL_MS - 1),
      String(NOW + 60_000),
      "not-a-number",
      "",
    ]) {
      const s = memoryStorage({ [GUEST_CLAIM_STORAGE_KEY]: raw });
      expect(takePendingClaim(s, NOW)).toBe(false);
      expect(s.map.has(GUEST_CLAIM_STORAGE_KEY)).toBe(false);
    }
  });

  it("accepts a marker exactly at the TTL boundary", () => {
    const s = memoryStorage({
      [GUEST_CLAIM_STORAGE_KEY]: String(NOW - PENDING_CLAIM_TTL_MS),
    });
    expect(takePendingClaim(s, NOW)).toBe(true);
  });
});

describe("clearGuestIdentity", () => {
  it("removes the key, the name, and any pending claim — nothing else", () => {
    const s = memoryStorage({
      [GUEST_ID_STORAGE_KEY]: KEY,
      [GUEST_NAME_STORAGE_KEY]: "Alice",
      [GUEST_CLAIM_STORAGE_KEY]: String(NOW),
      "herd-theme": "dark",
    });
    clearGuestIdentity(s);
    expect([...s.map.keys()]).toEqual(["herd-theme"]);
  });
});
