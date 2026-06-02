import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

// Basic OIDC sign-in scopes only (openid, email, profile) — non-sensitive, so
// no Google verification is needed (spec §7). No allowlist gate or Prisma
// adapter yet; those arrive in Phase 4. JWT sessions are fine for now.
export const authConfig = {
  providers: [
    Google({
      authorization: {
        params: { scope: "openid email profile" },
      },
    }),
  ],
  session: { strategy: "jwt" },
} satisfies NextAuthConfig;
