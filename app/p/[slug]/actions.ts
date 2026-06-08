"use server";

import { prisma } from "@/lib/prisma";
import { signIn } from "@/auth";
import { getSessionUser } from "@/lib/auth";
import { AUDIT_ACTIONS, logAction } from "@/lib/access";
import { saveBallot, type Ballot } from "@/lib/votes";
import type { VoteValue } from "@/components/ui";

export interface SubmitVoteInput {
  slug: string;
  /** Display name — required (and only used) for guests; ignored when signed in. */
  guestName?: string;
  /** timeOptionId → answer. Only marked slots; unmarked slots are omitted. */
  votes: Record<string, VoteValue>;
}

export type SubmitVoteResult =
  | { ok: true; updated: boolean }
  | { ok: false; error: string };

const VALID_VALUES = new Set<VoteValue>(["yes", "maybe", "no"]);

/**
 * Cast or update a vote for a poll (spec §2, §6, Phase 6). Anyone with the link
 * may vote — as a guest (display name only) or signed in. Re-submitting updates
 * the voter's existing rows rather than duplicating. Writes a `vote.cast` (first
 * submit) / `vote.update` audit row; guests are recorded by name with a null
 * actor.
 */
export async function submitVote(
  input: SubmitVoteInput,
): Promise<SubmitVoteResult> {
  const poll = await prisma.poll.findUnique({
    where: { slug: input.slug },
    select: {
      id: true,
      status: true,
      timeOptions: { select: { id: true } },
    },
  });
  if (!poll) {
    return { ok: false, error: "This poll no longer exists." };
  }
  if (poll.status !== "open") {
    return { ok: false, error: "This poll is closed — voting has ended." };
  }

  const user = await getSessionUser();

  // Guests must name themselves so friends know who voted; signed-in voters use
  // their account identity and any submitted guestName is ignored.
  let guestName: string | null = null;
  if (!user) {
    guestName = input.guestName?.trim() ?? "";
    if (!guestName) {
      return { ok: false, error: "Add your name so friends know who voted." };
    }
  }

  // Harden against a malformed payload: `votes` is typed but arrives from an
  // untrusted client, so a non-object would make Object.entries below throw
  // rather than return the structured error the client expects.
  if (!input.votes || typeof input.votes !== "object") {
    return { ok: false, error: "Couldn't read your answers." };
  }

  // Keep only answers for this poll's own slots, mapped to known values. Stale
  // slot ids (e.g. a removed option) are dropped rather than failing the submit.
  const validIds = new Set(poll.timeOptions.map((t) => t.id));
  const ballot: Ballot = {};
  for (const [id, value] of Object.entries(input.votes)) {
    if (!validIds.has(id)) {
      continue;
    }
    if (!VALID_VALUES.has(value)) {
      return { ok: false, error: "Couldn't read one of your answers." };
    }
    ballot[id] = value;
  }
  if (Object.keys(ballot).length === 0) {
    return { ok: false, error: "Mark at least one time before submitting." };
  }

  const { isFirstCast } = await saveBallot({
    pollId: poll.id,
    identity: user ? { userId: user.id } : { guestName },
    ballot,
  });

  await logAction({
    action: isFirstCast ? AUDIT_ACTIONS.voteCast : AUDIT_ACTIONS.voteUpdate,
    actorUserId: user?.id ?? null,
    actorEmail: user?.email ?? null,
    guestName: user ? null : guestName,
    targetType: "poll",
    targetId: poll.id,
    metadata: { marked: Object.keys(ballot).length },
  });

  return { ok: true, updated: !isFirstCast };
}

/**
 * Inline sign-in entry point for a mid-vote guest (spec §5). The same Auth.js
 * Google provider as the dedicated sign-in screen, but returns to this poll so
 * the voter lands back where they were — the client restores their in-progress
 * votes from a local draft on arrival.
 */
export async function signInToVote(slug: string): Promise<void> {
  await signIn("google", { redirectTo: `/p/${slug}` });
}
