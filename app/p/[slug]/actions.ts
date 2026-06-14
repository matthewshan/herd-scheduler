"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { signIn } from "@/auth";
import { getSessionUser } from "@/lib/auth";
import { AUDIT_ACTIONS, logAction } from "@/lib/access";
import { LIMITS, maxParticipantsPerPoll, withinLimit } from "@/lib/limits";
import { checkRateLimit, clientIpFrom, voteRule } from "@/lib/rate-limit";
import { isValidGuestKey } from "@/lib/guest";
import {
  loadGuestRecord,
  saveBallot,
  ParticipantLimitError,
  type Ballot,
  type GuestRecord,
} from "@/lib/votes";
import type { VoteValue } from "@/components/ui";

export interface SubmitVoteInput {
  slug: string;
  /** Display name — required (and only used) for guests; ignored when signed in. */
  guestName?: string;
  /**
   * The guest's per-browser identity key (Phase 9) — required (and only used)
   * for guests; ignored when signed in. Minted client-side, see lib/guest.ts.
   */
  guestKey?: string;
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
  // Abuse guard (spec §9, Phase 10): per-IP submit rate. IP-keyed because
  // voting is open to anyone with the link — guests have no stable identity an
  // abuser can't re-mint. Env-tunable; see lib/rate-limit.ts.
  const ip = clientIpFrom(await headers());
  if (!checkRateLimit(`vote:${ip}`, voteRule())) {
    return {
      ok: false,
      error: "Too many submissions — give it a minute and try again.",
    };
  }

  const poll = await prisma.poll.findUnique({
    where: { slug: input.slug },
    select: {
      id: true,
      status: true,
      finalTimeOptionId: true,
      timeOptions: { select: { id: true } },
    },
  });
  if (!poll) {
    return { ok: false, error: "This poll no longer exists." };
  }
  if (poll.status !== "open" || poll.finalTimeOptionId !== null) {
    return { ok: false, error: "This poll is closed — voting has ended." };
  }

  const user = await getSessionUser();

  // Guests must name themselves so friends know who voted; signed-in voters use
  // their account identity and any submitted guestName/guestKey is ignored.
  let guestName: string | null = null;
  let guestKey: string | null = null;
  if (!user) {
    guestName = input.guestName?.trim() ?? "";
    if (!guestName) {
      return { ok: false, error: "Add your name so friends know who voted." };
    }
    if (!withinLimit(guestName, LIMITS.guestName)) {
      return {
        ok: false,
        error: `Keep your name under ${LIMITS.guestName} characters.`,
      };
    }
    // The client always mints a key before submitting (Phase 9), so a missing/
    // malformed one means a tampered payload, not a real voter path.
    if (!isValidGuestKey(input.guestKey)) {
      return {
        ok: false,
        error: "Something went off — refresh and try again.",
      };
    }
    guestKey = input.guestKey;
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

  let isFirstCast: boolean;
  try {
    ({ isFirstCast } = await saveBallot({
      pollId: poll.id,
      identity: user ? { userId: user.id } : { guestKey, guestName },
      ballot,
      maxParticipants: maxParticipantsPerPoll(),
    }));
  } catch (err) {
    if (err instanceof ParticipantLimitError) {
      return {
        ok: false,
        error: `This poll is full — it already has ${err.max} voters.`,
      };
    }
    throw err;
  }

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
 * Hydrate a returning guest's saved state (Phase 9). The vote page is a server
 * component that can't read the browser-held guest key, so the client calls
 * this on mount with the key from localStorage to pre-fill the name and ballot.
 * Returns `null` for an unknown poll, a malformed key, or a key with no
 * participant here. The guest key is an unguessable per-browser credential —
 * the response only ever reaches the browser that holds it, so this leaks
 * nothing to other viewers (spec §9). The key itself is never echoed back.
 */
export async function loadGuestBallot(
  slug: string,
  guestKey: string,
): Promise<GuestRecord | null> {
  if (!isValidGuestKey(guestKey)) {
    return null;
  }
  const poll = await prisma.poll.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!poll) {
    return null;
  }
  return loadGuestRecord(poll.id, guestKey);
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
