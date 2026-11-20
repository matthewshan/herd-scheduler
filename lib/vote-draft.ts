// In-progress vote drafts (Phase 6). The vote screen keeps the voter's unsaved
// work in localStorage under `herd-vote:{slug}` so it survives the inline
// sign-in OAuth round-trip and accidental refreshes. Client-safe module.

import type { VoteValue } from "@/components/ui";

/** localStorage key prefix for per-poll vote drafts. */
export const VOTE_DRAFT_PREFIX = "herd-vote:";

export function voteDraftKey(slug: string): string {
  return `${VOTE_DRAFT_PREFIX}${slug}`;
}

export interface VoteDraft {
  votes: Record<string, VoteValue>;
  name?: string;
}

const VOTE_VALUES = new Set<string>(["yes", "maybe", "no"]);

/**
 * Parse a stored draft, keeping only answers for slots that still exist on the
 * poll (a slot can be removed after the draft was saved) and only known answer
 * values. Returns `null` for a missing/corrupt draft. `votes` may come back
 * empty — callers treat that as "no draft votes to restore".
 */
export function parseVoteDraft(
  raw: string | null,
  slotIds: ReadonlySet<string>,
): VoteDraft | null {
  if (!raw) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") {
    return null;
  }
  const { votes: rawVotes, name: rawName } = parsed as Record<string, unknown>;
  const votes: Record<string, VoteValue> = {};
  if (rawVotes && typeof rawVotes === "object") {
    for (const [id, value] of Object.entries(rawVotes)) {
      if (
        slotIds.has(id) &&
        typeof value === "string" &&
        VOTE_VALUES.has(value)
      ) {
        votes[id] = value as VoteValue;
      }
    }
  }
  const name =
    typeof rawName === "string" && rawName.trim() ? rawName : undefined;
  return { votes, name };
}

/** Remove every per-poll vote draft in this browser (all `herd-vote:*` keys). */
export function clearVoteDrafts(
  storage: Pick<Storage, "key" | "length" | "removeItem">,
): void {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key?.startsWith(VOTE_DRAFT_PREFIX)) {
      keys.push(key);
    }
  }
  // Collect first, then remove — removing while iterating shifts the indices.
  for (const key of keys) {
    storage.removeItem(key);
  }
}
