import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Action-layer unit test: mock every collaborator so this exercises only
// submitVote's validation/branching (poll lookup, guest-name gate, slot/value
// filtering, audit action choice). saveBallot's persistence is covered in
// lib/votes.test.ts.
vi.mock("@/lib/prisma", () => ({
  prisma: { poll: { findUnique: vi.fn() } },
}));
vi.mock("@/auth", () => ({ signIn: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getSessionUser: vi.fn() }));
// Server actions read the client IP via next/headers, which only exists inside
// a real request scope — stub a stable forwarded address.
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ "x-forwarded-for": "203.0.113.9" })),
}));
vi.mock("@/lib/votes", async () => {
  // The real ParticipantLimitError class so the action's instanceof check works.
  const actual =
    await vi.importActual<typeof import("@/lib/votes")>("@/lib/votes");
  return {
    ParticipantLimitError: actual.ParticipantLimitError,
    PollUnavailableError: actual.PollUnavailableError,
    saveBallot: vi.fn(),
    loadGuestRecord: vi.fn(),
  };
});
vi.mock("@/lib/access", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/access")>("@/lib/access");
  return { ...actual, logAction: vi.fn() };
});

import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import {
  saveBallot,
  ParticipantLimitError,
  PollUnavailableError,
} from "@/lib/votes";
import { logAction, AUDIT_ACTIONS } from "@/lib/access";
import { LIMITS } from "@/lib/limits";
import { resetRateLimits } from "@/lib/rate-limit";
import { submitVote } from "./actions";

const pollFindUnique = vi.mocked(prisma.poll.findUnique);
const sessionUser = vi.mocked(getSessionUser);
const saveBallotMock = vi.mocked(saveBallot);
const logActionMock = vi.mocked(logAction);

// A well-formed per-browser guest key (Phase 9) — guests must send one.
const GUEST_KEY = "guestkey1234567890abc";

// A standard open poll with three real slots.
function setOpenPoll() {
  pollFindUnique.mockResolvedValue({
    id: "poll1",
    status: "open",
    finalTimeOptionId: null,
    timeOptions: [{ id: "s1" }, { id: "s2" }, { id: "s3" }],
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimits(); // the limiter is module-level state shared across tests
  setOpenPoll();
  sessionUser.mockResolvedValue(null); // guest by default
  saveBallotMock.mockResolvedValue({ participantId: "p1", isFirstCast: true });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("submitVote — poll state", () => {
  it("errors when the poll doesn't exist", async () => {
    pollFindUnique.mockResolvedValue(null);
    const res = await submitVote({
      slug: "x",
      guestName: "Sam",
      guestKey: GUEST_KEY,
      votes: { s1: "yes" },
    });
    expect(res).toEqual({
      ok: false,
      error: expect.stringContaining("no longer exists"),
    });
    expect(saveBallotMock).not.toHaveBeenCalled();
  });

  it("errors when the poll is closed", async () => {
    pollFindUnique.mockResolvedValue({
      id: "poll1",
      status: "closed",
      finalTimeOptionId: null,
      timeOptions: [{ id: "s1" }],
    } as never);
    const res = await submitVote({
      slug: "x",
      guestName: "Sam",
      guestKey: GUEST_KEY,
      votes: { s1: "yes" },
    });
    expect(res).toEqual({
      ok: false,
      error: expect.stringContaining("closed"),
    });
    expect(saveBallotMock).not.toHaveBeenCalled();
  });

  it("errors when the poll is finalized (voting has ended)", async () => {
    pollFindUnique.mockResolvedValue({
      id: "poll1",
      status: "open",
      finalTimeOptionId: "s1",
      timeOptions: [{ id: "s1" }],
    } as never);
    const res = await submitVote({
      slug: "x",
      guestName: "Sam",
      guestKey: GUEST_KEY,
      votes: { s1: "yes" },
    });
    expect(res).toEqual({
      ok: false,
      error: expect.stringContaining("closed"),
    });
    expect(saveBallotMock).not.toHaveBeenCalled();
  });
});

describe("submitVote — guest name gate", () => {
  it("requires a guest name when not signed in", async () => {
    const res = await submitVote({ slug: "x", votes: { s1: "yes" } });
    expect(res.ok).toBe(false);
    expect(saveBallotMock).not.toHaveBeenCalled();
  });

  it("trims the guest name; identity keys on guestKey with the name as label", async () => {
    await submitVote({
      slug: "x",
      guestName: "  Sam  ",
      guestKey: GUEST_KEY,
      votes: { s1: "yes" },
    });
    expect(saveBallotMock).toHaveBeenCalledWith(
      expect.objectContaining({
        identity: { guestKey: GUEST_KEY, guestName: "Sam" },
      }),
    );
  });

  it("rejects a guest submit with no guestKey (Phase 9 gate)", async () => {
    const res = await submitVote({
      slug: "x",
      guestName: "Sam",
      votes: { s1: "yes" },
    });
    expect(res.ok).toBe(false);
    expect(saveBallotMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed guestKey", async () => {
    const res = await submitVote({
      slug: "x",
      guestName: "Sam",
      guestKey: "nope!",
      votes: { s1: "yes" },
    });
    expect(res.ok).toBe(false);
    expect(saveBallotMock).not.toHaveBeenCalled();
  });

  it("rejects an over-long guest name (input-size cap)", async () => {
    const res = await submitVote({
      slug: "x",
      guestName: "a".repeat(LIMITS.guestName + 1),
      votes: { s1: "yes" },
    });
    expect(res.ok).toBe(false);
    expect(saveBallotMock).not.toHaveBeenCalled();
  });

  it("ignores guestName and keys on userId when signed in", async () => {
    sessionUser.mockResolvedValue({
      id: "user1",
      email: "u@example.com",
    } as never);
    await submitVote({ slug: "x", guestName: "ignored", votes: { s1: "yes" } });
    expect(saveBallotMock).toHaveBeenCalledWith(
      expect.objectContaining({ identity: { userId: "user1" } }),
    );
  });
});

describe("submitVote — ballot filtering", () => {
  it("drops stale slot ids not belonging to the poll", async () => {
    await submitVote({
      slug: "x",
      guestName: "Sam",
      guestKey: GUEST_KEY,
      votes: { s1: "yes", gone: "no" },
    });
    expect(saveBallotMock).toHaveBeenCalledWith(
      expect.objectContaining({ ballot: { s1: "yes" } }),
    );
  });

  it("rejects an unknown answer value", async () => {
    const res = await submitVote({
      slug: "x",
      guestName: "Sam",
      guestKey: GUEST_KEY,
      votes: { s1: "definitely" as never },
    });
    expect(res.ok).toBe(false);
    expect(saveBallotMock).not.toHaveBeenCalled();
  });

  it("rejects an empty ballot (so saveBallot never wipes all rows)", async () => {
    const res = await submitVote({
      slug: "x",
      guestName: "Sam",
      guestKey: GUEST_KEY,
      votes: {},
    });
    expect(res.ok).toBe(false);
    expect(saveBallotMock).not.toHaveBeenCalled();
  });

  it("rejects a ballot that's empty after stale ids are dropped", async () => {
    const res = await submitVote({
      slug: "x",
      guestName: "Sam",
      guestKey: GUEST_KEY,
      votes: { gone: "yes" },
    });
    expect(res.ok).toBe(false);
    expect(saveBallotMock).not.toHaveBeenCalled();
  });
});

describe("submitVote — audit action", () => {
  it("logs vote.cast and returns updated:false on a first cast", async () => {
    saveBallotMock.mockResolvedValue({
      participantId: "p1",
      isFirstCast: true,
    });
    const res = await submitVote({
      slug: "x",
      guestName: "Sam",
      guestKey: GUEST_KEY,
      votes: { s1: "yes" },
    });
    expect(res).toEqual({ ok: true, updated: false });
    expect(logActionMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: AUDIT_ACTIONS.voteCast }),
    );
  });

  it("logs vote.update and returns updated:true on a resubmit", async () => {
    saveBallotMock.mockResolvedValue({
      participantId: "p1",
      isFirstCast: false,
    });
    const res = await submitVote({
      slug: "x",
      guestName: "Sam",
      guestKey: GUEST_KEY,
      votes: { s1: "yes" },
    });
    expect(res).toEqual({ ok: true, updated: true });
    expect(logActionMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: AUDIT_ACTIONS.voteUpdate }),
    );
  });
});

describe("submitVote — abuse guards (Phase 10)", () => {
  afterEach(() => {
    delete process.env.RATE_LIMIT_VOTE_MAX;
  });

  it("rejects a submit past the per-IP rate limit", async () => {
    process.env.RATE_LIMIT_VOTE_MAX = "1";
    const input = {
      slug: "x",
      guestName: "Sam",
      guestKey: GUEST_KEY,
      votes: { s1: "yes" as const },
    };

    expect((await submitVote(input)).ok).toBe(true);
    const second = await submitVote(input);
    expect(second).toEqual({
      ok: false,
      error: expect.stringContaining("Too many submissions"),
    });
    expect(saveBallotMock).toHaveBeenCalledTimes(1);
  });

  it("returns a friendly error when the poll is at its participant cap", async () => {
    saveBallotMock.mockRejectedValue(new ParticipantLimitError(250));
    const res = await submitVote({
      slug: "x",
      guestName: "Sam",
      guestKey: GUEST_KEY,
      votes: { s1: "yes" },
    });
    expect(res).toEqual({
      ok: false,
      error: expect.stringContaining("full"),
    });
    expect(logActionMock).not.toHaveBeenCalled();
  });

  it("passes the participant cap through to saveBallot", async () => {
    await submitVote({
      slug: "x",
      guestName: "Sam",
      guestKey: GUEST_KEY,
      votes: { s1: "yes" },
    });
    expect(saveBallotMock).toHaveBeenCalledWith(
      expect.objectContaining({ maxParticipants: 250 }),
    );
  });
});

describe("submitVote — finalize race (lock re-check in saveBallot)", () => {
  it("maps a poll closed/finalized under the lock to the same closed error", async () => {
    // The pre-check saw an open poll, but a finalize committed before the
    // ballot's transaction took the poll lock.
    saveBallotMock.mockRejectedValue(new PollUnavailableError("closed"));
    const res = await submitVote({
      slug: "x",
      guestName: "Sam",
      guestKey: GUEST_KEY,
      votes: { s1: "yes" },
    });
    expect(res).toEqual({
      ok: false,
      error: "This poll is closed — voting has ended.",
    });
    expect(logActionMock).not.toHaveBeenCalled();
  });

  it("maps a poll deleted mid-submit to the no-longer-exists error", async () => {
    saveBallotMock.mockRejectedValue(new PollUnavailableError("missing"));
    const res = await submitVote({
      slug: "x",
      guestName: "Sam",
      guestKey: GUEST_KEY,
      votes: { s1: "yes" },
    });
    expect(res).toEqual({
      ok: false,
      error: expect.stringContaining("no longer exists"),
    });
  });
});

describe("submitVote — malformed payloads return a structured error", () => {
  const base = { slug: "x", guestKey: GUEST_KEY, votes: { s1: "yes" } };
  const cases: [string, unknown][] = [
    ["a non-string guestName", { ...base, guestName: 42 }],
    ["an object guestName", { ...base, guestName: { trim: 1 } }],
    ["a non-string guestKey", { ...base, guestName: "Sam", guestKey: 7 }],
    ["a non-string slug", { ...base, guestName: "Sam", slug: ["x"] }],
    ["an array votes", { ...base, guestName: "Sam", votes: ["yes"] }],
    ["a string votes", { ...base, guestName: "Sam", votes: "yes" }],
    ["a null payload", null],
  ];

  it.each(cases)("rejects %s without throwing", async (_label, payload) => {
    const res = await submitVote(payload as never);
    expect(res).toEqual({ ok: false, error: expect.any(String) });
    expect(pollFindUnique).not.toHaveBeenCalled();
    expect(saveBallotMock).not.toHaveBeenCalled();
  });

  it("rejects a non-string answer value", async () => {
    const res = await submitVote({
      slug: "x",
      guestName: "Sam",
      guestKey: GUEST_KEY,
      votes: { s1: { yes: true } as never },
    });
    expect(res.ok).toBe(false);
    expect(saveBallotMock).not.toHaveBeenCalled();
  });
});
