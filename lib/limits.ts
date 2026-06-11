// Input-size caps for untrusted writes (spec §9). Anyone with a poll link is an
// unauthenticated writer (guest voting) and creators post free-form text, so the
// server actions bound every user-supplied field here rather than trusting the
// client or Postgres `text` columns to absorb arbitrarily large payloads.
// Per-field character caps are fixed; the row-count caps below (per-creator
// polls, per-poll slots/participants) are env-tunable (Phase 10), with these
// values as the defaults. Rate limiting lives in `lib/rate-limit.ts`.
//
// Single source of truth so the server actions and tests agree on the numbers.

export const LIMITS = {
  /** Guest display name. */
  guestName: 80,
  /** Poll title. */
  title: 200,
  /** Poll description (optional free text). */
  description: 2000,
  /** Poll location (optional). */
  location: 200,
  /** Time options per poll (default — override with MAX_SLOTS_PER_POLL). */
  slots: 60,
  /** Polls per creator (default — override with MAX_POLLS_PER_CREATOR). */
  pollsPerCreator: 100,
  /**
   * Participants per poll (default — override with MAX_PARTICIPANTS_PER_POLL).
   */
  participantsPerPoll: 250,
} as const;

// Positive-integer env override with a fallback — a bad value falls back to
// the default rather than silently uncapping. Read per call (not at module
// load) so deployments tune without code changes and tests can set env.
function envCap(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const n = Number.parseInt(raw, 10);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

/** Max time options a single poll may have. */
export function maxSlotsPerPoll(): number {
  return envCap("MAX_SLOTS_PER_POLL", LIMITS.slots);
}

/** Max polls a single creator may have (lifetime row count, not a rate). */
export function maxPollsPerCreator(): number {
  return envCap("MAX_POLLS_PER_CREATOR", LIMITS.pollsPerCreator);
}

/** Max participants (distinct voters) a single poll may accumulate. */
export function maxParticipantsPerPoll(): number {
  return envCap("MAX_PARTICIPANTS_PER_POLL", LIMITS.participantsPerPoll);
}

/**
 * True when `value` is within `max` characters. Length is measured after the
 * caller trims, so trailing whitespace can't be used to smuggle past the cap.
 */
export function withinLimit(value: string, max: number): boolean {
  return value.length <= max;
}
