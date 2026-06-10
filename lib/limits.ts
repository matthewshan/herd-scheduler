// Input-size caps for untrusted writes (spec §9). Anyone with a poll link is an
// unauthenticated writer (guest voting) and creators post free-form text, so the
// server actions bound every user-supplied field here rather than trusting the
// client or Postgres `text` columns to absorb arbitrarily large payloads. These
// are the cheap, always-on guards; the fuller rate-limiting + per-creator /
// per-poll size-cap system lands in Phase 10 (see phase-10-deploy-phase2.md).
//
// Single source of truth so the server actions and any future Phase 10 work
// (and tests) agree on the numbers.

export const LIMITS = {
  /** Guest display name. */
  guestName: 80,
  /** Poll title. */
  title: 200,
  /** Poll description (optional free text). */
  description: 2000,
  /** Poll location (optional). */
  location: 200,
  /** Time options per poll. */
  slots: 60,
} as const;

/**
 * True when `value` is within `max` characters. Length is measured after the
 * caller trims, so trailing whitespace can't be used to smuggle past the cap.
 */
export function withinLimit(value: string, max: number): boolean {
  return value.length <= max;
}
