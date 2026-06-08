"use server";

import type { Timezone } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireCreator } from "@/lib/auth";
import { AUDIT_ACTIONS, logAction } from "@/lib/access";
import { generateUniqueSlug } from "@/lib/slug";
import { TIMEZONES, zonedWallTimeToUtc } from "@/lib/time";
import { saveBallot, type Ballot } from "@/lib/votes";

// One picked slot from the create form: a calendar day (month 0-indexed, to match
// JS Date / lib/calendar) plus the shared start/end time labels in the poll's zone.
export interface CreatePollSlotInput {
  year: number;
  month: number;
  day: number;
  start: string;
  end: string;
}

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

  const title = input.title.trim();
  if (!title) {
    return { ok: false, error: "Add a title for your poll." };
  }
  if (!VALID_TZ.has(input.timezone)) {
    return { ok: false, error: "Pick a timezone." };
  }
  if (input.slots.length === 0) {
    return { ok: false, error: "Add at least one time." };
  }

  // Convert each picked range to UTC up front so a bad time label fails before
  // we touch the DB. Also reject already-past slots — the calendar disables past
  // days client-side, so this just backstops a crafted request.
  const now = new Date();
  let timeOptions: { startTime: Date; endTime: Date; sortOrder: number }[];
  try {
    timeOptions = input.slots.map((slot, i) => {
      const startTime = zonedWallTimeToUtc(
        slot.year,
        slot.month,
        slot.day,
        slot.start,
        input.timezone,
      );
      const endTime = zonedWallTimeToUtc(
        slot.year,
        slot.month,
        slot.day,
        slot.end,
        input.timezone,
      );
      if (endTime <= startTime) {
        throw new Error("End time must be after the start time.");
      }
      if (endTime <= now) {
        throw new Error("Those times are in the past — pick a future date.");
      }
      return { startTime, endTime, sortOrder: i };
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Couldn't read those times.",
    };
  }

  const description = input.description?.trim() || null;
  const location = input.location?.trim() || null;

  const slug = await generateUniqueSlug(title);
  const poll = await prisma.poll.create({
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
