// Poll-timezone ↔ UTC conversion (spec §6; Phase 5). Times are *stored* UTC and
// *displayed* in the poll's timezone. The poll-timezone picker is a fixed 5-zone
// enum (ET / CT / MT / PT / GMT) — never the full IANA list.
//
// The conversion is DST-correct: a wall-clock time in the poll's zone (e.g.
// "7:00 PM" on a June day in ET) maps to the right UTC instant (EDT, UTC-4) and
// round-trips back to the same wall clock. We lean on date-fns-tz for that math.

import { fromZonedTime, toZonedTime, format } from "date-fns-tz";
import type { Timezone } from "@prisma/client";

/**
 * The 5 supported zones, in picker order, with their IANA identity and the
 * labels the design bundle uses. `value` matches the Prisma `Timezone` enum.
 */
export const TIMEZONES: {
  value: Timezone;
  iana: string;
  label: string;
  /** Short code shown on the TzChip / where space is tight. */
  short: string;
  /** Human zone name for the chip, e.g. "Eastern Time". */
  name: string;
}[] = [
  {
    value: "ET",
    iana: "America/New_York",
    label: "Eastern Time (ET)",
    short: "ET",
    name: "Eastern Time",
  },
  {
    value: "CT",
    iana: "America/Chicago",
    label: "Central Time (CT)",
    short: "CT",
    name: "Central Time",
  },
  {
    value: "MT",
    iana: "America/Denver",
    label: "Mountain Time (MT)",
    short: "MT",
    name: "Mountain Time",
  },
  {
    value: "PT",
    iana: "America/Los_Angeles",
    label: "Pacific Time (PT)",
    short: "PT",
    name: "Pacific Time",
  },
  {
    value: "GMT",
    iana: "Etc/GMT",
    label: "Greenwich Mean Time (GMT)",
    short: "GMT",
    name: "Greenwich Mean Time",
  },
];

/** The default poll timezone (spec: defaults to ET). */
export const DEFAULT_TIMEZONE: Timezone = "ET";

const BY_VALUE = new Map(TIMEZONES.map((t) => [t.value, t]));

/** Resolve a `Timezone` enum value to its IANA identifier. Falls back to ET. */
export function ianaFor(tz: Timezone): string {
  return (BY_VALUE.get(tz) ?? BY_VALUE.get(DEFAULT_TIMEZONE)!).iana;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Parse a 30-minute display label ("7:00 PM", "12:30 AM") into 24-hour parts.
 * Mirrors the labels produced by `generateTimeOptions` in lib/calendar.ts.
 * Throws on an unparseable label so a bad slot can't silently store garbage.
 */
export function parseTimeLabel(label: string): {
  hour: number;
  minute: number;
} {
  const m = label.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) throw new Error(`Unrecognized time label: "${label}"`);
  let hour = Number(m[1]) % 12;
  const minute = Number(m[2]);
  if (m[3].toUpperCase() === "PM") hour += 12;
  return { hour, minute };
}

/**
 * Convert a wall-clock time on a calendar day *in the poll's zone* to the UTC
 * instant to store. `month` is 0-indexed (matching JS Date / lib/calendar).
 *
 * We build a zone-less ISO string from the parts and let date-fns-tz interpret
 * it as local-to-`tz`, so the server's own timezone never leaks in.
 */
export function zonedWallTimeToUtc(
  year: number,
  month: number,
  day: number,
  timeLabel: string,
  tz: Timezone,
): Date {
  const { hour, minute } = parseTimeLabel(timeLabel);
  const naive = `${year}-${pad(month + 1)}-${pad(day)}T${pad(hour)}:${pad(
    minute,
  )}:00`;
  return fromZonedTime(naive, ianaFor(tz));
}

/** A stored UTC slot rendered back in the poll's zone, for display. */
export interface DisplaySlot {
  /** e.g. "Fri, Jun 6". */
  date: string;
  /** e.g. "7:00 PM". */
  start: string;
  /** e.g. "10:00 PM". */
  end: string;
}

/**
 * Render a stored UTC start/end back into the poll's zone for display. Uses
 * tabular-friendly clock labels matching the picker (no leading-zero hour).
 */
export function formatSlotInZone(
  startUtc: Date,
  endUtc: Date,
  tz: Timezone,
): DisplaySlot {
  const iana = ianaFor(tz);
  const zStart = toZonedTime(startUtc, iana);
  return {
    date: format(zStart, "EEE, MMM d", { timeZone: iana }),
    start: format(toZonedTime(startUtc, iana), "h:mm a", { timeZone: iana }),
    end: format(toZonedTime(endUtc, iana), "h:mm a", { timeZone: iana }),
  };
}

/** The label for the TzChip, e.g. "Times shown in Eastern Time · ET". */
export function tzChipLabel(tz: Timezone): string {
  const meta = BY_VALUE.get(tz) ?? BY_VALUE.get(DEFAULT_TIMEZONE)!;
  return `Times shown in ${meta.name} · ${meta.short}`;
}
