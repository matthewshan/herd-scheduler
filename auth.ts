import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/prisma";
import {
  isEmailBlocked,
  isOwnerEmail,
  logAction,
  normalizeEmail,
} from "@/lib/access";

// Phase 4: layer the Prisma adapter + database sessions onto the edge-safe
// provider config (auth.config.ts). The adapter persists User/Account/Session;
// the signIn callback is the authentication gate (verified email + blocklist),
// and the events bootstrap the owner and write the sign-in audit row.
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  callbacks: {
    // Authentication gate. Returning false denies sign-in *before* any user is
    // created, so blocked / unverified accounts never get an identity.
    async signIn({ user, profile }) {
      // Google sets email_verified on the ID token; reject anything unverified.
      // Fail closed: a missing profile (no OAuth identity) never passes the gate.
      if (profile?.email_verified !== true) return false;
      const email = user.email ?? (profile?.email as string | undefined);
      if (await isEmailBlocked(email)) return false;
      return true;
    },
    // Database strategy: `user` is the full DB row (incl. isOwner). Surface id +
    // isOwner so UI can gate without an extra query (security gates re-check DB).
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.isOwner =
          (user as { isOwner?: boolean }).isOwner === true ||
          isOwnerEmail(user.email);
      }
      return session;
    },
  },
  events: {
    // Owner bootstrap is order-independent: whenever the OWNER_EMAIL user signs
    // in, ensure the isOwner flag and an AllowedCreator row exist. Idempotent.
    async signIn({ user }) {
      if (!user.email) return;
      const email = normalizeEmail(user.email);
      if (isOwnerEmail(email)) {
        if (user.id) {
          await prisma.user.update({
            where: { id: user.id },
            data: { isOwner: true },
          });
        }
        await prisma.allowedCreator.upsert({
          where: { email },
          create: { email, addedBy: "system:owner-bootstrap" },
          update: {},
        });
      }
      await logAction({
        action: "signin",
        actorUserId: user.id,
        actorEmail: user.email,
      });
    },
  },
});
