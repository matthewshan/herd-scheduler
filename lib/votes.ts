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
 * `guestKey` — the opaque per-browser identity from `lib/guest.ts` (Phase 9) —
 * with `guestName` as a display label only (updatable; a guest can rename and
 * the row follows). Guests set both `guestKey` and `guestName`; users set only
 * `userId`. Postgres treats NULLs as distinct, so the two per-poll unique
 * constraints don't collide — see schema.
 */
export interface ParticipantIdentity {
  userId?: string | null;
  guestKey?: string | null;
  guestName?: string | null;
}

// The unique-constraint selector for an identity: logged-in voters key on
// pollId_userId, guests on pollId_guestKey. One builder so find/upsert/load
// can't disagree on what "the same voter" means.
function participantWhere(pollId: string, identity: ParticipantIdentity) {
  if (identity.userId) {
    return { pollId_userId: { pollId, userId: identity.userId } };
  }
  return { pollId_guestKey: { pollId, guestKey: identity.guestKey! } };
}

// Look up the existing participant for an identity within a transaction.
function findParticipant(
  tx: Prisma.TransactionClient,
  pollId: string,
  identity: ParticipantIdentity,
) {
  return tx.participant.findUnique({
    where: participantWhere(pollId, identity),
  });
}

/**
 * Thrown by saveBallot when admitting a *new* participant would push the poll
 * past `maxParticipants` (Phase 10 size cap). Existing voters re-submitting
 * are never blocked — the cap bounds growth, it doesn't lock anyone out of
 * editing their own ballot.
 */
export class ParticipantLimitError extends Error {
  constructor(readonly max: number) {
    super(`Poll already has ${max} participants`);
    this.name = "ParticipantLimitError";
  }
}

export interface SaveBallotInput {
  pollId: string;
  identity: ParticipantIdentity;
  /** Already validated to the poll's own timeOptionIds. */
  ballot: Ballot;
  /**
   * When set, a submit that would create a new participant is rejected with
   * `ParticipantLimitError` once the poll has this many participants. Checked
   * inside the transaction so concurrent first casts can't meaningfully
   * overshoot. Unset = uncapped (e.g. the host's own creation-time ballot).
   */
  maxParticipants?: number;
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
  maxParticipants,
}: SaveBallotInput): Promise<SaveBallotResult> {
  return prisma.$transaction(async (tx) => {
    // Pre-read to derive the isFirstCast audit label (vote.cast vs
    // vote.update) and to gate the participant cap. Best-effort under
    // concurrent first submits: two racing first casts can both read null and
    // both report isFirstCast, but the upsert below keeps the data correct
    // (one participant, no duplicate-key throw) — the audit label is
    // non-critical vs. that integrity guarantee.
    const existing = await findParticipant(tx, pollId, identity);

    // Phase 10 size cap: only a brand-new participant counts against it.
    if (existing === null && maxParticipants !== undefined) {
      const count = await tx.participant.count({ where: { pollId } });
      if (count >= maxParticipants) {
        throw new ParticipantLimitError(maxParticipants);
      }
    }

    // Upsert (not create) so two concurrent first submits from the same
    // identity don't race into a P2002 on the per-poll unique constraint
    // (pollId_userId / pollId_guestKey): the loser is a no-op update, not a
    // throw. A returning guest's update refreshes `guestName` — the label
    // follows the row, so renaming doesn't fork a second participant.
    const participant = await tx.participant.upsert({
      where: participantWhere(pollId, identity),
      create: {
        pollId,
        userId: identity.userId ?? null,
        guestKey: identity.userId ? null : (identity.guestKey ?? null),
        guestName: identity.userId ? null : (identity.guestName ?? null),
      },
      update: identity.userId ? {} : { guestName: identity.guestName ?? null },
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
 * to pre-fill the vote screen — server-side for a logged-in voter (`userId`),
 * client-hydrated for a returning guest (`guestKey`, Phase 9).
 */
export async function loadBallot(
  pollId: string,
  identity: ParticipantIdentity,
): Promise<Ballot> {
  const participant = await prisma.participant.findUnique({
    where: participantWhere(pollId, identity),
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

export interface GuestRecord {
  ballot: Ballot;
  /** The display label stored on the guest's row (their last submitted name). */
  guestName: string | null;
}

/**
 * Adopt a guest's existing participation into a now-signed-in account (spec §5,
 * §6). When someone votes as a guest and then signs in (the inline affordance on
 * the vote screen), their guest ballot would otherwise be stranded under the
 * per-browser `guestKey`. This rebinds it to `userId` so the account carries the
 * votes forward, runs in one transaction, and is idempotent (a no-op once the
 * guest row has been claimed). Returns the resulting ballot (so the client can
 * reflect it without a full reload), or `null` when there was nothing to claim.
 *
 * Two cases:
 *  - The account has no participation here yet → relabel the guest row in place
 *    (preserves its `Availability` rows untouched), dropping `guestKey`/
 *    `guestName`.
 *  - The account already voted here → merge the guest's answers into the user's
 *    row (the just-cast guest answers win per-slot, since signing in right after
 *    voting implies they're the latest intent), then delete the guest row.
 */
export async function claimGuestParticipant(
  pollId: string,
  guestKey: string,
  userId: string,
): Promise<Ballot | null> {
  return prisma.$transaction(async (tx) => {
    const guest = await tx.participant.findUnique({
      where: { pollId_guestKey: { pollId, guestKey } },
      include: { availabilities: true },
    });
    if (!guest) {
      return null; // nothing under this key on this poll (already claimed / never voted)
    }

    const mine = await tx.participant.findUnique({
      where: { pollId_userId: { pollId, userId } },
      include: { availabilities: true },
    });

    if (!mine) {
      // No account row yet — relabel the guest row, keeping its availabilities.
      await tx.participant.update({
        where: { id: guest.id },
        data: { userId, guestKey: null, guestName: null },
      });
    } else {
      // The account already has a row here: fold the guest's answers in (guest
      // wins per-slot), then drop the guest row (cascades its availabilities).
      for (const a of guest.availabilities) {
        await tx.availability.upsert({
          where: {
            participantId_timeOptionId: {
              participantId: mine.id,
              timeOptionId: a.timeOptionId,
            },
          },
          create: {
            participantId: mine.id,
            timeOptionId: a.timeOptionId,
            response: a.response,
          },
          update: { response: a.response },
        });
      }
      await tx.participant.delete({ where: { id: guest.id } });
    }

    // Read back the account's ballot so the caller can reflect the merge.
    const merged = await tx.participant.findUnique({
      where: { pollId_userId: { pollId, userId } },
      include: { availabilities: true },
    });
    const ballot: Ballot = {};
    for (const a of merged?.availabilities ?? []) {
      ballot[a.timeOptionId] = RESPONSE_TO_UI[a.response];
    }
    return ballot;
  });
}

/**
 * A returning guest's saved state for a poll, in one query: their ballot plus
 * the display name on their row. Backs the client-side hydration of the vote
 * screen (the page is a server component that can't read the browser-held
 * `guestKey`). Returns `null` when the key has no participant on this poll.
 * The result goes only to the key's holder — never to other viewers.
 */
export async function loadGuestRecord(
  pollId: string,
  guestKey: string,
): Promise<GuestRecord | null> {
  const participant = await prisma.participant.findUnique({
    where: { pollId_guestKey: { pollId, guestKey } },
    include: { availabilities: true },
  });
  if (!participant) {
    return null;
  }
  const ballot: Ballot = {};
  for (const a of participant.availabilities) {
    ballot[a.timeOptionId] = RESPONSE_TO_UI[a.response];
  }
  return { ballot, guestName: participant.guestName };
}
