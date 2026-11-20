import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  checkRateLimit,
  clientIpFrom,
  createPollRule,
  MAX_TRACKED_KEYS,
  resetRateLimits,
  trackedKeyCount,
  voteRule,
} from "@/lib/rate-limit";

const RULE = { max: 3, windowMs: 60_000 };

beforeEach(() => {
  resetRateLimits();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  delete process.env.RATE_LIMIT_CREATE_MAX;
  delete process.env.RATE_LIMIT_CREATE_WINDOW_SECONDS;
  delete process.env.RATE_LIMIT_VOTE_MAX;
});

describe("checkRateLimit", () => {
  it("allows up to max events in a window, then rejects", () => {
    expect(checkRateLimit("k", RULE)).toBe(true);
    expect(checkRateLimit("k", RULE)).toBe(true);
    expect(checkRateLimit("k", RULE)).toBe(true);
    expect(checkRateLimit("k", RULE)).toBe(false);
  });

  it("resets when the window elapses", () => {
    for (let i = 0; i < 4; i++) {
      checkRateLimit("k", RULE);
    }
    expect(checkRateLimit("k", RULE)).toBe(false);

    vi.advanceTimersByTime(RULE.windowMs);
    expect(checkRateLimit("k", RULE)).toBe(true);
  });

  it("tracks keys independently", () => {
    for (let i = 0; i < 3; i++) {
      checkRateLimit("a", RULE);
    }
    expect(checkRateLimit("a", RULE)).toBe(false);
    expect(checkRateLimit("b", RULE)).toBe(true);
  });

  it("does not evict a still-active long window on sweep", () => {
    // An hour-long window must survive the 10-minute cleanup sweep mid-flight.
    const hourRule = { max: 2, windowMs: 3_600_000 };
    checkRateLimit("create:u1", hourRule);
    checkRateLimit("create:u1", hourRule);

    // Cross several sweep intervals (sweeps trigger lazily on other checks).
    for (let i = 0; i < 3; i++) {
      vi.advanceTimersByTime(11 * 60 * 1000);
      checkRateLimit(`other:${i}`, RULE);
    }

    expect(checkRateLimit("create:u1", hourRule)).toBe(false);
  });
});

describe("env-tunable rules", () => {
  it("uses defaults when env is unset", () => {
    expect(createPollRule()).toEqual({ max: 20, windowMs: 3_600_000 });
    expect(voteRule()).toEqual({ max: 30, windowMs: 60_000 });
  });

  it("honors env overrides", () => {
    process.env.RATE_LIMIT_CREATE_MAX = "2";
    process.env.RATE_LIMIT_CREATE_WINDOW_SECONDS = "10";
    expect(createPollRule()).toEqual({ max: 2, windowMs: 10_000 });
  });

  it("falls back on a malformed override instead of uncapping", () => {
    process.env.RATE_LIMIT_VOTE_MAX = "lots";
    expect(voteRule().max).toBe(30);
    process.env.RATE_LIMIT_VOTE_MAX = "-5";
    expect(voteRule().max).toBe(30);
  });
});

describe("tracked-key cap (bounded memory)", () => {
  it("never tracks more than MAX_TRACKED_KEYS, even within one sweep interval", () => {
    for (let i = 0; i < MAX_TRACKED_KEYS + 500; i++) {
      checkRateLimit(`vote:spoof-${i}`, RULE);
    }
    expect(trackedKeyCount()).toBe(MAX_TRACKED_KEYS);
  });

  it("evicts the oldest window first, keeping recent counters intact", () => {
    // The oldest key gets evicted when the cap is hit…
    checkRateLimit("vote:oldest", RULE);
    vi.advanceTimersByTime(1);
    // …while a recent, exhausted key keeps its count.
    for (let i = 0; i < MAX_TRACKED_KEYS - 2; i++) {
      checkRateLimit(`vote:filler-${i}`, RULE);
    }
    for (let i = 0; i < 3; i++) {
      checkRateLimit("vote:recent", RULE);
    }
    expect(trackedKeyCount()).toBe(MAX_TRACKED_KEYS);

    checkRateLimit("vote:newcomer", RULE); // at cap → evicts "vote:oldest"
    expect(trackedKeyCount()).toBe(MAX_TRACKED_KEYS);
    expect(checkRateLimit("vote:recent", RULE)).toBe(false);
    // "oldest" starts a fresh window (it was evicted, not still counted).
    expect(checkRateLimit("vote:oldest", RULE)).toBe(true);
  });
});

describe("clientIpFrom (rate-limit key)", () => {
  afterEach(() => {
    delete process.env.CLIENT_IP_HEADER;
    delete process.env.TRUSTED_PROXY_HOPS;
  });

  it("keys on the proxy-appended (rightmost) x-forwarded-for entry by default", () => {
    const h = new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" });
    expect(clientIpFrom(h)).toBe("10.0.0.1");
  });

  it("falls back to one shared bucket when there's no trusted value", () => {
    // x-real-ip is client-settable unless a proxy sets it, so it's only used
    // when explicitly configured via CLIENT_IP_HEADER.
    expect(clientIpFrom(new Headers({ "x-real-ip": "198.51.100.4" }))).toBe(
      "unknown",
    );
    expect(clientIpFrom(new Headers())).toBe("unknown");
  });

  it("a rotating spoofed leftmost entry can't dodge the vote limit (regression)", () => {
    // The reported bypass: 100/100 requests with `spoof-<i>, 9.9.9.9` passed a
    // max-3 rule because the key was the client-controlled leftmost entry.
    let allowed = 0;
    for (let i = 0; i < 100; i++) {
      const h = new Headers({ "x-forwarded-for": `spoof-${i}, 9.9.9.9` });
      if (checkRateLimit(`vote:${clientIpFrom(h)}`, RULE)) {
        allowed += 1;
      }
    }
    expect(allowed).toBe(RULE.max);
  });

  it("honors CLIENT_IP_HEADER (e.g. cf-connecting-ip)", () => {
    process.env.CLIENT_IP_HEADER = "cf-connecting-ip";
    const h = new Headers({
      "cf-connecting-ip": "198.51.100.23",
      "x-forwarded-for": "1.1.1.1, 10.0.0.1",
    });
    expect(clientIpFrom(h)).toBe("198.51.100.23");
  });
});
