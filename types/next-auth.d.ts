import type { DefaultSession } from "next-auth";

// Phase 4: expose the DB user id and the owner flag on the session (set in the
// session callback in auth.ts).
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      isOwner: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    isOwner?: boolean;
  }
}
