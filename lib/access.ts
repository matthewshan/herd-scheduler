// Pure access-control helpers (spec §5). No session dependency and no import of
// "@/auth", so both `auth.ts` (callbacks/events) and `lib/auth.ts` (session
// guards) can use these without a circular import.

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { resolveClientIp } from "@/lib/client-ip";

/** Lowercased + trimmed, so allowlist/blocklist checks are case-insensitive. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Creator access mode. `true` (the default when unset) gates poll creation by
 * the AllowedCreator list; `false` lets any verified login create polls.
 */
export function isAllowlistEnabled(): boolean {
  return process.env.ALLOWLIST_ENABLED !== "false";
}

/**
 * The single owner, identified by OWNER_EMAIL. This is the **only** source of
 * truth for owner authorization — `User.isOwner` is an informational mirror
 * (re-synced on sign-in and by the seed), never consulted for access, so
 * changing OWNER_EMAIL immediately revokes the previous owner's admin rights.
 */
export function isOwnerEmail(email: string | null | undefined): boolean {
  const owner = process.env.OWNER_EMAIL;
  if (!owner || !email) {
    return false;
  }
  return normalizeEmail(email) === normalizeEmail(owner);
}

/**
 * True when the email is on the reactive blocklist. The owner is exempt — the
 * owner can never be blocked, even by a BlockedEmail row that pre-dates
 * OWNER_EMAIL being set — so every caller (sign-in gate, dev-login, creator
 * check) gets the exemption without repeating it.
 */
export async function isEmailBlocked(
  email: string | null | undefined,
): Promise<boolean> {
  if (!email || isOwnerEmail(email)) {
    return false;
  }
  const hit = await prisma.blockedEmail.findUnique({
    where: { email: normalizeEmail(email) },
  });
  return hit !== null;
}

/**
 * Whether an email may create polls. The owner always may; otherwise blocked
 * emails never may, and the allowlist is consulted only when enabled.
 */
export async function canCreatePolls(
  email: string | null | undefined,
): Promise<boolean> {
  if (!email) {
    return false;
  }
  // Owner first: the owner can never be locked out (matches the BlockedEmail
  // invariant and requireOwner), so check ownership before the blocklist.
  if (isOwnerEmail(email)) {
    return true;
  }
  if (await isEmailBlocked(email)) {
    return false;
  }
  if (!isAllowlistEnabled()) {
    return true;
  }
  const allowed = await prisma.allowedCreator.findUnique({
    where: { email: normalizeEmail(email) },
  });
  return allowed !== null;
}

/**
 * Single source of truth for audit action names (spec §5). Both the `logAction`
 * writers and the `/admin` filter dropdown derive from this, so the dropdown
 * can never drift from what's actually logged. Add new actions here only.
 */
export const AUDIT_ACTIONS = {
  signin: "signin",
  pollCreate: "poll.create",
  pollUpdate: "poll.update",
  pollClose: "poll.close",
  pollFinalize: "poll.finalize",
  pollDelete: "poll.delete",
  voteCast: "vote.cast",
  voteUpdate: "vote.update",
  creatorAdd: "creator.add",
  creatorRemove: "creator.remove",
  emailBlock: "email.block",
  emailUnblock: "email.unblock",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

/** All action strings in admin-filter order (derived — do not hand-maintain). */
export const AUDIT_ACTION_VALUES = Object.values(
  AUDIT_ACTIONS,
) as AuditAction[];

/**
 * Normalize the `/admin` `?action=` filter. Next hands repeated params over as a
 * `string[]` (`?action=a&action=b`), and an arbitrary string must never reach
 * the Prisma query — so take the first value and accept it only if it's a known
 * audit action. Anything else means "no filter".
 */
export function parseAuditActionFilter(
  raw: string | string[] | undefined,
): AuditAction | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") {
    return null;
  }
  return AUDIT_ACTION_VALUES.find((a) => a === value) ?? null;
}

export interface LogActionInput {
  action: AuditAction;
  actorUserId?: string | null;
  actorEmail?: string | null;
  guestName?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
  /** Override request-derived ip/userAgent (otherwise pulled from headers). */
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Write one AuditLog row (spec §5). The reusable chokepoint for all server
 * actions. Pulls ip/userAgent from the current request when not supplied;
 * best-effort — logging must never break the action it records.
 */
export async function logAction(input: LogActionInput): Promise<void> {
  let ip = input.ip ?? null;
  let userAgent = input.userAgent ?? null;
  if (ip === null || userAgent === null) {
    try {
      const h = await headers();
      // Same trusted-source derivation as the vote rate limit (never the
      // client-controlled leftmost x-forwarded-for entry) — lib/client-ip.ts.
      ip = ip ?? resolveClientIp(h);
      userAgent = userAgent ?? h.get("user-agent") ?? null;
    } catch {
      // Outside a request scope — skip request metadata.
    }
  }

  try {
    await prisma.auditLog.create({
      data: {
        action: input.action,
        actorUserId: input.actorUserId ?? null,
        actorEmail: input.actorEmail ? normalizeEmail(input.actorEmail) : null,
        guestName: input.guestName ?? null,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        ip,
        userAgent,
        metadata: (input.metadata ?? undefined) as object | undefined,
      },
    });
  } catch (err) {
    console.error("[audit] failed to write log", input.action, err);
  }
}
