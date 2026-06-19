import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the DB so this is a pure unit test of the shaping/ordering logic.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    poll: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { listPollSummariesBySlug } from "@/lib/polls";

const findMany = vi.mocked(prisma.poll.findMany);

// Minimal poll row shaped enough for toSummary (summarizeResults + formatSpan).
// No participants → responded 0, lead null; that's irrelevant to ordering.
function poll(slug: string, title: string) {
  return {
    slug,
    title,
    status: "open",
    timezone: "ET",
    finalTimeOptionId: null,
    anonymousVoting: false,
    timeOptions: [
      {
        id: `${slug}-t1`,
        startTime: new Date("2026-06-20T23:00:00Z"),
        endTime: new Date("2026-06-21T00:00:00Z"),
        sortOrder: 0,
      },
    ],
    participants: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listPollSummariesBySlug", () => {
  it("returns summaries in the input slug order, regardless of DB order", async () => {
    // DB returns them in a different order than requested.
    findMany.mockResolvedValue([
      poll("c", "Poll C"),
      poll("a", "Poll A"),
    ] as never);

    const out = await listPollSummariesBySlug(["a", "b", "c"]);

    // "b" wasn't found (deleted) → omitted; the rest follow input order.
    expect(out.map((p) => p.slug)).toEqual(["a", "c"]);
    expect(out.map((p) => p.title)).toEqual(["Poll A", "Poll C"]);
  });

  it("short-circuits on an empty list without hitting the DB", async () => {
    const out = await listPollSummariesBySlug([]);
    expect(out).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });
});
