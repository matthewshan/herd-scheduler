import { describe, expect, it } from "vitest";
import {
  formatSlotInZone,
  ianaFor,
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

  it("throws on garbage", () => {
    expect(() => parseTimeLabel("not a time")).toThrow();
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
