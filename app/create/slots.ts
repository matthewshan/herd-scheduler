// Pure helpers for the create flow (Phase 5): slot validation and the slug
// collision check. Kept out of the "use server" actions module so it's unit-testable without auth or a DB.
//
// The server can't trust the client's payload: a crafted request can send
// non-integer or out-of-range date parts, labels the picker never offers,
// past/far-future dates, or the same slot twice. Everything here returns the
// action's structured error shape instead of throwing, so a bad request is a
// friendly message rather than a Prisma 500.

import { Prisma, type Timezone } from "@prisma/client";
import { TIME_OPTS } from "@/lib/calendar";
import { isValidCalendarDate, zonedWallTimeToUtc } from "@/lib/time";

// One picked slot from the create form: a calendar day (month 0-indexed, to match
// JS Date / lib/calendar) plus the shared start/end time labels in the poll's zone.
export interface CreatePollSlotInput {
  year: number;
  month: number;
  day: number;
  start: string;
  end: string;
}

export interface TimeOptionRow {
  startTime: Date;
  endTime: Date;
  sortOrder: number;
}

export type SlotValidationResult =
  | { ok: true; timeOptions: TimeOptionRow[] }
  | { ok: false; error: string };

/** How far ahead a poll may propose times. */
export const MAX_HORIZON_YEARS = 2;

const TIME_LABELS = new Set(TIME_OPTS);

function isSlotShape(slot: unknown): slot is CreatePollSlotInput {
  if (typeof slot !== "object" || slot === null) {
    return false;
  }
  const s = slot as Record<string, unknown>;
  return (
    isValidCalendarDate(s.year, s.month, s.day) &&
    typeof s.start === "string" &&
    typeof s.end === "string" &&
    // Only the labels the picker offers (9:00 AM–11:30 PM, 30-min steps). This
    // also keeps slots clear of the 1–3 AM DST transitions (see lib/time.ts).
    TIME_LABELS.has(s.start) &&
    TIME_LABELS.has(s.end)
  );
}

/**
 * Validate the picked slots and convert each wall-clock range to UTC rows.
 *
 * Rejects non-array input, malformed or unreal dates, unknown time labels,
 * end ≤ start, already-past slots (end ≤ `now`), and slots more than
 * {@link MAX_HORIZON_YEARS} years out. Identical (start, end) slots are
 * deduped (first one wins); `sortOrder` follows the surviving input order.
 */
export function validateSlots(
  slots: unknown,
  timezone: Timezone,
  now: Date,
): SlotValidationResult {
  if (!Array.isArray(slots) || slots.length === 0) {
    return { ok: false, error: "Add at least one time." };
  }

  const horizon = new Date(now.getTime());
  horizon.setUTCFullYear(horizon.getUTCFullYear() + MAX_HORIZON_YEARS);

  const seen = new Set<string>();
  const timeOptions: TimeOptionRow[] = [];
  for (const slot of slots) {
    if (!isSlotShape(slot)) {
      return { ok: false, error: "Couldn't read those times." };
    }
    let startTime: Date;
    let endTime: Date;
    try {
      startTime = zonedWallTimeToUtc(
        slot.year,
        slot.month,
        slot.day,
        slot.start,
        timezone,
      );
      endTime = zonedWallTimeToUtc(
        slot.year,
        slot.month,
        slot.day,
        slot.end,
        timezone,
      );
    } catch {
      return { ok: false, error: "Couldn't read those times." };
    }
    if (endTime <= startTime) {
      return { ok: false, error: "End time must be after the start time." };
    }
    if (endTime <= now) {
      return {
        ok: false,
        error: "Those times are in the past — pick a future date.",
      };
    }
    if (startTime > horizon) {
      return {
        ok: false,
        error: `Pick dates within the next ${MAX_HORIZON_YEARS} years.`,
      };
    }
    const key = `${startTime.getTime()}-${endTime.getTime()}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    timeOptions.push({ startTime, endTime, sortOrder: timeOptions.length });
  }
  return { ok: true, timeOptions };
}

/**
 * True for a Prisma unique-constraint violation (P2002) on `Poll.slug` — the
 * one create failure worth retrying with a fresh slug.
 */
export function isSlugCollision(err: unknown): boolean {
  if (
    !(err instanceof Prisma.PrismaClientKnownRequestError) ||
    err.code !== "P2002"
  ) {
    return false;
  }
  // `meta.target` is the field list (e.g. ["slug"]) or, on some connectors, the
  // constraint name (e.g. "Poll_slug_key") — both mention "slug".
  const target = err.meta?.target;
  if (Array.isArray(target)) {
    return target.some((t) => String(t).includes("slug"));
  }
  return typeof target === "string" && target.includes("slug");
}
