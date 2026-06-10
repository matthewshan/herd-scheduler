import { describe, expect, it } from "vitest";
import type { Response } from "@prisma/client";
import {
  scoreSlot,
  summarizeResults,
  type ParticipantInput,
  type PollResultsInput,
  type SlotInput,
} from "@/lib/results";

// Three slots in chronological (sortOrder) order. Times are arbitrary UTC — the
// pure layer doesn't care about the zone, only counts/order.
const SLOTS: SlotInput[] = [
  { id: "s1", startTime: new Date("2026-06-06T23:00:00Z"), endTime: new Date("2026-06-07T02:00:00Z"), sortOrder: 0 },
  { id: "s2", startTime: new Date("2026-06-07T23:00:00Z"), endTime: new Date("2026-06-08T02:00:00Z"), sortOrder: 1 },
  { id: "s3", startTime: new Date("2026-06-08T23:00:00Z"), endTime: new Date("2026-06-09T02:00:00Z"), sortOrder: 2 },
];

// Build a participant from a {slotId: response} map.
function voter(
  name: string,
  votes: Record<string, Response>,
  opts: { guest?: boolean } = {},
): ParticipantInput {
  return {
    userId: opts.guest ? null : `u-${name}`,
    guestName: opts.guest ? name : null,
    user: opts.guest ? null : { name },
    availabilities: Object.entries(votes).map(([timeOptionId, response]) => ({
      timeOptionId,
      response,
    })),
  };
}

function poll(
  participants: ParticipantInput[],
  extra: Partial<PollResultsInput> = {},
): PollResultsInput {
  return {
    anonymousVoting: false,
    finalTimeOptionId: null,
    timeOptions: SLOTS,
    participants,
    ...extra,
  };
}

const bySlot = (res: ReturnType<typeof summarizeResults>) =>
  Object.fromEntries(res.slots.map((s) => [s.id, s]));

describe("scoreSlot", () => {
  it("computes yes*3 + maybe - no*4", () => {
    expect(scoreSlot(2, 1, 0)).toBe(7);
    expect(scoreSlot(0, 0, 1)).toBe(-4);
    expect(scoreSlot(0, 0, 0)).toBe(0);
  });
});

describe("summarizeResults — counts & responded", () => {
  it("tallies yes/maybe/no per slot and counts distinct responders", () => {
    const res = summarizeResults(
      poll([
        voter("Alex", { s1: "yes", s2: "no" }),
        voter("Sam", { s1: "yes", s2: "ifneedbe" }),
      ]),
    );
    const s = bySlot(res);
    expect(res.respondedCount).toBe(2);
    expect([s.s1.yes, s.s1.maybe, s.s1.no]).toEqual([2, 0, 0]);
    expect([s.s2.yes, s.s2.maybe, s.s2.no]).toEqual([0, 1, 1]);
  });

  it("ignores participants with no availability rows (blank submits)", () => {
    const res = summarizeResults(
      poll([voter("Alex", { s1: "yes" }), voter("Ghost", {})]),
    );
    expect(res.respondedCount).toBe(1);
  });
});

describe("summarizeResults — best fit & ordering", () => {
  it("sorts best-fit first and rings only the top score", () => {
    // s2 is the clear winner; s1 has a hard no.
    const res = summarizeResults(
      poll([
        voter("Alex", { s1: "no", s2: "yes" }),
        voter("Sam", { s1: "yes", s2: "yes" }),
      ]),
    );
    expect(res.slots[0].id).toBe("s2");
    expect(res.slots[0].isBestFit).toBe(true);
    expect(res.slots.filter((s) => s.isBestFit)).toHaveLength(1);
    expect(res.leadSlot?.id).toBe("s2");
  });

  it("highlights tied top scores equally and breaks order by sortOrder", () => {
    const res = summarizeResults(
      poll([voter("Alex", { s1: "yes", s3: "yes" })]),
    );
    const best = res.slots.filter((s) => s.isBestFit);
    expect(best.map((s) => s.id).sort()).toEqual(["s1", "s3"]);
    // Tie → earlier slot leads.
    expect(res.leadSlot?.id).toBe("s1");
  });

  it("marks nothing best-fit and has no lead when there are no responses", () => {
    const res = summarizeResults(poll([]));
    expect(res.respondedCount).toBe(0);
    expect(res.slots.some((s) => s.isBestFit)).toBe(false);
    expect(res.leadSlot).toBeNull();
  });
});

describe("summarizeResults — works for everyone", () => {
  it("fires iff zero hard-No and someone is available, independent of best-fit", () => {
    const res = summarizeResults(
      poll([
        voter("Alex", { s1: "yes", s2: "no" }),
        voter("Sam", { s1: "ifneedbe" }),
      ]),
    );
    const s = bySlot(res);
    expect(s.s1.worksForEveryone).toBe(true); // 1 yes, 1 maybe, 0 no
    expect(s.s2.worksForEveryone).toBe(false); // has a no
    expect(s.s3.worksForEveryone).toBe(false); // nobody available
  });
});

describe("summarizeResults — finalize", () => {
  it("suppresses best-fit rings once finalized and leads with the final pick", () => {
    const res = summarizeResults(
      poll(
        [
          voter("Alex", { s1: "no", s2: "yes" }),
          voter("Sam", { s2: "yes" }),
        ],
        { finalTimeOptionId: "s1" },
      ),
    );
    expect(res.slots.some((s) => s.isBestFit)).toBe(false);
    const s = bySlot(res);
    expect(s.s1.isFinal).toBe(true);
    expect(res.leadSlot?.id).toBe("s1");
  });
});

describe("summarizeResults — anonymity (privacy guard)", () => {
  it("drops attendee names but keeps aggregate counts when anonymous", () => {
    const res = summarizeResults(
      poll(
        [
          voter("Alex", { s1: "yes" }),
          voter("Sam", { s1: "ifneedbe" }),
        ],
        { anonymousVoting: true },
      ),
    );
    const s = bySlot(res);
    expect(res.anonymous).toBe(true);
    expect(s.s1.attendees).toBeNull();
    expect(s.s1.canMakeItCount).toBe(2); // aggregate count is still exposed
  });

  it("returns attendee names for a non-anonymous poll", () => {
    const res = summarizeResults(
      poll([voter("Alex", { s1: "yes" }), voter("Sam", { s1: "ifneedbe" })]),
    );
    expect(bySlot(res).s1.attendees).toEqual(["Alex", "Sam"]);
  });
});
