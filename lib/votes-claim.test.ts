import { beforeEach, describe, expect, it, vi } from "vitest";

// claimGuestParticipant (guest → account claiming) against a small in-memory
// Prisma fake. Kept separate from lib/votes.test.ts (saveBallot) so each suite's
// fake only models what its code path touches: participant lookups by either
// compound key, the key-guarded updateMany/deleteMany, and availability upsert.
const { prismaMock, store } = vi.hoisted(() => {
  interface FakeParticipant {
    id: string;
    pollId: string;
    userId: string | null;
    guestKey: string | null;
    guestName: string | null;
  }
  interface FakeAvailability {
    participantId: string;
    timeOptionId: string;
    response: string;
  }
  interface ParticipantWhere {
    id: string;
    guestKey?: string | null;
  }

  const store = {
    participants: [] as FakeParticipant[],
    availabilities: [] as FakeAvailability[],
    /** Test hook: runs just before the account-row lookup (simulates a race). */
    beforeUserLookup: null as null | (() => void),
    /** Test hook: runs at the start of the relabel (may throw, e.g. P2002). */
    beforeRelabel: null as null | (() => void),
    reset() {
      this.participants = [];
      this.availabilities = [];
      this.beforeUserLookup = null;
      this.beforeRelabel = null;
    },
  };

  const matches = (p: FakeParticipant, where: ParticipantWhere) =>
    p.id === where.id &&
    (where.guestKey === undefined || p.guestKey === where.guestKey);

  async function findUnique({
    where,
    include,
  }: {
    where: {
      pollId_userId?: { pollId: string; userId: string };
      pollId_guestKey?: { pollId: string; guestKey: string };
    };
    include?: { availabilities?: boolean };
  }) {
    let p: FakeParticipant | undefined;
    if (where.pollId_userId) {
      store.beforeUserLookup?.();
      const { pollId, userId } = where.pollId_userId;
      p = store.participants.find(
        (x) => x.pollId === pollId && x.userId === userId,
      );
    } else if (where.pollId_guestKey) {
      const { pollId, guestKey } = where.pollId_guestKey;
      p = store.participants.find(
        (x) => x.pollId === pollId && x.guestKey === guestKey,
      );
    }
    if (!p) {
      return null;
    }
    const row = { ...p };
    return include?.availabilities
      ? {
          ...row,
          availabilities: store.availabilities
            .filter((a) => a.participantId === p!.id)
            .map((a) => ({ ...a })),
        }
      : row;
  }

  async function updateMany({
    where,
    data,
  }: {
    where: ParticipantWhere;
    data: Partial<FakeParticipant>;
  }) {
    store.beforeRelabel?.();
    const hits = store.participants.filter((p) => matches(p, where));
    for (const p of hits) {
      if (
        data.userId &&
        store.participants.some(
          (x) => x !== p && x.pollId === p.pollId && x.userId === data.userId,
        )
      ) {
        throw Object.assign(new Error("Unique constraint"), { code: "P2002" });
      }
      Object.assign(p, data);
    }
    return { count: hits.length };
  }

  async function deleteMany({ where }: { where: ParticipantWhere }) {
    const gone = store.participants.filter((p) => matches(p, where));
    const ids = new Set(gone.map((p) => p.id));
    store.participants = store.participants.filter((p) => !ids.has(p.id));
    store.availabilities = store.availabilities.filter(
      (a) => !ids.has(a.participantId), // cascade
    );
    return { count: gone.length };
  }

  async function availabilityUpsert({
    where,
    create,
    update,
  }: {
    where: {
      participantId_timeOptionId: {
        participantId: string;
        timeOptionId: string;
      };
    };
    create: FakeAvailability;
    update: { response: string };
  }) {
    const { participantId, timeOptionId } = where.participantId_timeOptionId;
    const existing = store.availabilities.find(
      (a) =>
        a.participantId === participantId && a.timeOptionId === timeOptionId,
    );
    if (existing) {
      existing.response = update.response;
      return existing;
    }
    store.availabilities.push({ ...create });
    return create;
  }

  const tx = {
    participant: { findUnique, updateMany, deleteMany },
    availability: { upsert: availabilityUpsert },
  };
  const prismaMock = {
    $transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
  };
  return { prismaMock, store };
});

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { claimGuestParticipant, isPollAcceptingVotes } from "@/lib/votes";

const POLL = "poll1";
const USER = "user1";
const KEY = "alicekey1234567890abc";

// `answers` uses the stored Prisma Response values (yes / ifneedbe / no).
function addParticipant(
  id: string,
  who: { userId?: string; guestKey?: string; guestName?: string },
  answers: Record<string, string>,
) {
  store.participants.push({
    id,
    pollId: POLL,
    userId: who.userId ?? null,
    guestKey: who.guestKey ?? null,
    guestName: who.guestName ?? null,
  });
  for (const [timeOptionId, response] of Object.entries(answers)) {
    store.availabilities.push({ participantId: id, timeOptionId, response });
  }
}

beforeEach(() => {
  store.reset();
  prismaMock.$transaction.mockClear();
});

describe("isPollAcceptingVotes", () => {
  it("is true only for an open, un-finalized poll", () => {
    expect(
      isPollAcceptingVotes({ status: "open", finalTimeOptionId: null }),
    ).toBe(true);
    expect(
      isPollAcceptingVotes({ status: "closed", finalTimeOptionId: null }),
    ).toBe(false);
    // Finalized is derived from finalTimeOptionId, even if status is "open".
    expect(
      isPollAcceptingVotes({ status: "open", finalTimeOptionId: "s1" }),
    ).toBe(false);
  });
});

describe("claimGuestParticipant", () => {
  it("returns null when the key has no participant here (nothing to claim)", async () => {
    expect(await claimGuestParticipant(POLL, KEY, USER)).toBeNull();
  });

  it("relabels the guest row in place when the account has no row yet", async () => {
    addParticipant("g1", { guestKey: KEY, guestName: "Alice" }, { s1: "yes" });
    const ballot = await claimGuestParticipant(POLL, KEY, USER);
    expect(ballot).toEqual({ s1: "yes" });
    expect(store.participants).toEqual([
      {
        id: "g1",
        pollId: POLL,
        userId: USER,
        guestKey: null,
        guestName: null,
      },
    ]);
  });

  it("merges into the account's row (guest wins per slot) and drops the guest row", async () => {
    addParticipant("u1", { userId: USER }, { s1: "no", s2: "yes" });
    addParticipant("g1", { guestKey: KEY, guestName: "Alice" }, { s1: "yes" });
    const ballot = await claimGuestParticipant(POLL, KEY, USER);
    expect(ballot).toEqual({ s1: "yes", s2: "yes" });
    expect(store.participants.map((p) => p.id)).toEqual(["u1"]);
  });

  it("is idempotent — a second claim is a no-op", async () => {
    addParticipant("g1", { guestKey: KEY }, { s1: "ifneedbe" });
    await claimGuestParticipant(POLL, KEY, USER);
    expect(await claimGuestParticipant(POLL, KEY, USER)).toBeNull();
    expect(store.participants).toHaveLength(1);
  });

  it("two concurrent merge claims don't throw (loser's delete is a no-op, not P2025)", async () => {
    addParticipant("u1", { userId: USER }, { s2: "no" });
    addParticipant("g1", { guestKey: KEY }, { s1: "yes" });
    const [a, b] = await Promise.all([
      claimGuestParticipant(POLL, KEY, USER),
      claimGuestParticipant(POLL, KEY, USER),
    ]);
    expect(a).toEqual({ s1: "yes", s2: "no" });
    expect(b).toEqual({ s1: "yes", s2: "no" });
    expect(store.participants.map((p) => p.id)).toEqual(["u1"]);
  });

  it("two concurrent relabel claims don't throw and leave one account row", async () => {
    addParticipant("g1", { guestKey: KEY }, { s1: "yes" });
    const results = await Promise.all([
      claimGuestParticipant(POLL, KEY, USER),
      claimGuestParticipant(POLL, KEY, USER),
    ]);
    for (const r of results) {
      expect(r).toEqual({ s1: "yes" });
    }
    expect(store.participants).toHaveLength(1);
    expect(store.participants[0].userId).toBe(USER);
  });

  it("a row relabelled between the two reads is left alone (not deleted as 'the guest')", async () => {
    addParticipant("g1", { guestKey: KEY }, { s1: "yes" });
    store.beforeUserLookup = () => {
      // A concurrent claim relabels the guest row right before our account lookup.
      Object.assign(store.participants[0], {
        userId: USER,
        guestKey: null,
        guestName: null,
      });
      store.beforeUserLookup = null;
    };
    const ballot = await claimGuestParticipant(POLL, KEY, USER);
    expect(ballot).toEqual({ s1: "yes" });
    expect(store.participants.map((p) => p.id)).toEqual(["g1"]);
  });

  it("retries once on P2002 (account row created mid-claim) and takes the merge path", async () => {
    addParticipant("g1", { guestKey: KEY }, { s1: "yes" });
    store.beforeRelabel = () => {
      // The account's own row appears between our lookup and the relabel.
      addParticipant("u1", { userId: USER }, { s2: "ifneedbe" });
      store.beforeRelabel = null;
    };
    const ballot = await claimGuestParticipant(POLL, KEY, USER);
    expect(ballot).toEqual({ s1: "yes", s2: "maybe" });
    expect(store.participants.map((p) => p.id)).toEqual(["u1"]);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(2);
  });

  it("rethrows errors other than a unique violation", async () => {
    addParticipant("g1", { guestKey: KEY }, { s1: "yes" });
    store.beforeRelabel = () => {
      throw new Error("connection lost");
    };
    await expect(claimGuestParticipant(POLL, KEY, USER)).rejects.toThrow(
      "connection lost",
    );
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });
});
