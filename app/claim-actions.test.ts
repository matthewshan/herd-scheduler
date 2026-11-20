import { beforeEach, describe, expect, it, vi } from "vitest";

// Action-layer test for claimGuestVotesForSlugs (the home-screen batch claim):
// auth/key gating and skipping closed/finalized polls. The claim itself is
// covered in lib/votes-claim.test.ts.
vi.mock("@/lib/prisma", () => ({
  prisma: { poll: { findMany: vi.fn() } },
}));
vi.mock("@/lib/auth", () => ({ getSessionUser: vi.fn() }));
vi.mock("@/lib/polls", () => ({ listPollSummariesBySlug: vi.fn() }));
vi.mock("@/lib/votes", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/votes")>("@/lib/votes");
  return {
    isPollAcceptingVotes: actual.isPollAcceptingVotes,
    claimGuestParticipant: vi.fn(),
  };
});

import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { claimGuestParticipant } from "@/lib/votes";
import { claimGuestVotesForSlugs } from "./actions";

const pollFindMany = vi.mocked(prisma.poll.findMany);
const sessionUser = vi.mocked(getSessionUser);
const claimMock = vi.mocked(claimGuestParticipant);

const KEY = "guestkey1234567890abc";

beforeEach(() => {
  vi.clearAllMocks();
  sessionUser.mockResolvedValue({ id: "user1" } as never);
  claimMock.mockResolvedValue({ s1: "yes" });
});

describe("claimGuestVotesForSlugs", () => {
  it("refuses when signed out or the key is malformed", async () => {
    sessionUser.mockResolvedValueOnce(null);
    expect(await claimGuestVotesForSlugs(["a-poll"], KEY)).toEqual({
      ok: false,
      claimed: 0,
    });
    expect(await claimGuestVotesForSlugs(["a-poll"], "bad")).toEqual({
      ok: false,
      claimed: 0,
    });
    expect(claimMock).not.toHaveBeenCalled();
  });

  it("claims only open, un-finalized polls", async () => {
    pollFindMany.mockResolvedValue([
      { id: "open1", status: "open", finalTimeOptionId: null },
      { id: "closed1", status: "closed", finalTimeOptionId: null },
      { id: "final1", status: "open", finalTimeOptionId: "s9" },
      { id: "open2", status: "open", finalTimeOptionId: null },
    ] as never);
    claimMock.mockImplementation(async (pollId) =>
      pollId === "open2" ? null : { s1: "yes" },
    );
    const res = await claimGuestVotesForSlugs(
      ["open1", "closed1", "final1", "open2"],
      KEY,
    );
    expect(claimMock.mock.calls.map((c) => c[0])).toEqual(["open1", "open2"]);
    // open2 had nothing under the key → not counted.
    expect(res).toEqual({ ok: true, claimed: 1 });
  });
});
