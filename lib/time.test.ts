import { describe, expect, it } from "vitest";
import { TIME_OPTS } from "./calendar";
import {
  formatSlotInZone,
  formatSpan,
  ianaFor,
  isValidCalendarDate,
  parseTimeLabel,
  tzChipLabel,
  zonedWallTimeToUtc,
} from "./time";

// month is 0-indexed (June = 5, January = 0), matching JS Date / lib/calendar.

describe("parseTimeLabel", () => {
  it("parses AM/PM labels to 24-hour parts", () => {
    expect(parseTimeLabel("7:00 PM")).toEqual({ hour: 19, minute: 0 });
    expect(parseTimeLabel("12:30 AM")).toEqual({ hour: 0, minute: 30 });
    expect(parseTimeLabel("12:00 PM")).toEqual({ hour: 12, minute: 0 });
    expect(parseTimeLabel("9:30 AM")).toEqual({ hour: 9, minute: 30 });
  });

  it("parses every label the picker offers", () => {
    for (const label of TIME_OPTS) {
      expect(() => parseTimeLabel(label)).not.toThrow();
    }
  });

  it("throws on garbage", () => {
    expect(() => parseTimeLabel("not a time")).toThrow();
  });

  it("rejects out-of-range hours and minutes instead of wrapping", () => {
    expect(() => parseTimeLabel("13:00 PM")).toThrow();
    expect(() => parseTimeLabel("0:30 AM")).toThrow();
    expect(() => parseTimeLabel("99:99 PM")).toThrow();
    expect(() => parseTimeLabel("7:60 PM")).toThrow();
  });

  it("rejects non-string input from a crafted request", () => {
    expect(() => parseTimeLabel(7 as unknown as string)).toThrow();
    expect(() => parseTimeLabel(null as unknown as string)).toThrow();
  });
});

describe("isValidCalendarDate", () => {
  it("accepts real dates, including leap day", () => {
    expect(isValidCalendarDate(2026, 0, 31)).toBe(true);
    expect(isValidCalendarDate(2028, 1, 29)).toBe(true);
    expect(isValidCalendarDate(2026, 11, 31)).toBe(true);
  });

  it("rejects dates that don't exist", () => {
    expect(isValidCalendarDate(2026, 1, 30)).toBe(false); // Feb 30
    expect(isValidCalendarDate(2026, 1, 29)).toBe(false); // not a leap year
    expect(isValidCalendarDate(2026, 3, 31)).toBe(false); // Apr 31
    expect(isValidCalendarDate(2026, 0, 0)).toBe(false);
  });

  it("rejects out-of-range months and years", () => {
    expect(isValidCalendarDate(2026, 12, 1)).toBe(false);
    expect(isValidCalendarDate(2026, -1, 1)).toBe(false);
    expect(isValidCalendarDate(275760, 0, 1)).toBe(false);
    expect(isValidCalendarDate(999, 0, 1)).toBe(false);
  });

  it("rejects non-integers and non-numbers", () => {
    expect(isValidCalendarDate(2026, 5, 6.5)).toBe(false);
    expect(isValidCalendarDate("2026", 5, 6)).toBe(false);
    expect(isValidCalendarDate(2026, "5", 6)).toBe(false);
    expect(isValidCalendarDate(2026, 5, NaN)).toBe(false);
    expect(isValidCalendarDate(2026, 5, Infinity)).toBe(false);
  });
});

describe("zonedWallTimeToUtc", () => {
  it("converts ET summer wall time (EDT, UTC-4) to UTC", () => {
    // 7:00 PM ET on Jun 6 2026 → 23:00 UTC same day.
    const utc = zonedWallTimeToUtc(2026, 5, 6, "7:00 PM", "ET");
    expect(utc.toISOString()).toBe("2026-06-06T23:00:00.000Z");
  });

  it("converts ET winter wall time (EST, UTC-5) to UTC, crossing midnight", () => {
    // 7:00 PM ET on Jan 6 2026 → 00:00 UTC the next day.
    const utc = zonedWallTimeToUtc(2026, 0, 6, "7:00 PM", "ET");
    expect(utc.toISOString()).toBe("2026-01-07T00:00:00.000Z");
  });

  it("converts PT summer wall time (PDT, UTC-7) to UTC", () => {
    const utc = zonedWallTimeToUtc(2026, 5, 6, "7:00 PM", "PT");
    expect(utc.toISOString()).toBe("2026-06-07T02:00:00.000Z");
  });

  it("treats GMT as a fixed offset (no DST)", () => {
    const summer = zonedWallTimeToUtc(2026, 5, 6, "7:00 PM", "GMT");
    const winter = zonedWallTimeToUtc(2026, 0, 6, "7:00 PM", "GMT");
    expect(summer.toISOString()).toBe("2026-06-06T19:00:00.000Z");
    expect(winter.toISOString()).toBe("2026-01-06T19:00:00.000Z");
  });

  it("throws (never an Invalid Date) on unreal dates or bad labels", () => {
    expect(() => zonedWallTimeToUtc(2026, 1, 30, "7:00 PM", "ET")).toThrow();
    expect(() => zonedWallTimeToUtc(2026, 12, 1, "7:00 PM", "ET")).toThrow();
    expect(() => zonedWallTimeToUtc(2026, 5, 6.5, "7:00 PM", "ET")).toThrow();
    expect(() => zonedWallTimeToUtc(275760, 0, 1, "7:00 PM", "ET")).toThrow();
    expect(() => zonedWallTimeToUtc(2026, 5, 6, "99:99 PM", "ET")).toThrow();
  });

  // Documented DST behaviour (see the zonedWallTimeToUtc doc comment). The
  // picker can't produce these; we pin them so a library change is noticed.
  it("shifts a nonexistent spring-forward time rather than failing", () => {
    // 2:30 AM ET on Mar 8 2026 doesn't exist → the 1:30 AM EST instant.
    const utc = zonedWallTimeToUtc(2026, 2, 8, "2:30 AM", "ET");
    expect(utc.toISOString()).toBe("2026-03-08T06:30:00.000Z");
  });

  it("resolves an ambiguous fall-back time to one of its occurrences", () => {
    // 1:30 AM ET on Nov 1 2026 happens twice (EDT then EST). Which one
    // date-fns-tz picks varies with the host's zone, so accept either.
    const utc = zonedWallTimeToUtc(2026, 10, 1, "1:30 AM", "ET");
    expect(["2026-11-01T05:30:00.000Z", "2026-11-01T06:30:00.000Z"]).toContain(
      utc.toISOString(),
    );
  });
});

describe("formatSpan", () => {
  const at = (y: number, m: number, d: number) =>
    zonedWallTimeToUtc(y, m, d, "7:00 PM", "ET");

  it("renders a single day", () => {
    expect(formatSpan([at(2026, 5, 14)], "ET")).toBe("Jun 14");
  });

  it("renders a same-month range", () => {
    expect(formatSpan([at(2026, 5, 21), at(2026, 5, 20)], "ET")).toBe(
      "Jun 20–21",
    );
  });

  it("renders a cross-month range", () => {
    expect(formatSpan([at(2026, 5, 30), at(2026, 6, 1)], "ET")).toBe(
      "Jun 30 – Jul 1",
    );
  });

  it("adds years when the span crosses a year", () => {
    expect(formatSpan([at(2026, 11, 30), at(2027, 0, 2)], "ET")).toBe(
      "Dec 30, 2026 – Jan 2, 2027",
    );
    // Same month/day a year apart is not a single day.
    expect(formatSpan([at(2026, 5, 14), at(2027, 5, 14)], "ET")).toBe(
      "Jun 14, 2026 – Jun 14, 2027",
    );
    // Same month, different years — not "Dec 5–10".
    expect(formatSpan([at(2026, 11, 5), at(2027, 11, 10)], "ET")).toBe(
      "Dec 5, 2026 – Dec 10, 2027",
    );
  });

  it("uses the poll's zone, not UTC, for the day", () => {
    // 7 PM PT on Dec 31 2026 is Jan 1 2027 in UTC — still a single PT day.
    const lateNye = zonedWallTimeToUtc(2026, 11, 31, "7:00 PM", "PT");
    expect(formatSpan([lateNye], "PT")).toBe("Dec 31");
  });

  it("returns an empty string for no slots", () => {
    expect(formatSpan([], "ET")).toBe("");
  });
});

describe("formatSlotInZone round-trips", () => {
  it("renders a stored UTC slot back to the poll's wall clock", () => {
    const start = zonedWallTimeToUtc(2026, 5, 6, "7:00 PM", "ET");
    const end = zonedWallTimeToUtc(2026, 5, 6, "10:00 PM", "ET");
    const display = formatSlotInZone(start, end, "ET");
    expect(display.start).toBe("7:00 PM");
    expect(display.end).toBe("10:00 PM");
    expect(display.date).toContain("Jun 6");
  });
});

describe("zone metadata", () => {
  it("maps enum values to IANA identifiers", () => {
    expect(ianaFor("ET")).toBe("America/New_York");
    expect(ianaFor("PT")).toBe("America/Los_Angeles");
    expect(ianaFor("GMT")).toBe("Etc/GMT");
  });

  it("builds a human chip label", () => {
    expect(tzChipLabel("ET")).toBe("Times shown in Eastern Time · ET");
  });
});
