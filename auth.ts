import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/prisma";
import {
  AUDIT_ACTIONS,
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
      // isEmailBlocked exempts the owner, so a stale BlockedEmail row can never
      // lock OWNER_EMAIL out (email_verified above still applies to the owner).
      if (await isEmailBlocked(email)) return false;
      return true;
    },
    // Surface id + isOwner so UI can gate without an extra query. Owner is
    // derived from OWNER_EMAIL only — the DB `isOwner` column is a mirror and is
    // never trusted for authorization (it could be stale after OWNER_EMAIL moves).
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.isOwner = isOwnerEmail(user.email);
      }
      return session;
    },
  },
  events: {
    // Owner bootstrap is order-independent: whenever someone signs in, re-sync
    // the informational isOwner mirror to OWNER_EMAIL (true *or* false, so a
    // former owner's flag is cleared), and ensure the owner has an
    // AllowedCreator row. Idempotent.
    async signIn({ user }) {
      if (!user.email) return;
      const email = normalizeEmail(user.email);
      const owner = isOwnerEmail(email);
      if (user.id) {
        // Only writes when the mirror is out of sync.
        await prisma.user.updateMany({
          where: { id: user.id, isOwner: !owner },
          data: { isOwner: owner },
        });
      }
      if (owner) {
        await prisma.allowedCreator.upsert({
          where: { email },
          create: { email, addedBy: "system:owner-bootstrap" },
          update: {},
        });
      }
      await logAction({
        action: AUDIT_ACTIONS.signin,
        actorUserId: user.id,
        actorEmail: user.email,
      });
    },
  },
});
