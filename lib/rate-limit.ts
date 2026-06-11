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

const windows = new Map<string, Window>();

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
    windows.set(key, { startedAt: now, windowMs: rule.windowMs, count: 1 });
    return rule.max >= 1;
  }
  w.count += 1;
  return w.count <= rule.max;
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
 * The client IP for rate-limit keying, from the standard forwarding headers
 * (any reverse proxy — Cloudflare Tunnel included — sets `x-forwarded-for`;
 * the first hop is the client). Falls back to a shared bucket when no header
 * is present (direct local hits), which only ever under-counts distinct
 * clients, never lets one client dodge the limit.
 */
export function clientIpFrom(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }
  return headers.get("x-real-ip") ?? "unknown";
}
