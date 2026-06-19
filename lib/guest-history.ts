// Per-browser "polls you've looked at" history (Phase 12). A guest has no
// server-side home, so the polls they open are remembered client-side in
// localStorage — same browser-local model as the guest identity in lib/guest.ts.
// This is a display convenience only: it holds no identity and is never sent to
// the server except as plain slugs to fetch public summaries.

export const GUEST_HISTORY_STORAGE_KEY = "herd-visited-polls";

// Cap the list so a heavy browser session can't grow it unbounded. Newest first.
const MAX_VISITS = 25;

export interface VisitedPoll {
  slug: string;
  /** Title captured at visit time — shown immediately before the live fetch. */
  title: string;
  /** Epoch ms of the most recent visit. */
  viewedAt: number;
}

function isVisited(value: unknown): value is VisitedPoll {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const v = value as Record<string, unknown>;
  return (
    typeof v.slug === "string" &&
    typeof v.title === "string" &&
    typeof v.viewedAt === "number"
  );
}

/** Read the visited-poll list, newest first. Tolerant of corrupt storage. */
export function loadVisits(): VisitedPoll[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = localStorage.getItem(GUEST_HISTORY_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isVisited);
  } catch {
    return [];
  }
}

function save(visits: VisitedPoll[]): void {
  try {
    localStorage.setItem(GUEST_HISTORY_STORAGE_KEY, JSON.stringify(visits));
  } catch {
    // best-effort — storage blocked/full
  }
}

/**
 * Record (or refresh) a poll the user just opened: move it to the front with the
 * current timestamp and the latest title, deduped by slug, capped at MAX_VISITS.
 */
export function recordVisit(slug: string, title: string): void {
  if (typeof window === "undefined") {
    return;
  }
  const rest = loadVisits().filter((v) => v.slug !== slug);
  const next: VisitedPoll[] = [
    { slug, title, viewedAt: Date.now() },
    ...rest,
  ].slice(0, MAX_VISITS);
  save(next);
}

/** Drop a poll from history (e.g. it was deleted, or the user removed it). */
export function removeVisit(slug: string): void {
  if (typeof window === "undefined") {
    return;
  }
  save(loadVisits().filter((v) => v.slug !== slug));
}
