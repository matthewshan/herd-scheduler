// Best-fit scoring + anonymity-aware aggregation (spec §6, §9; Phase 7). The one
// place results are computed from votes, so both the results screen and the
// creator-home "lead" line agree — and so anonymity can be enforced at the
// data-fetch layer, not just the UI.
//
// PRIVACY: when a poll is anonymous (`anonymousVoting === true`), this NEVER
// returns voter names/identities to anyone — including the host — only aggregate
// counts. Identity is dropped here, before the data leaves the data layer, so it
// can't leak through a server component or action. Results are NEVER sourced from
// AuditLog (which records voter identity for owner review even on anonymous
// polls) — that path stays separate (spec §9).

import type { Prisma, Response } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Best-fit score for a slot: `yes*3 + maybe - no*4`. Higher is better; the top
 * score wins (ties highlighted equally). A hard No is weighted heavily so a slot
 * someone can't make rarely beats one that works for all.
 */
export function scoreSlot(yes: number, maybe: number, no: number): number {
  return yes * 3 + maybe - no * 4;
}

// Structural inputs (a subset of the Prisma rows) so summarizeResults stays a
// pure function that's trivial to unit-test without a DB.
export interface SlotInput {
  id: string;
  startTime: Date;
  endTime: Date;
  sortOrder: number;
}

export interface ParticipantInput {
  userId: string | null;
  guestName: string | null;
  user?: { name: string | null; image?: string | null } | null;
  availabilities: { timeOptionId: string; response: Response }[];
}

/** A voter shown in a slot's avatar stack. `image` is null for guests. */
export interface Attendee {
  name: string;
  image: string | null;
}

export interface PollResultsInput {
  anonymousVoting: boolean;
  finalTimeOptionId: string | null;
  timeOptions: SlotInput[];
  participants: ParticipantInput[];
}

export interface SlotResult {
  id: string;
  startTime: Date;
  endTime: Date;
  sortOrder: number;
  yes: number;
  /** If-need-be ("maybe") count. */
  maybe: number;
  no: number;
  score: number;
  /** Top score AND not finalized — gets the cerulean ring + "★ Best fit". */
  isBestFit: boolean;
  /** This is the host's finalized pick. */
  isFinal: boolean;
  /** Zero hard-No votes and at least one person available — independent badge. */
  worksForEveryone: boolean;
  /** Yes + maybe — an aggregate count, safe to show even when anonymous. */
  canMakeItCount: number;
  /** Yes+maybe voters, in vote order — `null` on anonymous polls (privacy). */
  attendees: Attendee[] | null;
}

export interface PollResults {
  anonymous: boolean;
  /** Distinct participants with ≥1 availability row (blank submits don't count). */
  respondedCount: number;
  finalTimeOptionId: string | null;
  /** Slots best-fit first (score desc, then the poll's own order for ties). */
  slots: SlotResult[];
  /**
   * The single slot to surface in compact UI (creator-home lead line): the
   * finalized pick if set, else the best-fit winner, else `null` (no responses).
   */
  leadSlot: SlotResult | null;
}

function displayName(p: ParticipantInput): string {
  return p.user?.name?.trim() || p.guestName?.trim() || "Someone";
}

// A signed-in voter carries their profile photo into the avatar stack; guests
// have no account image, so they fall back to the initial circle.
function attendeeOf(p: ParticipantInput): Attendee {
  return { name: displayName(p), image: p.user?.image ?? null };
}

/**
 * Aggregate a poll's votes into per-slot results — the pure core. Enforces
 * anonymity (drops attendee names when `anonymousVoting`) and computes best-fit,
 * ties, "works for everyone", and the lead slot.
 */
export function summarizeResults(poll: PollResultsInput): PollResults {
  // Per-slot tallies, seeded for every option so a slot nobody marked still
  // appears (with zero counts).
  const tally = new Map<
    string,
    { yes: number; maybe: number; no: number; attendees: Attendee[] }
  >();
  for (const opt of poll.timeOptions) {
    tally.set(opt.id, { yes: 0, maybe: 0, no: 0, attendees: [] });
  }

  let respondedCount = 0;
  for (const p of poll.participants) {
    if (p.availabilities.length === 0) {
      continue; // blank submit — not a response
    }
    respondedCount += 1;
    const attendee = attendeeOf(p);
    for (const a of p.availabilities) {
      const t = tally.get(a.timeOptionId);
      if (!t) {
        continue; // availability for a since-removed slot — ignore
      }
      if (a.response === "yes") {
        t.yes += 1;
        t.attendees.push(attendee);
      } else if (a.response === "ifneedbe") {
        t.maybe += 1;
        t.attendees.push(attendee);
      } else {
        t.no += 1;
      }
    }
  }

  const hasResponses = respondedCount > 0;
  const finalId = poll.finalTimeOptionId;

  // Score every slot first, then derive the top score for best-fit highlighting.
  const scored = poll.timeOptions.map((opt) => {
    const t = tally.get(opt.id)!;
    return { opt, t, score: scoreSlot(t.yes, t.maybe, t.no) };
  });
  const topScore = hasResponses
    ? Math.max(...scored.map((s) => s.score))
    : null;

  const slots: SlotResult[] = scored.map(({ opt, t, score }) => {
    const isFinal = finalId !== null && opt.id === finalId;
    return {
      id: opt.id,
      startTime: opt.startTime,
      endTime: opt.endTime,
      sortOrder: opt.sortOrder,
      yes: t.yes,
      maybe: t.maybe,
      no: t.no,
      score,
      // Best-fit guidance is suppressed once the host has finalized — the pick
      // is then the answer, not the ranking (mirrors the design).
      isBestFit: hasResponses && finalId === null && score === topScore,
      isFinal,
      worksForEveryone: t.no === 0 && t.yes + t.maybe > 0,
      canMakeItCount: t.yes + t.maybe,
      attendees: poll.anonymousVoting ? null : t.attendees,
    };
  });

  // Best-fit first; ties fall back to the poll's own slot order (chronological).
  slots.sort((a, b) => b.score - a.score || a.sortOrder - b.sortOrder);

  // Lead = finalized pick if set, else the best-fit winner (now slots[0] when
  // there are responses), else nothing yet.
  let leadSlot: SlotResult | null = null;
  if (finalId !== null) {
    leadSlot = slots.find((s) => s.id === finalId) ?? null;
  } else if (hasResponses) {
    leadSlot = slots[0] ?? null;
  }

  return {
    anonymous: poll.anonymousVoting,
    respondedCount,
    finalTimeOptionId: finalId,
    slots,
    leadSlot,
  };
}

// Shared include so the results screen and the creator-home list pull the same
// shape and feed summarizeResults identically. Times are stored UTC.
export const pollResultsInclude = {
  createdBy: { select: { name: true, email: true } },
  timeOptions: { orderBy: { sortOrder: "asc" } },
  participants: {
    include: {
      user: { select: { name: true, image: true } },
      availabilities: { select: { timeOptionId: true, response: true } },
    },
  },
} satisfies Prisma.PollInclude;

export type PollWithResults = Prisma.PollGetPayload<{
  include: typeof pollResultsInclude;
}>;

export interface ResultsForSlug {
  poll: PollWithResults;
  results: PollResults;
}

/**
 * Load a poll by slug and compute its results in one place. Returns `null` when
 * the poll doesn't exist. The caller decides host vs. viewer; the anonymity gate
 * has already been applied to `results` regardless of who's asking.
 */
export async function getResultsForSlug(
  slug: string,
): Promise<ResultsForSlug | null> {
  const poll = await prisma.poll.findUnique({
    where: { slug },
    include: pollResultsInclude,
  });
  if (!poll) {
    return null;
  }
  return { poll, results: summarizeResults(poll) };
}
