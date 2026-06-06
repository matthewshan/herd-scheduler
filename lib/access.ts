// Pure access-control helpers (spec §5). No session dependency and no import of
// "@/auth", so both `auth.ts` (callbacks/events) and `lib/auth.ts` (session
// guards) can use these without a circular import.

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

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

/** The single owner, identified by OWNER_EMAIL — independent of the DB flag. */
export function isOwnerEmail(email: string | null | undefined): boolean {
  const owner = process.env.OWNER_EMAIL;
  if (!owner || !email) return false;
  return normalizeEmail(email) === normalizeEmail(owner);
}

/** True when the email is on the reactive blocklist. */
export async function isEmailBlocked(
  email: string | null | undefined,
): Promise<boolean> {
  if (!email) return false;
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
  if (!email) return false;
  // Owner first: the owner can never be locked out (matches the BlockedEmail
  // invariant and requireOwner), so check ownership before the blocklist.
  if (isOwnerEmail(email)) return true;
  if (await isEmailBlocked(email)) return false;
  if (!isAllowlistEnabled()) return true;
  const allowed = await prisma.allowedCreator.findUnique({
    where: { email: normalizeEmail(email) },
  });
  return allowed !== null;
}

export interface LogActionInput {
  action: string;
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
      ip =
        ip ??
        h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        h.get("x-real-ip") ??
        null;
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
