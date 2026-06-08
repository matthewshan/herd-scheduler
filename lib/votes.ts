// Vote persistence (Phase 6). Participant resolution + the availability
// upsert/delete that backs the vote screen's submit/update (spec §6).
//
// Row-absence semantics: an Availability row exists only for a *marked* slot.
// Tapping a segment to clear it (or never marking a slot) means no row — so a
// submit deletes any rows for slots the voter left blank.

import type { Prisma, Response } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { VoteValue } from "@/components/ui";

// The UI's 3-way control speaks yes/maybe/no; the Prisma Response enum is
// yes/ifneedbe/no. Keep the translation in one place so neither side drifts.
export const UI_TO_RESPONSE: Record<VoteValue, Response> = {
  yes: "yes",
  maybe: "ifneedbe",
  no: "no",
};

export const RESPONSE_TO_UI: Record<Response, VoteValue> = {
  yes: "yes",
  ifneedbe: "maybe",
  no: "no",
};

/**
 * A submitted ballot: timeOptionId → the voter's answer. Only marked slots are
 * present; an absent slot means "not marked" (its row is deleted on save).
 */
export type Ballot = Record<string, VoteValue>;

/**
 * Who is voting. A logged-in voter keys on `userId`; a guest keys on
 * `guestName`. Exactly one is set (Postgres treats NULLs as distinct, so the
 * two per-poll unique constraints don't collide — see schema).
 */
export interface ParticipantIdentity {
  userId?: string | null;
  guestName?: string | null;
}

// Look up the existing participant for an identity within a transaction. Logged-
// in voters and guests use their respective per-poll unique constraints.
function findParticipant(
  tx: Prisma.TransactionClient,
  pollId: string,
  identity: ParticipantIdentity,
) {
  if (identity.userId) {
    return tx.participant.findUnique({
      where: { pollId_userId: { pollId, userId: identity.userId } },
    });
  }
  return tx.participant.findUnique({
    where: { pollId_guestName: { pollId, guestName: identity.guestName! } },
  });
}

export interface SaveBallotInput {
  pollId: string;
  identity: ParticipantIdentity;
  /** Already validated to the poll's own timeOptionIds. */
  ballot: Ballot;
}

export interface SaveBallotResult {
  participantId: string;
  /** True when this submit created the participant (first cast vs. an update). */
  isFirstCast: boolean;
}

/**
 * Create or update a voter's availability for a poll. Re-submitting reuses the
 * same Participant (no duplicate rows) and reconciles its Availability set:
 * marked slots are upserted, every other row for the participant is deleted.
 * Runs in one transaction so a ballot is applied all-or-nothing.
 *
 * WARNING: an **empty `ballot` deletes ALL of the participant's availability
 * rows** (the deleteMany below has no `notIn` guard when nothing is marked).
 * That's intentional reconciliation — "marked nothing" = "no availability" —
 * but callers that don't want a blank submit to wipe a voter's existing votes
 * must reject empty ballots upstream, as `submitVote` in
 * `app/p/[slug]/actions.ts` does.
 */
export async function saveBallot({
  pollId,
  identity,
  ballot,
}: SaveBallotInput): Promise<SaveBallotResult> {
  return prisma.$transaction(async (tx) => {
    // Pre-read solely to derive the isFirstCast audit label (vote.cast vs
    // vote.update). Best-effort under concurrent first submits: two racing
    // first casts can both read null and both report isFirstCast, but the
    // upsert below keeps the data correct (one participant, no duplicate-key
    // throw) — the audit label is non-critical vs. that integrity guarantee.
    const existing = await findParticipant(tx, pollId, identity);

    // Upsert (not create) so two concurrent first submits from the same
    // identity don't race into a P2002 on the per-poll unique constraint
    // (pollId_userId / pollId_guestName): the loser is a no-op update, not a
    // throw. An existing participant is likewise reused as-is.
    const participant = await tx.participant.upsert({
      where: identity.userId
        ? { pollId_userId: { pollId, userId: identity.userId } }
        : { pollId_guestName: { pollId, guestName: identity.guestName! } },
      create: {
        pollId,
        userId: identity.userId ?? null,
        guestName: identity.userId ? null : (identity.guestName ?? null),
      },
      update: {},
    });

    const markedIds = Object.keys(ballot);

    // Drop rows for slots the voter left blank (tap-to-clear / never marked).
    // NOTE: with no marked slots this deletes EVERY row for the participant —
    // see the saveBallot doc comment; empty ballots are guarded upstream.
    await tx.availability.deleteMany({
      where: {
        participantId: participant.id,
        ...(markedIds.length > 0 ? { timeOptionId: { notIn: markedIds } } : {}),
      },
    });

    // Upsert the marked slots to their current answer.
    for (const [timeOptionId, value] of Object.entries(ballot)) {
      const response = UI_TO_RESPONSE[value];
      await tx.availability.upsert({
        where: {
          participantId_timeOptionId: {
            participantId: participant.id,
            timeOptionId,
          },
        },
        create: { participantId: participant.id, timeOptionId, response },
        update: { response },
      });
    }

    return { participantId: participant.id, isFirstCast: existing === null };
  });
}

/**
 * Load a voter's current ballot for a poll (empty when they haven't voted). Used
 * to pre-fill the vote screen for a logged-in voter; guests' in-progress votes
 * are restored client-side from a local draft, not the DB.
 */
export async function loadBallot(
  pollId: string,
  identity: ParticipantIdentity,
): Promise<Ballot> {
  const participant = identity.userId
    ? await prisma.participant.findUnique({
        where: { pollId_userId: { pollId, userId: identity.userId } },
        include: { availabilities: true },
      })
    : await prisma.participant.findUnique({
        where: {
          pollId_guestName: { pollId, guestName: identity.guestName! },
        },
        include: { availabilities: true },
      });

  if (!participant) {
    return {};
  }
  const ballot: Ballot = {};
  for (const a of participant.availabilities) {
    ballot[a.timeOptionId] = RESPONSE_TO_UI[a.response];
  }
  return ballot;
}
