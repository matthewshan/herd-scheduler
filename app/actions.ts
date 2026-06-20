"use server";

// Home-screen server actions (Phase 12). The guest home holds its visited-poll
// list in the browser (lib/guest-history); this fetches the public, aggregate
// summaries for those slugs so the cards can show live status. No auth and no
// identity — same trust level as the public /p/{slug}/results page.

import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { isValidGuestKey } from "@/lib/guest";
import { claimGuestParticipant } from "@/lib/votes";
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

/**
 * Adopt a guest's stranded participation into the signed-in account across a
 * batch of polls (spec §5). The per-poll claim (`claimGuestVotes` on the vote
 * screen) only fires when the inline sign-in returns a guest to that poll —
 * but a guest who signs in from the home screen lands on "/", never touching
 * the vote page, so their guest votes would stay stranded under the per-browser
 * `guestKey`. The signed-in home calls this on mount with that key and the
 * polls this browser has visited (the only slugs it knows the guest may have
 * voted on); each is claimed into the current account. Idempotent — a no-op for
 * polls already claimed or never voted on. Only ever acts for the current
 * session user. Returns how many polls had a guest row folded in, so the client
 * can refresh to surface them under "Joined".
 */
export async function claimGuestVotesForSlugs(
  slugs: string[],
  guestKey: string,
): Promise<{ ok: boolean; claimed: number }> {
  const user = await getSessionUser();
  if (!user) {
    return { ok: false, claimed: 0 }; // not signed in — nothing to claim into
  }
  if (!isValidGuestKey(guestKey) || !Array.isArray(slugs)) {
    return { ok: false, claimed: 0 };
  }
  const clean = slugs
    .filter((s): s is string => typeof s === "string" && SLUG_RE.test(s))
    .slice(0, MAX_SLUGS);
  if (clean.length === 0) {
    return { ok: true, claimed: 0 };
  }
  const polls = await prisma.poll.findMany({
    where: { slug: { in: clean } },
    select: { id: true },
  });
  let claimed = 0;
  for (const poll of polls) {
    const ballot = await claimGuestParticipant(poll.id, guestKey, user.id);
    if (ballot !== null) {
      claimed += 1;
    }
  }
  return { ok: true, claimed };
}
