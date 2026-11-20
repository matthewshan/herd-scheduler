import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { isSlugCollision, validateSlots } from "./slots";

// A fixed "now" so nothing depends on the real clock or the host timezone:
// Nov 20 2026, noon UTC (7 AM ET).
const NOW = new Date("2026-11-20T12:00:00.000Z");

const slot = (overrides: Record<string, unknown> = {}) => ({
  year: 2026,
  month: 11, // December
  day: 5,
  start: "7:00 PM",
  end: "10:00 PM",
  ...overrides,
});

function errorOf(slots: unknown): string | null {
  const res = validateSlots(slots, "ET", NOW);
  return res.ok ? null : res.error;
}

describe("validateSlots", () => {
  it("converts valid slots to ordered UTC rows", () => {
    const res = validateSlots([slot(), slot({ day: 6 })], "ET", NOW);
    expect(res).toEqual({
      ok: true,
      timeOptions: [
        {
          startTime: new Date("2026-12-06T00:00:00.000Z"),
          endTime: new Date("2026-12-06T03:00:00.000Z"),
          sortOrder: 0,
        },
        {
          startTime: new Date("2026-12-07T00:00:00.000Z"),
          endTime: new Date("2026-12-07T03:00:00.000Z"),
          sortOrder: 1,
        },
      ],
    });
  });

  it("rejects an empty or non-array slot list", () => {
    expect(errorOf([])).toBe("Add at least one time.");
    expect(errorOf("nope")).toBe("Add at least one time.");
    expect(errorOf(null)).toBe("Add at least one time.");
  });

  it.each([
    ["Feb 30", { year: 2027, month: 1, day: 30 }],
    ["month 13", { month: 12 }],
    ["month -1", { month: -1 }],
    ["fractional day", { day: 6.5 }],
    ["string year", { year: "2026" }],
    ["string day", { day: "5" }],
    ["huge year", { year: 275760 }],
    ["99:99 PM", { start: "99:99 PM" }],
    ["13:00 PM", { start: "13:00 PM" }],
    ["off-grid minutes", { start: "7:15 PM" }],
    ["outside the picker's hours", { start: "2:30 AM", end: "3:00 AM" }],
    ["non-string label", { end: 22 }],
  ])("rejects %s with a friendly error (no throw)", (_name, overrides) => {
    expect(errorOf([slot(overrides)])).toBe("Couldn't read those times.");
  });

  it("rejects a non-object slot", () => {
    expect(errorOf([null])).toBe("Couldn't read those times.");
    expect(errorOf(["Dec 5"])).toBe("Couldn't read those times.");
  });

  it("rejects end at or before start", () => {
    expect(errorOf([slot({ end: "7:00 PM" })])).toBe(
      "End time must be after the start time.",
    );
    expect(errorOf([slot({ end: "6:00 PM" })])).toBe(
      "End time must be after the start time.",
    );
  });

  it("rejects slots that have already ended in the poll's zone", () => {
    expect(errorOf([slot({ month: 10, day: 19 })])).toBe(
      "Those times are in the past — pick a future date.",
    );
  });

  it("accepts today's later slot in the poll's zone", () => {
    // 7 AM ET now; 7 PM ET today is still ahead.
    expect(errorOf([slot({ month: 10, day: 20 })])).toBeNull();
  });

  it("rejects slots more than two years out", () => {
    expect(errorOf([slot({ year: 2028, month: 10, day: 19 })])).toBeNull();
    expect(errorOf([slot({ year: 2028, month: 10, day: 21 })])).toBe(
      "Pick dates within the next 2 years.",
    );
  });

  it("dedupes identical slots, keeping the first", () => {
    const res = validateSlots(
      [slot(), slot({ day: 6 }), slot(), slot({ day: 6 })],
      "ET",
      NOW,
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.timeOptions).toHaveLength(2);
      expect(res.timeOptions.map((t) => t.sortOrder)).toEqual([0, 1]);
    }
  });

  it("keeps same-day slots with different ranges", () => {
    const res = validateSlots(
      [slot(), slot({ start: "9:00 AM", end: "11:00 AM" })],
      "ET",
      NOW,
    );
    expect(res.ok && res.timeOptions).toHaveLength(2);
  });
});

describe("isSlugCollision", () => {
  const p2002 = (target: unknown) =>
    new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "test",
      meta: { target },
    });

  it("matches a P2002 on the slug field", () => {
    expect(isSlugCollision(p2002(["slug"]))).toBe(true);
    expect(isSlugCollision(p2002("Poll_slug_key"))).toBe(true);
  });

  it("ignores other unique violations and other errors", () => {
    expect(isSlugCollision(p2002(["pollId", "guestKey"]))).toBe(false);
    expect(isSlugCollision(p2002(undefined))).toBe(false);
    expect(
      isSlugCollision(
        new Prisma.PrismaClientKnownRequestError("Not found", {
          code: "P2025",
          clientVersion: "test",
          meta: { target: ["slug"] },
        }),
      ),
    ).toBe(false);
    expect(isSlugCollision(new Error("slug"))).toBe(false);
  });
});
