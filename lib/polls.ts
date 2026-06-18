// Creator-scoped poll queries (Phase 7.5). Powers the "My polls" home: the polls
// you created, newest first, each shaped with its status, response count, span,
// and leading/finalized time. Leans on lib/results (best-fit/lead) and lib/time
// (span + lead label) so scoring/zone logic lives in one place.

import { prisma } from "@/lib/prisma";
import {
  pollResultsInclude,
  summarizeResults,
  type PollWithResults,
} from "@/lib/results";
import { formatLeadLabel, formatSpan } from "@/lib/time";
import type { PollDisplayStatus } from "@/components/ui";

export interface CreatorPollLead {
  kind: "leading" | "finalized";
  /** e.g. "Sat, Jun 7 · 6 PM ET". */
  label: string;
}

/**
 * Aggregate-only poll summary for a home-screen card. Holds no voter identity —
 * safe to surface to a guest (visited-poll home) or for a poll you only joined.
 */
export interface PublicPollSummary {
  slug: string;
  title: string;
  status: PollDisplayStatus;
  /** Date span across the poll's slots, poll zone, e.g. "Jun 20–21". */
  span: string;
  /** Distinct participants with ≥1 availability (blank submits don't count). */
  responded: number;
  /** Leading/finalized time, or null when there are no responses yet. */
  lead: CreatorPollLead | null;
}

export interface CreatorPollRow extends PublicPollSummary {
  /**
   * Whether the viewing creator has cast their own ballot in this poll. Drives
   * the card's default destination: voted → results, not yet → the vote screen.
   */
  youVoted: boolean;
}

// "finalized" is derived (a final pick is set), overriding the open/closed enum.
function displayStatus(poll: PollWithResults): PollDisplayStatus {
  if (poll.finalTimeOptionId !== null) {
    return "finalized";
  }
  return poll.status === "closed" ? "closed" : "open";
}

// The aggregate, identity-free core of a card row — shared by every home list.
function toSummary(poll: PollWithResults): PublicPollSummary {
  const results = summarizeResults(poll);
  const span = formatSpan(
    poll.timeOptions.map((t) => t.startTime),
    poll.timezone,
  );

  let lead: CreatorPollLead | null = null;
  if (results.leadSlot) {
    const label = formatLeadLabel(results.leadSlot.startTime, poll.timezone);
    lead = {
      kind: results.finalTimeOptionId ? "finalized" : "leading",
      label,
    };
  }

  return {
    slug: poll.slug,
    title: poll.title,
    status: displayStatus(poll),
    span,
    responded: results.respondedCount,
    lead,
  };
}

function toRow(poll: PollWithResults, viewerId: string): CreatorPollRow {
  // Has the viewing creator cast their own ballot? A participant keyed to their
  // userId with ≥1 availability row — blank submits (no rows) don't count.
  const youVoted = poll.participants.some(
    (p) => p.userId === viewerId && p.availabilities.length > 0,
  );
  return { ...toSummary(poll), youVoted };
}

/**
 * The polls a user created, newest first, shaped for the creator-home list.
 * Scope is strictly "polls I created" — owner-sees-all stays an /admin concern.
 */
export async function listPollsForCreator(
  userId: string,
): Promise<CreatorPollRow[]> {
  const polls = await prisma.poll.findMany({
    where: { createdById: userId },
    orderBy: { createdAt: "desc" },
    include: pollResultsInclude,
  });
  return polls.map((poll) => toRow(poll, userId));
}

/**
 * Polls a signed-in user has *joined* — voted in someone else's poll (a
 * Participant row keyed to their userId with ≥1 availability), excluding polls
 * they created (those live under "your polls"). Newest first. Aggregate-only.
 */
export async function listPollsJoined(
  userId: string,
): Promise<PublicPollSummary[]> {
  const polls = await prisma.poll.findMany({
    where: {
      createdById: { not: userId },
      participants: { some: { userId, availabilities: { some: {} } } },
    },
    orderBy: { createdAt: "desc" },
    include: pollResultsInclude,
  });
  return polls.map(toSummary);
}

/**
 * Public summaries for a set of slugs, returned in the same order as the input
 * (callers pass them in recency order). Not-found slugs (e.g. deleted polls) are
 * silently omitted. Aggregate-only — powers the guest "looked at" home, so it
 * exposes no voter identity and needs no auth.
 */
export async function listPollSummariesBySlug(
  slugs: string[],
): Promise<PublicPollSummary[]> {
  if (slugs.length === 0) {
    return [];
  }
  const polls = await prisma.poll.findMany({
    where: { slug: { in: slugs } },
    include: pollResultsInclude,
  });
  const bySlug = new Map(polls.map((p) => [p.slug, toSummary(p)]));
  return slugs
    .map((slug) => bySlug.get(slug))
    .filter((s): s is PublicPollSummary => s !== undefined);
}
