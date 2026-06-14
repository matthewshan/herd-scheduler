import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  checkRateLimit,
  clientIpFrom,
  createPollRule,
  resetRateLimits,
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

describe("clientIpFrom", () => {
  it("takes the first hop of x-forwarded-for", () => {
    const h = new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" });
    expect(clientIpFrom(h)).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip, then a shared bucket", () => {
    expect(clientIpFrom(new Headers({ "x-real-ip": "198.51.100.4" }))).toBe(
      "198.51.100.4",
    );
    expect(clientIpFrom(new Headers())).toBe("unknown");
  });
});
