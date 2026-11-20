"use server";

import type { Timezone } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireCreator } from "@/lib/auth";
import { AUDIT_ACTIONS, logAction } from "@/lib/access";
import { generateUniqueSlug } from "@/lib/slug";
import { TIMEZONES } from "@/lib/time";
import {
  LIMITS,
  maxPollsPerCreator,
  maxSlotsPerPoll,
  withinLimit,
} from "@/lib/limits";
import { checkRateLimit, createPollRule } from "@/lib/rate-limit";
import { saveBallot, type Ballot } from "@/lib/votes";
import {
  isSlugCollision,
  validateSlots,
  type CreatePollSlotInput,
} from "./slots";

export type { CreatePollSlotInput } from "./slots";

/** How many fresh slugs to try if `poll.create` races another poll onto ours. */
const SLUG_CREATE_ATTEMPTS = 3;

export interface CreatePollInput {
  title: string;
  description?: string;
  location?: string;
  timezone: Timezone;
  anonymousVoting: boolean;
  slots: CreatePollSlotInput[];
}

export type CreatePollResult =
  | { ok: true; slug: string }
  | { ok: false; error: string };

const VALID_TZ = new Set(TIMEZONES.map((t) => t.value));

/**
 * Create a poll and its ordered TimeOption rows (spec §6, Phase 5).
 *
 * Creator-gated (re-checks the DB via requireCreator). Each picked wall-clock
 * range is converted to UTC for storage; sortOrder preserves the order the
 * client sends (the form keeps the working set chronological). Slug is unique
 * with collision retry. Writes a `poll.create` audit row.
 */
export async function createPoll(
  input: CreatePollInput,
): Promise<CreatePollResult> {
  const user = await requireCreator();

  // Abuse guards (spec §9, Phase 10): a per-creator creation rate, then a
  // per-creator total-poll cap. Both env-tunable; see lib/rate-limit.ts and
  // lib/limits.ts.
  if (!checkRateLimit(`create:${user.id}`, createPollRule())) {
    return {
      ok: false,
      error: "You're creating polls too quickly — try again in a bit.",
    };
  }
  const pollCount = await prisma.poll.count({
    where: { createdById: user.id },
  });
  if (pollCount >= maxPollsPerCreator()) {
    return {
      ok: false,
      error: `You've hit the limit of ${maxPollsPerCreator()} polls — delete one to make room.`,
    };
  }

  const title = input.title.trim();
  if (!title) {
    return { ok: false, error: "Add a title for your poll." };
  }
  if (!withinLimit(title, LIMITS.title)) {
    return {
      ok: false,
      error: `Keep the title under ${LIMITS.title} characters.`,
    };
  }
  if (!VALID_TZ.has(input.timezone)) {
    return { ok: false, error: "Pick a timezone." };
  }
  if (!Array.isArray(input.slots) || input.slots.length === 0) {
    return { ok: false, error: "Add at least one time." };
  }
  if (input.slots.length > maxSlotsPerPoll()) {
    return { ok: false, error: `Pick at most ${maxSlotsPerPoll()} times.` };
  }

  // Validate + convert each picked range to UTC up front (see ./slots) so a
  // crafted request — unreal dates, unknown labels, past or far-future times,
  // duplicate slots — gets a friendly error before we touch the DB.
  const slotCheck = validateSlots(input.slots, input.timezone, new Date());
  if (!slotCheck.ok) {
    return slotCheck;
  }
  const { timeOptions } = slotCheck;

  const description = input.description?.trim() || null;
  if (description && !withinLimit(description, LIMITS.description)) {
    return {
      ok: false,
      error: `Keep the description under ${LIMITS.description} characters.`,
    };
  }
  const location = input.location?.trim() || null;
  if (location && !withinLimit(location, LIMITS.location)) {
    return {
      ok: false,
      error: `Keep the location under ${LIMITS.location} characters.`,
    };
  }

  // generateUniqueSlug is check-then-insert, so another poll can still claim the
  // same slug in between; on that P2002 we mint a fresh slug and retry.
  const createWithSlug = (slug: string) =>
    prisma.poll.create({
      data: {
        slug,
        title,
        description,
        location,
        timezone: input.timezone,
        anonymousVoting: input.anonymousVoting,
        createdById: user.id,
        timeOptions: { create: timeOptions },
      },
      include: { timeOptions: { select: { id: true } } },
    });
  let poll: Awaited<ReturnType<typeof createWithSlug>> | undefined;
  for (let attempt = 1; poll === undefined; attempt++) {
    try {
      poll = await createWithSlug(await generateUniqueSlug(title));
    } catch (err) {
      if (!isSlugCollision(err) || attempt >= SLUG_CREATE_ATTEMPTS) {
        throw err;
      }
    }
  }
  const { slug } = poll;

  // The host is presumed available for the times they proposed: persist a real
  // "yes" ballot for them at creation (not just a UI prefill), so they count as
  // a responder and the slots start with their own availability. They can edit
  // it from the vote screen like anyone else. Best-effort — a failure here
  // mustn't undo the created poll; the host can still vote manually.
  try {
    const hostBallot: Ballot = Object.fromEntries(
      poll.timeOptions.map((t) => [t.id, "yes" as const]),
    );
    await saveBallot({
      pollId: poll.id,
      identity: { userId: user.id },
      ballot: hostBallot,
    });
  } catch {
    // Swallow — the poll exists; the host just isn't pre-voted.
  }

  await logAction({
    action: AUDIT_ACTIONS.pollCreate,
    actorUserId: user.id,
    actorEmail: user.email,
    targetType: "poll",
    targetId: poll.id,
    metadata: {
      slug,
      slots: timeOptions.length,
      timezone: input.timezone,
      anonymousVoting: input.anonymousVoting,
    },
  });

  return { ok: true, slug };
}
