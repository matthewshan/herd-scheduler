import { beforeEach, describe, expect, it, vi } from "vitest";

// Action-layer test for claimGuestVotes (guest → account claiming on the vote
// screen): auth/key/poll gating only. The claim itself is covered in
// lib/votes-claim.test.ts. Kept apart from actions.test.ts (submitVote).
vi.mock("@/lib/prisma", () => ({
  prisma: { poll: { findUnique: vi.fn() } },
}));
vi.mock("@/auth", () => ({ signIn: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getSessionUser: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
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
import { claimGuestVotes } from "./actions";

const pollFindUnique = vi.mocked(prisma.poll.findUnique);
const sessionUser = vi.mocked(getSessionUser);
const claimMock = vi.mocked(claimGuestParticipant);

const KEY = "guestkey1234567890abc";

function setPoll(status: string, finalTimeOptionId: string | null) {
  pollFindUnique.mockResolvedValue({
    id: "poll1",
    status,
    finalTimeOptionId,
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionUser.mockResolvedValue({ id: "user1" } as never);
  setPoll("open", null);
  claimMock.mockResolvedValue({ s1: "yes" });
});

describe("claimGuestVotes", () => {
  it("claims into the session user for an open poll", async () => {
    expect(await claimGuestVotes("game-night", KEY)).toEqual({
      ok: true,
      ballot: { s1: "yes" },
    });
    expect(claimMock).toHaveBeenCalledWith("poll1", KEY, "user1");
  });

  it("refuses when signed out or the key is malformed", async () => {
    sessionUser.mockResolvedValueOnce(null);
    expect(await claimGuestVotes("game-night", KEY)).toEqual({ ok: false });
    expect(await claimGuestVotes("game-night", "nope")).toEqual({ ok: false });
    expect(claimMock).not.toHaveBeenCalled();
  });

  it("skips a closed poll — results stay as they were", async () => {
    setPoll("closed", null);
    expect(await claimGuestVotes("game-night", KEY)).toEqual({
      ok: true,
      ballot: null,
    });
    expect(claimMock).not.toHaveBeenCalled();
  });

  it("skips a finalized poll (finalTimeOptionId set, status still open)", async () => {
    setPoll("open", "s1");
    expect(await claimGuestVotes("game-night", KEY)).toEqual({
      ok: true,
      ballot: null,
    });
    expect(claimMock).not.toHaveBeenCalled();
  });
});
