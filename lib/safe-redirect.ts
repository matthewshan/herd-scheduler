// Open-redirect guard for user-supplied post-login destinations.

/**
 * Resolve a user-supplied `callbackUrl` to a same-origin URL, or `/` on the
 * request origin when it isn't one. Only a single-slash path is accepted:
 * absolute URLs (`https://evil.com`), protocol-relative ones (`//evil.com`) and
 * anything the URL parser would resolve off-origin (e.g. `/\evil.com`) fall
 * back to the home page.
 */
export function safeCallbackUrl(raw: string | null, origin: string): URL {
  const fallback = new URL("/", origin);
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return fallback;
  }
  let resolved: URL;
  try {
    resolved = new URL(raw, origin);
  } catch {
    return fallback;
  }
  return resolved.origin === fallback.origin ? resolved : fallback;
}
