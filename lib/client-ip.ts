// Client-IP derivation — the single source for "who is this request from" used
// by the per-IP vote rate limit (lib/rate-limit.ts) and audit-log metadata
// (lib/access.ts `logAction`).
//
// The app never sees the TCP peer: server actions only get headers, and every
// reference deployment puts at least one proxy in front (Cloudflare Tunnel +
// Traefik, Vercel's edge, Caddy/nginx). So the address has to come from a
// header — and which header entry is trustworthy depends on the deployment:
//
// - **`X-Forwarded-For` is append-only and client-seeded.** Proxies append the
//   peer they saw to whatever the client sent, and Next.js only fills it in
//   when absent. The *leftmost* entry is therefore whatever the client typed —
//   keying on it let anyone mint a fresh rate-limit bucket per request. The
//   entries a client can't forge are the ones appended by our own proxies,
//   counted from the *right*.
// - **A single-value header set by a trusted edge** (e.g. Cloudflare's
//   `cf-connecting-ip`, which the edge overwrites on every request) is the most
//   robust source when the origin is only reachable through that edge.
//
// Configuration (read per call so tests and env changes need no rebuild):
//
// - `CLIENT_IP_HEADER` — if set, read the client IP *only* from this header
//   (e.g. `cf-connecting-ip` for the Cloudflare Tunnel home deployment,
//   `x-real-ip` behind an nginx that sets it). No fallback to XFF: a missing
//   value means the request bypassed the edge, and it lands in the shared
//   bucket rather than trusting a spoofable header.
// - `TRUSTED_PROXY_HOPS` (default `1`) — otherwise, take the Nth entry from
//   the *right* of `X-Forwarded-For`, where N is the number of proxies you run
//   that append to it. With the default, that's the address seen by the proxy
//   closest to the app — infrastructure-written, so a client can't rotate it.
//   If the chain is shorter than N (the request skipped a proxy), the result
//   is unknown rather than an attacker-controlled entry.
//
// Failure direction: every ambiguous case collapses to `null` (callers map it
// to one shared rate-limit bucket), which can only *under*-count distinct
// clients — throttling more, never letting one client dodge the limit. A
// misconfigured default (e.g. a proxy that overwrites XFF with its own peer)
// makes everyone share one bucket; set `CLIENT_IP_HEADER` / the hop count to
// match the deployment (see docs/deployment.md).
//
// Caveat: with *no* proxy in front, Next.js passes a client-sent XFF through
// verbatim, so no header is trustworthy. Always run behind a proxy (every
// reference deployment does).

const DEFAULT_TRUSTED_PROXY_HOPS = 1;

// Loose IPv4/IPv6 shape check (hex digits, dots, colons — covers IPv4-mapped
// IPv6 like `::ffff:1.2.3.4`). Not a full parser: it just stops a garbage or
// oversized header value from becoming a rate-limit key or an audit-log field.
const IP_SHAPE = /^[0-9a-fA-F.:]{2,45}$/;

function normalizeIp(raw: string | null | undefined): string | null {
  const value = raw?.trim();
  return value && IP_SHAPE.test(value) ? value : null;
}

function trustedProxyHops(): number {
  const raw = process.env.TRUSTED_PROXY_HOPS;
  if (!raw) {
    return DEFAULT_TRUSTED_PROXY_HOPS;
  }
  const n = Number(raw);
  // A bad value falls back to the safe default rather than e.g. 0/NaN
  // silently selecting the client-controlled leftmost entry.
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_TRUSTED_PROXY_HOPS;
}

/**
 * The best-known client IP for a request, or `null` when it can't be
 * determined from a trusted source. See the module comment for the
 * `CLIENT_IP_HEADER` / `TRUSTED_PROXY_HOPS` contract.
 */
export function resolveClientIp(headers: Headers): string | null {
  const header = process.env.CLIENT_IP_HEADER?.trim().toLowerCase();
  if (header) {
    return normalizeIp(headers.get(header));
  }

  const xff = headers.get("x-forwarded-for");
  if (!xff) {
    return null;
  }
  const hops = xff.split(",").map((entry) => entry.trim());
  const hopsFromRight = trustedProxyHops();
  if (hops.length < hopsFromRight) {
    return null;
  }
  return normalizeIp(hops[hops.length - hopsFromRight]);
}
