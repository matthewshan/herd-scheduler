import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { isOwnerEmail } from "@/lib/access";
import { getResultsForSlug } from "@/lib/results";
import { loadBallot } from "@/lib/votes";
import { formatSlotInZone, tzChipLabel } from "@/lib/time";
import { ResultsView, type ResultSlotView } from "./ResultsView";

interface ResultsPageProps {
  params: Promise<{ slug: string }>;
}

// First name only — the voice refers to the host by first name (design guide).
function firstName(name: string | null, email: string): string {
  if (name?.trim()) {
    return name.trim().split(/\s+/)[0];
  }
  return email.split("@")[0];
}

// The results screen (Phase 7): best-fit-sorted breakdown that anyone with the
// link can see, with a host-only finalize. Times are formatted in the poll's
// zone server-side; anonymity is enforced in lib/results before data gets here.
export default async function ResultsPage({ params }: ResultsPageProps) {
  const { slug } = await params;

  const data = await getResultsForSlug(slug);
  if (!data) {
    notFound();
  }
  const { poll, results } = data;

  const user = await getSessionUser();
  const isHost =
    user !== null &&
    (user.id === poll.createdById || isOwnerEmail(user.email));
  // Only the host's link cares whether they've voted; skip the query otherwise.
  const hostHasVoted = isHost
    ? Object.keys(await loadBallot(poll.id, { userId: user!.id })).length > 0
    : false;

  const slots: ResultSlotView[] = results.slots.map((s) => {
    const d = formatSlotInZone(s.startTime, s.endTime, poll.timezone);
    return {
      id: s.id,
      date: d.date,
      start: d.start,
      end: d.end,
      yes: s.yes,
      maybe: s.maybe,
      no: s.no,
      isBestFit: s.isBestFit,
      isFinal: s.isFinal,
      worksForEveryone: s.worksForEveryone,
      canMakeItCount: s.canMakeItCount,
      attendees: s.attendees,
    };
  });

  let finalized: { date: string; start: string } | null = null;
  if (results.finalTimeOptionId && results.leadSlot) {
    const f = formatSlotInZone(
      results.leadSlot.startTime,
      results.leadSlot.endTime,
      poll.timezone,
    );
    finalized = { date: f.date, start: f.start };
  }

  return (
    <ResultsView
      slug={poll.slug}
      title={poll.title}
      hostFirstName={firstName(poll.createdBy.name, poll.createdBy.email)}
      tzLabel={tzChipLabel(poll.timezone)}
      respondedCount={results.respondedCount}
      anonymous={results.anonymous}
      isHost={isHost}
      votingOpen={poll.status === "open" && poll.finalTimeOptionId === null}
      hostHasVoted={hostHasVoted}
      finalized={finalized}
      slots={slots}
    />
  );
}
