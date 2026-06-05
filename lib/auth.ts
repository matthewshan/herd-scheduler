// Session-aware access guards (spec §5). Thin wrappers over the session and the
// pure helpers in lib/access.ts. Server components and server actions call these
// as the single chokepoint for "may this person do X".

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { canCreatePolls, isOwnerEmail } from "@/lib/access";

export interface SessionUser {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  isOwner: boolean;
}

/** The current signed-in user, or null. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  const user = session?.user;
  if (!user?.email) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
    isOwner: user.isOwner,
  };
}

/**
 * Require an owner. Redirects unauthenticated users to sign-in and non-owners
 * home. Returns the owner user. The owner flag is re-derived from OWNER_EMAIL
 * so it's correct even before the DB flag is bootstrapped.
 */
export async function requireOwner(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  if (!(user.isOwner || isOwnerEmail(user.email))) redirect("/");
  return user;
}

/**
 * Require poll-creation rights (mode-aware: owner always, else not blocked and —
 * when ALLOWLIST_ENABLED — on the AllowedCreator list). Checks the DB fresh on
 * every call so a just-blocked user is denied even with a live session.
 * Redirects unauthenticated users to sign-in and unauthorized users home.
 */
export async function requireCreator(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  if (!(await canCreatePolls(user.email))) redirect("/");
  return user;
}
