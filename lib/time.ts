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
 * Strict: the hour must be 1–12 and the minute 00–59, so "13:00 PM" or
 * "99:99 PM" are rejected rather than wrapped. Throws on an unparseable label
 * so a bad slot can't silently store garbage.
 */
export function parseTimeLabel(label: string): {
  hour: number;
  minute: number;
} {
  const m =
    typeof label === "string"
      ? label.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
      : null;
  if (!m) {
    throw new Error(`Unrecognized time label: "${String(label)}"`);
  }
  const rawHour = Number(m[1]);
  const minute = Number(m[2]);
  if (rawHour < 1 || rawHour > 12 || minute > 59) {
    throw new Error(`Unrecognized time label: "${label}"`);
  }
  let hour = rawHour % 12;
  if (m[3].toUpperCase() === "PM") {
    hour += 12;
  }
  return { hour, minute };
}

/** Days in a month (0-indexed month), independent of the host timezone. */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/**
 * True when year / month (0-indexed) / day name a real calendar date: all
 * integers, a 4-digit year, month 0–11, and a day that exists in that month
 * (so no Feb 30, no `day: 6.5`, no string parts from a crafted request).
 */
export function isValidCalendarDate(
  year: unknown,
  month: unknown,
  day: unknown,
): boolean {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return false;
  }
  const y = year as number;
  const m = month as number;
  const d = day as number;
  return (
    y >= 1000 &&
    y <= 9999 &&
    m >= 0 &&
    m <= 11 &&
    d >= 1 &&
    d <= daysInMonth(y, m)
  );
}

/**
 * Convert a wall-clock time on a calendar day *in the poll's zone* to the UTC
 * instant to store. `month` is 0-indexed (matching JS Date / lib/calendar).
 *
 * We build a zone-less ISO string from the parts and let date-fns-tz interpret
 * it as local-to-`tz`, so the server's own timezone never leaks in.
 *
 * Throws (never returns an Invalid Date) on a non-existent calendar date or an
 * unparseable time label.
 *
 * DST edges (left as-is, by design): a wall time that doesn't exist (2:30 AM ET
 * on spring-forward day) silently shifts by the gap — date-fns-tz yields the
 * instant that reads 1:30 AM EST — and an ambiguous fall-back time (1:30 AM ET,
 * which happens twice) resolves to one of its two occurrences; which one
 * depends on the *host's* zone (a date-fns-tz quirk: EDT on a UTC/US host, EST
 * on e.g. Asia/Tokyo). The create flow can't reach either: its picker and the
 * server's TIME_OPTS check only allow 9:00 AM–11:30 PM, so we document rather
 * than special-case them.
 */
export function zonedWallTimeToUtc(
  year: number,
  month: number,
  day: number,
  timeLabel: string,
  tz: Timezone,
): Date {
  if (!isValidCalendarDate(year, month, day)) {
    throw new Error(`Not a real date: ${year}-${month + 1}-${day}`);
  }
  const { hour, minute } = parseTimeLabel(timeLabel);
  const naive = `${year}-${pad(month + 1)}-${pad(day)}T${pad(hour)}:${pad(
    minute,
  )}:00`;
  const utc = fromZonedTime(naive, ianaFor(tz));
  if (Number.isNaN(utc.getTime())) {
    throw new Error(`Couldn't convert ${naive} (${tz}) to UTC`);
  }
  return utc;
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
  const zEnd = toZonedTime(endUtc, iana);
  return {
    date: format(zStart, "EEE, MMM d", { timeZone: iana }),
    start: format(zStart, "h:mm a", { timeZone: iana }),
    end: format(zEnd, "h:mm a", { timeZone: iana }),
  };
}

/** The label for the TzChip, e.g. "Times shown in Eastern Time · ET". */
export function tzChipLabel(tz: Timezone): string {
  const meta = BY_VALUE.get(tz) ?? BY_VALUE.get(DEFAULT_TIMEZONE)!;
  return `Times shown in ${meta.name} · ${meta.short}`;
}

/** Short zone code for compact lines, e.g. "ET". */
export function tzShort(tz: Timezone): string {
  return (BY_VALUE.get(tz) ?? BY_VALUE.get(DEFAULT_TIMEZONE)!).short;
}

/**
 * A compact day · time label for one slot in the poll's zone, e.g.
 * "Sat, Jun 7 · 6 PM ET" (the creator-home lead line). The minutes are dropped
 * on the hour to stay terse; the short tz code is appended.
 */
export function formatLeadLabel(startUtc: Date, tz: Timezone): string {
  const iana = ianaFor(tz);
  const z = toZonedTime(startUtc, iana);
  const day = format(z, "EEE, MMM d", { timeZone: iana });
  // Drop ":00" on whole hours ("6:00 PM" → "6 PM"); keep minutes otherwise.
  const time = format(z, "h:mm a", { timeZone: iana }).replace(":00", "");
  return `${day} · ${time} ${tzShort(tz)}`;
}

/**
 * The date span across a poll's slots, in the poll's zone, e.g. "Jun 14",
 * "Jun 20–21", or "Jun 30 – Jul 1". A span that crosses a year carries the
 * year on both ends, e.g. "Dec 30, 2026 – Jan 2, 2027". `starts` are stored UTC
 * slot start times. Returns "" for an empty list (a poll always has slots, so
 * this is a guard).
 */
export function formatSpan(starts: Date[], tz: Timezone): string {
  if (starts.length === 0) {
    return "";
  }
  const iana = ianaFor(tz);
  const sorted = [...starts].sort((a, b) => a.getTime() - b.getTime());
  const first = toZonedTime(sorted[0], iana);
  const last = toZonedTime(sorted[sorted.length - 1], iana);

  const firstYear = format(first, "yyyy", { timeZone: iana });
  const lastYear = format(last, "yyyy", { timeZone: iana });
  const firstMonth = format(first, "MMM", { timeZone: iana });
  const lastMonth = format(last, "MMM", { timeZone: iana });
  const firstDay = format(first, "d", { timeZone: iana });
  const lastDay = format(last, "d", { timeZone: iana });

  if (firstYear !== lastYear) {
    return `${firstMonth} ${firstDay}, ${firstYear} – ${lastMonth} ${lastDay}, ${lastYear}`;
  }
  if (firstMonth === lastMonth && firstDay === lastDay) {
    return `${firstMonth} ${firstDay}`;
  }
  if (firstMonth === lastMonth) {
    return `${firstMonth} ${firstDay}–${lastDay}`;
  }
  return `${firstMonth} ${firstDay} – ${lastMonth} ${lastDay}`;
}
