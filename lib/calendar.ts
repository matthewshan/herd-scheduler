// Calendar + time helpers — ported from the design prototype's Calendar.jsx,
// but made fully prop/Date-driven instead of the baked-in May–Aug 2026 sample.
// Months are 0-indexed (matching JS Date). All helpers are pure.

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const MON_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const MONTHS_FULL = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Stable identifier for a calendar day, e.g. "2026-06-06". */
export function dayId(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

/** Human label for a day, e.g. "Fri, Jun 6". */
export function dayLabel(year: number, month: number, day: number): string {
  const dow = new Date(year, month, day).getDay();
  return `${WEEKDAYS[dow]}, ${MON_SHORT[month]} ${day}`;
}

/** Month heading, e.g. "June 2026". */
export function monthLabel(year: number, month: number): string {
  return `${MONTHS_FULL[month]} ${year}`;
}

/** Day-of-week (0=Sun) the 1st of the month falls on. */
export function firstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

/** Number of days in the month. */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Grid cells for a month: leading `null`s to align the 1st, then day numbers. */
export function buildMonthGrid(year: number, month: number): (number | null)[] {
  const cells: (number | null)[] = [];
  const lead = firstDayOfWeek(year, month);
  for (let i = 0; i < lead; i++) cells.push(null);
  const total = daysInMonth(year, month);
  for (let d = 1; d <= total; d++) cells.push(d);
  return cells;
}

/** Add `delta` months to a {year, month}, normalizing across year boundaries. */
export function addMonths(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const idx = year * 12 + month + delta;
  return { year: Math.floor(idx / 12), month: ((idx % 12) + 12) % 12 };
}

/**
 * 30-minute time options as display labels, e.g. "9:00 AM" → "11:30 PM".
 * Defaults match the prototype (9:00 AM through 11:30 PM).
 */
export function generateTimeOptions(
  startHour = 9,
  endHour = 23,
  stepMin = 30,
): string[] {
  const out: string[] = [];
  for (let h = startHour; h <= endHour; h++) {
    for (let m = 0; m < 60; m += stepMin) {
      const ap = h < 12 ? "AM" : "PM";
      const hr = h % 12 === 0 ? 12 : h % 12;
      out.push(`${hr}:${pad(m)} ${ap}`);
    }
  }
  return out;
}

/** Convenience default list used by the time-range pickers. */
export const TIME_OPTS = generateTimeOptions();
