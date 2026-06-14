import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// In-memory Prisma fake. The current harness mocks the DB (Phase 11 adds the
// real-Postgres integration layer); this fake mirrors just enough participant /
// availability semantics that saveBallot relies on — the per-poll unique
// constraints, participant.upsert, availability.upsert, and the deleteMany
// `notIn` reconciliation (including its empty-ballot "delete all" edge).
const { prismaMock, store } = vi.hoisted(() => {
  interface FakeParticipant {
    id: string;
    pollId: string;
    userId: string | null;
    guestKey: string | null;
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
      pollId_guestKey?: { pollId: string; guestKey: string };
    };
    include?: { availabilities?: boolean };
  }) {
    let p: FakeParticipant | undefined;
    if (where.pollId_userId) {
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
      pollId_guestKey?: { pollId: string; guestKey: string };
    };
    create: {
      pollId: string;
      userId: string | null;
      guestKey: string | null;
      guestName: string | null;
    };
    update: Partial<FakeParticipant>;
  }) {
    let existing: FakeParticipant | undefined;
    if (where.pollId_userId) {
      const { pollId, userId } = where.pollId_userId;
      existing = store.participants.find(
        (x) => x.pollId === pollId && x.userId === userId,
      );
    } else if (where.pollId_guestKey) {
      const { pollId, guestKey } = where.pollId_guestKey;
      existing = store.participants.find(
        (x) => x.pollId === pollId && x.guestKey === guestKey,
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
      guestKey: create.guestKey ?? null,
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
    where: {
      participantId_timeOptionId: {
        participantId: string;
        timeOptionId: string;
      };
    };
    create: { participantId: string; timeOptionId: string; response: string };
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
    const a: FakeAvailability = {
      id: store.nextId("a"),
      participantId,
      timeOptionId,
      response: create.response,
    };
    store.availabilities.push(a);
    return a;
  }

  async function participantCount({ where }: { where: { pollId: string } }) {
    return store.participants.filter((p) => p.pollId === where.pollId).length;
  }

  const tx = {
    participant: {
      findUnique: participantFindUnique,
      upsert: participantUpsert,
      count: participantCount,
    },
    availability: {
      deleteMany: availabilityDeleteMany,
      upsert: availabilityUpsert,
    },
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

import {
  saveBallot,
  loadBallot,
  loadGuestRecord,
  ParticipantLimitError,
} from "@/lib/votes";

const POLL = "poll1";
const USER = { userId: "user1" };
// Guests key on guestKey (the per-browser identity); guestName is just a label.
const GUEST = { guestKey: "samkey1234567890abcde", guestName: "Sam" };

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

describe("saveBallot — guest identity (Phase 9 guestKey)", () => {
  it("two guests sharing a display name stay distinct (keyed on guestKey, not name)", async () => {
    // The pre-Phase-9 KNOWN LIMITATION, fixed: identity is the per-browser
    // guestKey, so two different people who both type "Sam" no longer collide.
    const personA = await saveBallot({
      pollId: POLL,
      identity: { guestKey: "browserAkey123456789a", guestName: "Sam" },
      ballot: { s1: "yes", s2: "yes" },
    });
    const personB = await saveBallot({
      pollId: POLL,
      identity: { guestKey: "browserBkey123456789b", guestName: "Sam" },
      ballot: { s1: "no" },
    });

    expect(personB.participantId).not.toBe(personA.participantId);
    expect(personB.isFirstCast).toBe(true);
    expect(store.participants).toHaveLength(2);
    // Person A's ballot is untouched by person B's submit.
    expect(responseFor(personA.participantId, "s1")).toBe("yes");
    expect(responseFor(personA.participantId, "s2")).toBe("yes");
    expect(responseFor(personB.participantId, "s1")).toBe("no");
  });

  it("a rename on resubmit updates the label on the SAME participant (no fork)", async () => {
    const first = await saveBallot({
      pollId: POLL,
      identity: GUEST,
      ballot: { s1: "yes" },
    });
    const renamed = await saveBallot({
      pollId: POLL,
      identity: { guestKey: GUEST.guestKey, guestName: "Samantha" },
      ballot: { s1: "yes" },
    });

    expect(renamed.participantId).toBe(first.participantId);
    expect(renamed.isFirstCast).toBe(false);
    expect(store.participants).toHaveLength(1);
    expect(store.participants[0].guestName).toBe("Samantha");
  });

  it("loadBallot by guestKey returns the guest's saved ballot", async () => {
    await saveBallot({
      pollId: POLL,
      identity: GUEST,
      ballot: { s1: "yes", s2: "maybe" },
    });

    expect(await loadBallot(POLL, { guestKey: GUEST.guestKey })).toEqual({
      s1: "yes",
      s2: "maybe",
    });
  });

  it("loadGuestRecord returns ballot + stored label; null for an unknown key", async () => {
    await saveBallot({
      pollId: POLL,
      identity: GUEST,
      ballot: { s1: "no" },
    });

    expect(await loadGuestRecord(POLL, GUEST.guestKey)).toEqual({
      ballot: { s1: "no" },
      guestName: "Sam",
    });
    expect(await loadGuestRecord(POLL, "someotherkey1234567890")).toBeNull();
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

describe("saveBallot — participant cap (Phase 10 maxParticipants)", () => {
  it("rejects a NEW participant once the poll is at the cap", async () => {
    await saveBallot({ pollId: POLL, identity: USER, ballot: { s1: "yes" } });
    await saveBallot({ pollId: POLL, identity: GUEST, ballot: { s1: "yes" } });

    await expect(
      saveBallot({
        pollId: POLL,
        identity: { guestKey: "thirdkey1234567890abc", guestName: "Riley" },
        ballot: { s1: "yes" },
        maxParticipants: 2,
      }),
    ).rejects.toThrow(ParticipantLimitError);
    expect(store.participants).toHaveLength(2);
  });

  it("never blocks an existing participant from editing their ballot", async () => {
    await saveBallot({ pollId: POLL, identity: USER, ballot: { s1: "yes" } });
    await saveBallot({ pollId: POLL, identity: GUEST, ballot: { s1: "yes" } });

    const update = await saveBallot({
      pollId: POLL,
      identity: GUEST,
      ballot: { s1: "no", s2: "maybe" },
      maxParticipants: 2,
    });

    expect(update.isFirstCast).toBe(false);
    expect(store.participants).toHaveLength(2);
  });

  it("only counts participants of the same poll against the cap", async () => {
    await saveBallot({
      pollId: "otherPoll",
      identity: USER,
      ballot: { s1: "yes" },
    });

    const result = await saveBallot({
      pollId: POLL,
      identity: GUEST,
      ballot: { s1: "yes" },
      maxParticipants: 1,
    });

    expect(result.isFirstCast).toBe(true);
  });

  it("is uncapped when maxParticipants is omitted (host creation-time ballot)", async () => {
    await saveBallot({ pollId: POLL, identity: USER, ballot: { s1: "yes" } });
    const guest = await saveBallot({
      pollId: POLL,
      identity: GUEST,
      ballot: { s1: "yes" },
    });
    expect(guest.isFirstCast).toBe(true);
  });
});
