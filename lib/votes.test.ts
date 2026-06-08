import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// In-memory Prisma fake. The current harness mocks the DB (Phase 9 adds the
// real-Postgres integration layer); this fake mirrors just enough participant /
// availability semantics that saveBallot relies on — the per-poll unique
// constraints, participant.upsert, availability.upsert, and the deleteMany
// `notIn` reconciliation (including its empty-ballot "delete all" edge).
const { prismaMock, store } = vi.hoisted(() => {
  interface FakeParticipant {
    id: string;
    pollId: string;
    userId: string | null;
    guestName: string | null;
  }
  interface FakeAvailability {
    id: string;
    participantId: string;
    timeOptionId: string;
    response: string;
  }

  const store = {
    participants: [] as FakeParticipant[],
    availabilities: [] as FakeAvailability[],
    seq: 0,
    reset() {
      this.participants = [];
      this.availabilities = [];
      this.seq = 0;
    },
    nextId(prefix: string) {
      this.seq += 1;
      return `${prefix}${this.seq}`;
    },
  };

  // findUnique by either compound key; honors `include: { availabilities }`.
  // Postgres treats NULLs as distinct, so a user-key lookup never matches a
  // guest row (userId null) and vice versa — the equality checks below mirror
  // that because the looked-up component is always non-null.
  async function participantFindUnique({
    where,
    include,
  }: {
    where: {
      pollId_userId?: { pollId: string; userId: string };
      pollId_guestName?: { pollId: string; guestName: string };
    };
    include?: { availabilities?: boolean };
  }) {
    let p: FakeParticipant | undefined;
    if (where.pollId_userId) {
      const { pollId, userId } = where.pollId_userId;
      p = store.participants.find(
        (x) => x.pollId === pollId && x.userId === userId,
      );
    } else if (where.pollId_guestName) {
      const { pollId, guestName } = where.pollId_guestName;
      p = store.participants.find(
        (x) => x.pollId === pollId && x.guestName === guestName,
      );
    }
    if (!p) {
      return null;
    }
    if (include?.availabilities) {
      return {
        ...p,
        availabilities: store.availabilities.filter(
          (a) => a.participantId === p!.id,
        ),
      };
    }
    return p;
  }

  // Atomic: the find + create runs as one synchronous critical section (no
  // internal await), mirroring the DB's atomic upsert. If it awaited a separate
  // find, two racing first casts could both read null and both create — exactly
  // the P2002 the real upsert prevents.
  async function participantUpsert({
    where,
    create,
    update,
  }: {
    where: {
      pollId_userId?: { pollId: string; userId: string };
      pollId_guestName?: { pollId: string; guestName: string };
    };
    create: { pollId: string; userId: string | null; guestName: string | null };
    update: Partial<FakeParticipant>;
  }) {
    let existing: FakeParticipant | undefined;
    if (where.pollId_userId) {
      const { pollId, userId } = where.pollId_userId;
      existing = store.participants.find(
        (x) => x.pollId === pollId && x.userId === userId,
      );
    } else if (where.pollId_guestName) {
      const { pollId, guestName } = where.pollId_guestName;
      existing = store.participants.find(
        (x) => x.pollId === pollId && x.guestName === guestName,
      );
    }
    if (existing) {
      Object.assign(existing, update);
      return existing;
    }
    const p: FakeParticipant = {
      id: store.nextId("p"),
      pollId: create.pollId,
      userId: create.userId ?? null,
      guestName: create.guestName ?? null,
    };
    store.participants.push(p);
    return p;
  }

  async function availabilityDeleteMany({
    where,
  }: {
    where: { participantId: string; timeOptionId?: { notIn: string[] } };
  }) {
    const { participantId } = where;
    const notIn = where.timeOptionId?.notIn;
    const before = store.availabilities.length;
    store.availabilities = store.availabilities.filter((a) => {
      if (a.participantId !== participantId) {
        return true;
      }
      // No `notIn` guard (empty ballot) ⇒ delete every row for the participant.
      return notIn ? notIn.includes(a.timeOptionId) : false;
    });
    return { count: before - store.availabilities.length };
  }

  async function availabilityUpsert({
    where,
    create,
    update,
  }: {
    where: { participantId_timeOptionId: { participantId: string; timeOptionId: string } };
    create: { participantId: string; timeOptionId: string; response: string };
    update: { response: string };
  }) {
    const { participantId, timeOptionId } = where.participantId_timeOptionId;
    const existing = store.availabilities.find(
      (a) => a.participantId === participantId && a.timeOptionId === timeOptionId,
    );
    if (existing) {
      existing.response = update.response;
      return existing;
    }
    const a: FakeAvailability = {
      id: store.nextId("a"),
      participantId,
      timeOptionId,
      response: create.response,
    };
    store.availabilities.push(a);
    return a;
  }

  const tx = {
    participant: { findUnique: participantFindUnique, upsert: participantUpsert },
    availability: { deleteMany: availabilityDeleteMany, upsert: availabilityUpsert },
  };

  const prismaMock = {
    participant: { findUnique: participantFindUnique },
    // One shared `tx` — fine because the fake has no isolation; the race test
    // relies on both transactions seeing the same store.
    $transaction: async (cb: (t: typeof tx) => unknown) => cb(tx),
  };

  return { prismaMock, store };
});

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { saveBallot, loadBallot } from "@/lib/votes";

const POLL = "poll1";
const USER = { userId: "user1" };
const GUEST = { guestName: "Sam" };

// Pull the stored Prisma response for a (participant, slot) pair.
function responseFor(participantId: string, timeOptionId: string) {
  return store.availabilities.find(
    (a) => a.participantId === participantId && a.timeOptionId === timeOptionId,
  )?.response;
}

function rowsFor(participantId: string) {
  return store.availabilities.filter((a) => a.participantId === participantId);
}

beforeEach(() => {
  store.reset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("saveBallot — participant reuse", () => {
  it("reuses the same participant on resubmit (no duplicate rows) for a user", async () => {
    const first = await saveBallot({
      pollId: POLL,
      identity: USER,
      ballot: { s1: "yes" },
    });
    const second = await saveBallot({
      pollId: POLL,
      identity: USER,
      ballot: { s1: "no", s2: "maybe" },
    });

    expect(first.participantId).toBe(second.participantId);
    expect(store.participants).toHaveLength(1);
    expect(first.isFirstCast).toBe(true);
    expect(second.isFirstCast).toBe(false);
  });

  it("reuses the same participant on resubmit for a guest", async () => {
    const first = await saveBallot({
      pollId: POLL,
      identity: GUEST,
      ballot: { s1: "yes" },
    });
    const second = await saveBallot({
      pollId: POLL,
      identity: GUEST,
      ballot: { s1: "yes" },
    });

    expect(first.participantId).toBe(second.participantId);
    expect(store.participants).toHaveLength(1);
  });
});

describe("saveBallot — availability reconciliation", () => {
  it("maps UI values to the Response enum (yes/maybe/no → yes/ifneedbe/no)", async () => {
    const { participantId } = await saveBallot({
      pollId: POLL,
      identity: USER,
      ballot: { s1: "yes", s2: "maybe", s3: "no" },
    });

    expect(responseFor(participantId, "s1")).toBe("yes");
    expect(responseFor(participantId, "s2")).toBe("ifneedbe");
    expect(responseFor(participantId, "s3")).toBe("no");
  });

  it("deletes the row for a slot dropped on resubmit (tap-to-clear)", async () => {
    const { participantId } = await saveBallot({
      pollId: POLL,
      identity: USER,
      ballot: { s1: "yes", s2: "no" },
    });
    expect(rowsFor(participantId)).toHaveLength(2);

    // Resubmit without s2 → its row is reconciled away; s1 updates in place.
    await saveBallot({ pollId: POLL, identity: USER, ballot: { s1: "maybe" } });

    expect(rowsFor(participantId)).toHaveLength(1);
    expect(responseFor(participantId, "s1")).toBe("ifneedbe");
    expect(responseFor(participantId, "s2")).toBeUndefined();
  });

  it("an empty ballot deletes ALL of the participant's rows (item-3 behavior)", async () => {
    // This intentionally locks in saveBallot's documented edge: a blank ballot
    // wipes every row. Callers guard against this upstream (submitVote rejects
    // empty ballots); saveBallot itself does not.
    const { participantId } = await saveBallot({
      pollId: POLL,
      identity: USER,
      ballot: { s1: "yes", s2: "no", s3: "maybe" },
    });
    expect(rowsFor(participantId)).toHaveLength(3);

    await saveBallot({ pollId: POLL, identity: USER, ballot: {} });

    expect(rowsFor(participantId)).toHaveLength(0);
  });
});

describe("loadBallot", () => {
  it("returns {} for a voter who hasn't voted", async () => {
    expect(await loadBallot(POLL, USER)).toEqual({});
  });

  it("round-trips a saved ballot back to UI values", async () => {
    await saveBallot({
      pollId: POLL,
      identity: USER,
      ballot: { s1: "yes", s2: "maybe", s3: "no" },
    });

    expect(await loadBallot(POLL, USER)).toEqual({
      s1: "yes",
      s2: "maybe",
      s3: "no",
    });
  });
});

describe("saveBallot — guest name collision (KNOWN LIMITATION)", () => {
  it("two guests sharing a name collide on one participant; the later submit overwrites", async () => {
    // KNOWN LIMITATION — guests key on pollId_guestName, so two different people
    // who type "Sam" are indistinguishable. Documented in the spec §11 open
    // questions; the eventual guest-cookie-token fix should flip this test.
    const personA = await saveBallot({
      pollId: POLL,
      identity: { guestName: "Sam" },
      ballot: { s1: "yes", s2: "yes" },
    });
    const personB = await saveBallot({
      pollId: POLL,
      identity: { guestName: "Sam" },
      ballot: { s1: "no" },
    });

    expect(personB.participantId).toBe(personA.participantId);
    expect(personB.isFirstCast).toBe(false);
    expect(store.participants).toHaveLength(1);
    // Person A's ballot is gone — s1 overwritten, s2 reconciled away.
    expect(responseFor(personA.participantId, "s1")).toBe("no");
    expect(responseFor(personA.participantId, "s2")).toBeUndefined();
  });
});

describe("saveBallot — concurrent first submit (item-2 upsert)", () => {
  it("two near-simultaneous first casts resolve to one participant without throwing", async () => {
    // Both transactions pre-read null (empty store) then upsert; the upsert (not
    // a bare create) makes the loser a no-op update instead of a P2002 throw.
    const [a, b] = await Promise.all([
      saveBallot({ pollId: POLL, identity: USER, ballot: { s1: "yes" } }),
      saveBallot({ pollId: POLL, identity: USER, ballot: { s2: "no" } }),
    ]);

    expect(a.participantId).toBe(b.participantId);
    expect(store.participants).toHaveLength(1);
  });

  it("resubmit on an existing participant takes the upsert no-op-update path", async () => {
    // Sequential proxy for the same code path: the second call's upsert hits an
    // existing row and updates (here, a no-op) rather than creating.
    const first = await saveBallot({
      pollId: POLL,
      identity: USER,
      ballot: { s1: "yes" },
    });
    const second = await saveBallot({
      pollId: POLL,
      identity: USER,
      ballot: { s1: "yes" },
    });

    expect(second.participantId).toBe(first.participantId);
    expect(second.isFirstCast).toBe(false);
    expect(store.participants).toHaveLength(1);
  });
});
