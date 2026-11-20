import { describe, expect, expectTypeOf, it } from "vitest";
import type { Response } from "@prisma/client";
import {
  pollResultsInclude,
  scoreSlot,
  summarizeResults,
  type ParticipantInput,
  type PollResultsInput,
  type PollWithResults,
  type SlotInput,
} from "@/lib/results";

// Three slots in chronological (sortOrder) order. Times are arbitrary UTC — the
// pure layer doesn't care about the zone, only counts/order.
const SLOTS: SlotInput[] = [
  {
    id: "s1",
    startTime: new Date("2026-06-06T23:00:00Z"),
    endTime: new Date("2026-06-07T02:00:00Z"),
    sortOrder: 0,
  },
  {
    id: "s2",
    startTime: new Date("2026-06-07T23:00:00Z"),
    endTime: new Date("2026-06-08T02:00:00Z"),
    sortOrder: 1,
  },
  {
    id: "s3",
    startTime: new Date("2026-06-08T23:00:00Z"),
    endTime: new Date("2026-06-09T02:00:00Z"),
    sortOrder: 2,
  },
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
        [voter("Alex", { s1: "no", s2: "yes" }), voter("Sam", { s2: "yes" })],
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
      poll([voter("Alex", { s1: "yes" }), voter("Sam", { s1: "ifneedbe" })], {
        anonymousVoting: true,
      }),
    );
    const s = bySlot(res);
    expect(res.anonymous).toBe(true);
    expect(s.s1.attendees).toBeNull();
    expect(s.s1.canMakeItCount).toBe(2); // aggregate count is still exposed
  });

  it("returns attendees (name + image) for a non-anonymous poll", () => {
    const res = summarizeResults(
      poll([voter("Alex", { s1: "yes" }), voter("Sam", { s1: "ifneedbe" })]),
    );
    expect(bySlot(res).s1.attendees).toEqual([
      { name: "Alex", image: null },
      { name: "Sam", image: null },
    ]);
  });

  it("carries a signed-in voter's profile image into the attendee", () => {
    const withPhoto: ParticipantInput = {
      userId: "u-Alex",
      guestName: null,
      user: { name: "Alex", image: "https://lh3.googleusercontent.com/a/x" },
      availabilities: [{ timeOptionId: "s1", response: "yes" }],
    };
    const res = summarizeResults(poll([withPhoto]));
    expect(bySlot(res).s1.attendees).toEqual([
      { name: "Alex", image: "https://lh3.googleusercontent.com/a/x" },
    ]);
  });
});

describe("summarizeResults — best-fit eligibility (≥1 yes/maybe)", () => {
  it("never makes a blank slot best fit over a negative slot someone can make", () => {
    // s1: 1 yes + 1 no = -1 (Alice can make it). s2/s3: nobody marked = 0.
    const res = summarizeResults(
      poll([voter("Alice", { s1: "yes" }), voter("Bob", { s1: "no" })]),
    );
    const s = bySlot(res);
    expect(s.s1.score).toBe(-1);
    expect(s.s2.score).toBe(0);
    expect(s.s1.isBestFit).toBe(true);
    expect(s.s2.isBestFit).toBe(false);
    expect(s.s3.isBestFit).toBe(false);
    // The eligible slot sorts first even though the blank slots out-score it.
    expect(res.slots.map((x) => x.id)).toEqual(["s1", "s2", "s3"]);
    expect(res.leadSlot?.id).toBe("s1");
  });

  it("sorts ineligible slots after eligible ones (blank before all-No)", () => {
    const res = summarizeResults(
      poll([
        voter("Alice", { s1: "no", s3: "ifneedbe" }),
        voter("Bob", { s3: "no" }),
      ]),
    );
    // s3 eligible (-3), s2 blank (0), s1 all-No (-4).
    expect(res.slots.map((x) => x.id)).toEqual(["s3", "s2", "s1"]);
    expect(res.slots.filter((x) => x.isBestFit).map((x) => x.id)).toEqual([
      "s3",
    ]);
    expect(res.leadSlot?.id).toBe("s3");
  });

  it("has no best fit and no lead when everyone only votes No", () => {
    const res = summarizeResults(
      poll([
        voter("Alice", { s1: "no", s2: "no" }),
        voter("Bob", { s1: "no", s3: "no" }),
      ]),
    );
    expect(res.respondedCount).toBe(2);
    expect(res.slots.some((x) => x.isBestFit)).toBe(false);
    expect(res.leadSlot).toBeNull();
  });

  it("highlights ties among eligible slots equally, ignoring a tied blank slot", () => {
    // s1 and s3 both 1 yes + 1 maybe + 1 no = 0; s2 is blank (also 0).
    const res = summarizeResults(
      poll([
        voter("Alice", { s1: "yes", s3: "yes" }),
        voter("Bob", { s1: "ifneedbe", s3: "ifneedbe" }),
        voter("Cat", { s1: "no", s3: "no" }),
      ]),
    );
    const s = bySlot(res);
    expect([s.s1.score, s.s2.score, s.s3.score]).toEqual([0, 0, 0]);
    expect(
      res.slots
        .filter((x) => x.isBestFit)
        .map((x) => x.id)
        .sort(),
    ).toEqual(["s1", "s3"]);
    expect(res.slots.map((x) => x.id)).toEqual(["s1", "s3", "s2"]);
    expect(res.leadSlot?.id).toBe("s1");
  });

  it("keeps the finalized pick as lead even when no slot is eligible", () => {
    const res = summarizeResults(
      poll([voter("Alice", { s1: "no", s2: "no" })], {
        finalTimeOptionId: "s2",
      }),
    );
    expect(res.slots.some((x) => x.isBestFit)).toBe(false);
    expect(bySlot(res).s2.isFinal).toBe(true);
    expect(res.leadSlot?.id).toBe("s2");
  });

  it("keeps the finalized pick as lead over a higher-scoring eligible slot", () => {
    const res = summarizeResults(
      poll(
        [
          voter("Alice", { s1: "yes", s2: "ifneedbe" }),
          voter("Bob", { s1: "yes" }),
        ],
        { finalTimeOptionId: "s2" },
      ),
    );
    expect(res.slots[0].id).toBe("s1"); // still ranked by score
    expect(res.leadSlot?.id).toBe("s2");
  });
});

describe("pollResultsInclude — privacy (no guestKey)", () => {
  it("selects participant fields explicitly and never guestKey", () => {
    const participants = pollResultsInclude.participants;
    expect(participants).not.toHaveProperty("include");
    expect(Object.keys(participants.select).sort()).toEqual([
      "availabilities",
      "guestName",
      "user",
      "userId",
    ]);
    expect(participants.select).not.toHaveProperty("guestKey");
  });

  it("types loaded participants without guestKey (and the host without email)", () => {
    type LoadedParticipant = PollWithResults["participants"][number];
    expectTypeOf<LoadedParticipant>().not.toHaveProperty("guestKey");
    expectTypeOf<LoadedParticipant>().toHaveProperty("guestName");
    expectTypeOf<PollWithResults["createdBy"]>().not.toHaveProperty("email");
  });
});
