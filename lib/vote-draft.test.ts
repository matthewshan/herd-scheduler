import { describe, expect, it } from "vitest";
import {
  clearVoteDrafts,
  parseVoteDraft,
  voteDraftKey,
} from "@/lib/vote-draft";

const SLOTS = new Set(["s1", "s2"]);

describe("parseVoteDraft", () => {
  it("returns null for a missing or corrupt draft", () => {
    expect(parseVoteDraft(null, SLOTS)).toBeNull();
    expect(parseVoteDraft("", SLOTS)).toBeNull();
    expect(parseVoteDraft("{not json", SLOTS)).toBeNull();
    expect(parseVoteDraft("42", SLOTS)).toBeNull();
  });

  it("keeps only answers for slots that still exist", () => {
    const raw = JSON.stringify({
      votes: { s1: "yes", gone1: "no", gone2: "maybe" },
      name: "Sam",
    });
    expect(parseVoteDraft(raw, SLOTS)).toEqual({
      votes: { s1: "yes" },
      name: "Sam",
    });
  });

  it("yields empty votes when no drafted slot survives (nothing to restore)", () => {
    const raw = JSON.stringify({ votes: { gone1: "yes", gone2: "no" } });
    expect(parseVoteDraft(raw, SLOTS)).toEqual({ votes: {}, name: undefined });
  });

  it("drops unknown answer values and a blank/non-string name", () => {
    const raw = JSON.stringify({
      votes: { s1: "definitely", s2: "maybe" },
      name: "   ",
    });
    expect(parseVoteDraft(raw, SLOTS)).toEqual({
      votes: { s2: "maybe" },
      name: undefined,
    });
    expect(
      parseVoteDraft(JSON.stringify({ votes: null, name: 7 }), SLOTS),
    ).toEqual({ votes: {}, name: undefined });
  });
});

describe("clearVoteDrafts", () => {
  it("removes every herd-vote:* draft and leaves other keys alone", () => {
    const map = new Map<string, string>([
      [voteDraftKey("a-poll"), "{}"],
      ["herd-guest-id", "k"],
      [voteDraftKey("b-poll"), "{}"],
      ["herd-theme", "dark"],
      [voteDraftKey("c-poll"), "{}"],
    ]);
    const storage = {
      get length() {
        return map.size;
      },
      key: (i: number) => [...map.keys()][i] ?? null,
      removeItem: (k: string) => void map.delete(k),
    };
    clearVoteDrafts(storage);
    expect([...map.keys()]).toEqual(["herd-guest-id", "herd-theme"]);
  });
});
