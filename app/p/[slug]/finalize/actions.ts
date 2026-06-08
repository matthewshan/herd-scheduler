"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { AUDIT_ACTIONS, isOwnerEmail, logAction } from "@/lib/access";

export type FinalizeResult = { ok: true } | { ok: false; error: string };
export type DeleteResult = { ok: true } | { ok: false; error: string };

type HostGate =
  | { ok: false; error: string }
  | { ok: true; user: { id: string; email: string }; poll: { id: string } };

// Finalize is host-only: the poll's creator, or the owner (admin). Re-checks the
// DB each call so highlighting/guidance can never become an authorization path.
async function requireHost(slug: string): Promise<HostGate> {
  const user = await getSessionUser();
  if (!user) {
    return { ok: false, error: "Sign in to manage this poll." };
  }
  const poll = await prisma.poll.findUnique({
    where: { slug },
    select: { id: true, createdById: true },
  });
  if (!poll) {
    return { ok: false, error: "This poll no longer exists." };
  }
  if (poll.createdById !== user.id && !isOwnerEmail(user.email)) {
    return { ok: false, error: "Only the host can finalize this poll." };
  }
  return { ok: true, user, poll };
}

/**
 * Lock in a winning slot (spec §6, Phase 7). Host-only. Writes
 * `Poll.finalTimeOptionId`; highlighting is guidance, never an automatic
 * decision, so the host explicitly picks. Re-finalizing to a different slot just
 * moves the pick. Records a `poll.finalize` audit row.
 */
export async function finalizePoll(
  slug: string,
  timeOptionId: string,
): Promise<FinalizeResult> {
  const gate = await requireHost(slug);
  if (!gate.ok) {
    return { ok: false, error: gate.error };
  }
  const { user, poll } = gate;

  // The slot must belong to this poll — guards against a stale/forged id.
  const option = await prisma.timeOption.findFirst({
    where: { id: timeOptionId, pollId: poll.id },
    select: { id: true },
  });
  if (!option) {
    return { ok: false, error: "That time isn't part of this poll." };
  }

  await prisma.poll.update({
    where: { id: poll.id },
    data: { finalTimeOptionId: timeOptionId },
  });

  await logAction({
    action: AUDIT_ACTIONS.pollFinalize,
    actorUserId: user.id,
    actorEmail: user.email,
    targetType: "poll",
    targetId: poll.id,
    metadata: { timeOptionId },
  });

  revalidatePath(`/p/${slug}/results`);
  return { ok: true };
}

/**
 * Delete a poll for good (spec §6). Host-only — the creator or the owner. Cascade
 * rules drop the poll's time options, participants, and availabilities; the
 * AuditLog trail survives (its targetId is a plain string, not a FK). Records a
 * `poll.delete` row, then revalidates the creator home where the card lived.
 */
export async function deletePoll(slug: string): Promise<DeleteResult> {
  const gate = await requireHost(slug);
  if (!gate.ok) {
    return { ok: false, error: gate.error };
  }
  const { user, poll } = gate;

  await prisma.poll.delete({ where: { id: poll.id } });

  await logAction({
    action: AUDIT_ACTIONS.pollDelete,
    actorUserId: user.id,
    actorEmail: user.email,
    targetType: "poll",
    targetId: poll.id,
    metadata: { slug },
  });

  revalidatePath("/");
  return { ok: true };
}

/**
 * Clear the finalized pick ("change pick" → back to the ranked list). Host-only.
 */
export async function clearFinalization(slug: string): Promise<FinalizeResult> {
  const gate = await requireHost(slug);
  if (!gate.ok) {
    return { ok: false, error: gate.error };
  }
  const { user, poll } = gate;

  await prisma.poll.update({
    where: { id: poll.id },
    data: { finalTimeOptionId: null },
  });

  await logAction({
    action: AUDIT_ACTIONS.pollFinalize,
    actorUserId: user.id,
    actorEmail: user.email,
    targetType: "poll",
    targetId: poll.id,
    metadata: { cleared: true },
  });

  revalidatePath(`/p/${slug}/results`);
  return { ok: true };
}
