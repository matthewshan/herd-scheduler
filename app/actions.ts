"use server";

// Home-screen server actions (Phase 12). The guest home holds its visited-poll
// list in the browser (lib/guest-history); this fetches the public, aggregate
// summaries for those slugs so the cards can show live status. No auth and no
// identity — same trust level as the public /p/{slug}/results page.

import { listPollSummariesBySlug, type PublicPollSummary } from "@/lib/polls";

// Guard rails for the untrusted slug list off the client: a sane upper bound
// (the history cap is 25) and a basic slug-shape filter.
const MAX_SLUGS = 50;
const SLUG_RE = /^[a-z0-9-]{1,80}$/;

export async function loadVisitedPollSummaries(
  slugs: string[],
): Promise<PublicPollSummary[]> {
  if (!Array.isArray(slugs)) {
    return [];
  }
  const clean = slugs
    .filter((s): s is string => typeof s === "string" && SLUG_RE.test(s))
    .slice(0, MAX_SLUGS);
  return listPollSummariesBySlug(clean);
}
