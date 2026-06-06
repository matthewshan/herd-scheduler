import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

// Edge-safe provider config (no Prisma). The adapter, database sessions, and
// the signIn gate live in auth.ts (Node runtime). Basic OIDC scopes only
// (openid, email, profile) — non-sensitive, so no Google verification needed
// (spec §7).
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
      // Link a Google sign-in to an existing user with the same email instead of
      // erroring with OAuthAccountNotLinked. "Dangerous" only for providers that
      // don't verify emails — safe here: Google verifies them and our signIn
      // callback additionally rejects email_verified=false. Also lets the
      // dev-login bypass and real Google coexist for the same address.
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  // Self-hosted / container deployments must opt in via AUTH_TRUST_HOST=true so
  // callback URLs and the OAuth response (incl. the `iss` parameter) are parsed
  // against AUTH_URL's origin. Left undefined when unset so Auth.js keeps its own
  // defaults (e.g. auto-trust on Vercel). See Auth.js deployment docs.
  trustHost: process.env.AUTH_TRUST_HOST === "true" ? true : undefined,
} satisfies NextAuthConfig;
