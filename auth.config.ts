import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

// Basic OIDC sign-in scopes only (openid, email, profile) — non-sensitive, so
// no Google verification is needed (spec §7). No allowlist gate or Prisma
// adapter yet; those arrive in Phase 4. JWT sessions are fine for now.
export const authConfig = {
  providers: [
    Google({
      // Spec §4 standardizes on GOOGLE_CLIENT_ID/SECRET; Auth.js's Google
      // provider otherwise looks for AUTH_GOOGLE_ID/SECRET, so wire them
      // explicitly or client_id resolves to undefined.
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: { scope: "openid email profile" },
      },
    }),
  ],
  session: { strategy: "jwt" },
  // Self-hosted / container deployments must opt in via AUTH_TRUST_HOST=true so
  // callback URLs and the OAuth response (incl. the `iss` parameter) are parsed
  // against AUTH_URL's origin. Left undefined when unset so Auth.js keeps its own
  // defaults (e.g. auto-trust on Vercel). See Auth.js deployment docs.
  trustHost: process.env.AUTH_TRUST_HOST === "true" ? true : undefined,
} satisfies NextAuthConfig;
