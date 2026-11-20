import { afterEach, describe, expect, it } from "vitest";

import { resolveClientIp } from "@/lib/client-ip";

afterEach(() => {
  delete process.env.CLIENT_IP_HEADER;
  delete process.env.TRUSTED_PROXY_HOPS;
});

const xff = (value: string) => new Headers({ "x-forwarded-for": value });

describe("resolveClientIp — default (TRUSTED_PROXY_HOPS=1, rightmost XFF)", () => {
  it("returns the single XFF entry (e.g. Vercel, which overwrites XFF)", () => {
    expect(resolveClientIp(xff("203.0.113.7"))).toBe("203.0.113.7");
  });

  it("takes the entry the nearest proxy appended, not the client's leftmost", () => {
    expect(resolveClientIp(xff("6.6.6.6, 203.0.113.7"))).toBe("203.0.113.7");
  });

  it("a spoofed leftmost entry never changes the key", () => {
    const a = resolveClientIp(xff("1.2.3.4, 203.0.113.7"));
    const b = resolveClientIp(xff("5.6.7.8, 9.9.9.9, 203.0.113.7"));
    const c = resolveClientIp(xff("spoof-42, 203.0.113.7"));
    expect(new Set([a, b, c])).toEqual(new Set(["203.0.113.7"]));
  });

  it("ignores client-settable x-real-ip unless configured", () => {
    expect(resolveClientIp(new Headers({ "x-real-ip": "1.2.3.4" }))).toBeNull();
  });

  it("returns null with no XFF at all", () => {
    expect(resolveClientIp(new Headers())).toBeNull();
  });

  it("accepts IPv6 (incl. IPv4-mapped) entries", () => {
    expect(resolveClientIp(xff("2001:db8::1"))).toBe("2001:db8::1");
    expect(resolveClientIp(xff("::ffff:203.0.113.7"))).toBe(
      "::ffff:203.0.113.7",
    );
  });

  it("rejects a garbage/oversized entry rather than using it as a key", () => {
    expect(resolveClientIp(xff("1.1.1.1, not-an-ip"))).toBeNull();
    expect(resolveClientIp(xff("1".repeat(100)))).toBeNull();
    expect(resolveClientIp(xff("1.1.1.1, "))).toBeNull();
  });
});

describe("resolveClientIp — TRUSTED_PROXY_HOPS=N", () => {
  it("takes the Nth entry from the right (e.g. Cloudflare → Traefik → app)", () => {
    process.env.TRUSTED_PROXY_HOPS = "2";
    // client-sent, real client (appended by edge), edge peer (appended by Traefik)
    expect(resolveClientIp(xff("6.6.6.6, 198.51.100.23, 10.42.0.9"))).toBe(
      "198.51.100.23",
    );
  });

  it("a spoofed leftmost entry doesn't change the key", () => {
    process.env.TRUSTED_PROXY_HOPS = "2";
    const a = resolveClientIp(xff("198.51.100.23, 10.42.0.9"));
    const b = resolveClientIp(xff("1.1.1.1, 198.51.100.23, 10.42.0.9"));
    const c = resolveClientIp(
      xff("2.2.2.2, 3.3.3.3, 198.51.100.23, 10.42.0.9"),
    );
    expect(new Set([a, b, c])).toEqual(new Set(["198.51.100.23"]));
  });

  it("returns null when the chain is shorter than the trusted hop count", () => {
    process.env.TRUSTED_PROXY_HOPS = "3";
    expect(resolveClientIp(xff("198.51.100.23, 10.42.0.9"))).toBeNull();
  });

  it.each(["0", "-1", "abc", "1.5"])(
    "a malformed value (%s) falls back to 1, never to the leftmost entry",
    (value) => {
      process.env.TRUSTED_PROXY_HOPS = value;
      expect(resolveClientIp(xff("6.6.6.6, 203.0.113.7"))).toBe("203.0.113.7");
    },
  );
});

describe("resolveClientIp — CLIENT_IP_HEADER", () => {
  it("reads only the configured header (case-insensitive name)", () => {
    process.env.CLIENT_IP_HEADER = "CF-Connecting-IP";
    const h = new Headers({
      "cf-connecting-ip": " 198.51.100.23 ",
      "x-forwarded-for": "6.6.6.6, 10.42.0.9",
    });
    expect(resolveClientIp(h)).toBe("198.51.100.23");
  });

  it("does not fall back to XFF when the header is missing (edge bypassed)", () => {
    process.env.CLIENT_IP_HEADER = "cf-connecting-ip";
    expect(resolveClientIp(xff("6.6.6.6"))).toBeNull();
  });

  it("a spoofed XFF never influences the key", () => {
    process.env.CLIENT_IP_HEADER = "cf-connecting-ip";
    const a = resolveClientIp(
      new Headers({ "cf-connecting-ip": "198.51.100.23" }),
    );
    const b = resolveClientIp(
      new Headers({
        "cf-connecting-ip": "198.51.100.23",
        "x-forwarded-for": "spoof-1, 1.1.1.1",
      }),
    );
    expect(a).toBe("198.51.100.23");
    expect(b).toBe("198.51.100.23");
  });

  it("rejects a non-IP value in the configured header", () => {
    process.env.CLIENT_IP_HEADER = "x-real-ip";
    expect(resolveClientIp(new Headers({ "x-real-ip": "a, b" }))).toBeNull();
  });
});
