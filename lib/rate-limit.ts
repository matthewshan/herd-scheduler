// Rate limiting for the abuse-sensitive writes (spec §9, Phase 10): poll
// creation and voting. Portable by construction — a fixed-window counter in
// process memory, no Redis or host service — which means the limit is
// **per replica**: N app replicas multiply the effective ceiling by N. That's
// the accepted trade-off for the home deployment (1 replica); a horizontally
// scaled deployment that needs a shared budget would swap the store behind
// `checkRateLimit` for an external one without touching the callers.
//
// These are preventive controls layered on top of the Phase 4 detective ones
// (audit log + blocklist) and the per-field size caps in `lib/limits.ts`.

import { resolveClientIp } from "@/lib/client-ip";

interface Window {
  /** Start of the current fixed window (ms epoch). */
  startedAt: number;
  /** Length of this window — kept on the entry so the sweeper knows expiry. */
  windowMs: number;
  count: number;
}

export interface RateLimitRule {
  /** Max allowed events per window. */
  max: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

// Insertion order doubles as window-start order: a key is (re)inserted at the
// back whenever its window starts, so the front of the map is always the
// oldest window — the cheapest eviction candidate when the cap is hit.
const windows = new Map<string, Window>();

/**
 * Hard ceiling on tracked keys. The periodic sweep alone doesn't bound memory:
 * a flood of distinct keys inside one sweep interval would each add an entry.
 * At the cap, inserting a new key evicts the oldest window first (O(1)). Each
 * entry is ~100–200 bytes, so this caps the store at a few MB. Eviction can
 * forgive an old, still-active window early — the price of bounded memory; a
 * single client can't exploit it because its key no longer rotates (see
 * lib/client-ip.ts).
 */
export const MAX_TRACKED_KEYS = 10_000;

// Opportunistic cleanup so abandoned keys (one-off IPs) don't accumulate
// forever in a long-lived process. Runs at most once per sweep interval,
// piggybacked on normal checks — no timer to leak in tests or serverless.
const SWEEP_INTERVAL_MS = 10 * 60 * 1000;
let lastSweep = 0;

function sweep(now: number): void {
  if (now - lastSweep < SWEEP_INTERVAL_MS) {
    return;
  }
  lastSweep = now;
  for (const [key, w] of windows) {
    if (now - w.startedAt >= w.windowMs) {
      windows.delete(key);
    }
  }
}

/**
 * Record one event for `key` and report whether it stays within `rule`.
 * Returns `true` when allowed, `false` when the caller should reject. Callers
 * prefix the key with the action (`create:`/`vote:`) so budgets don't mix.
 */
export function checkRateLimit(key: string, rule: RateLimitRule): boolean {
  const now = Date.now();
  sweep(now);

  const w = windows.get(key);
  if (!w || now - w.startedAt >= rule.windowMs) {
    // Delete-then-set moves a restarted key to the back (see `windows`).
    windows.delete(key);
    while (windows.size >= MAX_TRACKED_KEYS) {
      const oldest = windows.keys().next().value;
      if (oldest === undefined) {
        break;
      }
      windows.delete(oldest);
    }
    windows.set(key, { startedAt: now, windowMs: rule.windowMs, count: 1 });
    return rule.max >= 1;
  }
  w.count += 1;
  return w.count <= rule.max;
}

/** Test hook: how many keys the limiter is currently tracking. */
export function trackedKeyCount(): number {
  return windows.size;
}

/** Test hook: forget all windows. */
export function resetRateLimits(): void {
  windows.clear();
  lastSweep = 0;
}

// Positive-integer env override with a fallback — bad values fall back rather
// than silently disabling the limit.
function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const n = Number.parseInt(raw, 10);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

/**
 * Per-creator poll-creation budget (keyed by user id — creation is always
 * authenticated). Read per call so env tuning needs no rebuild logic in tests.
 */
export function createPollRule(): RateLimitRule {
  return {
    max: envInt("RATE_LIMIT_CREATE_MAX", 20),
    windowMs: envInt("RATE_LIMIT_CREATE_WINDOW_SECONDS", 3600) * 1000,
  };
}

/**
 * Per-IP voting budget. IP-keyed (not guest-key-keyed) because a guest key is
 * client-minted — an abuser can mint a fresh one per request, but not a fresh
 * address. Generous enough for a shared household NAT voting together.
 */
export function voteRule(): RateLimitRule {
  return {
    max: envInt("RATE_LIMIT_VOTE_MAX", 30),
    windowMs: envInt("RATE_LIMIT_VOTE_WINDOW_SECONDS", 60) * 1000,
  };
}

/**
 * The client IP for rate-limit keying — derived by the shared, deployment-
 * configurable helper in lib/client-ip.ts (`CLIENT_IP_HEADER` /
 * `TRUSTED_PROXY_HOPS`), never the client-controlled leftmost
 * `x-forwarded-for` entry. Falls back to one shared `"unknown"` bucket when no
 * trusted value is present, which only ever under-counts distinct clients,
 * never lets one client dodge the limit.
 */
export function clientIpFrom(headers: Headers): string {
  return resolveClientIp(headers) ?? "unknown";
}
