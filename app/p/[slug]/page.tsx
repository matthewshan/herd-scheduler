import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { formatSlotInZone, tzChipLabel } from "@/lib/time";
import { loadBallot } from "@/lib/votes";
import { VoteForm } from "./VoteForm";

interface VotePageProps {
  params: Promise<{ slug: string }>;
}

// First name only — the voice refers to the host by first name (design guide).
function firstName(name: string | null, email: string): string {
  if (name?.trim()) {
    return name.trim().split(/\s+/)[0];
  }
  return email.split("@")[0];
}

// The vote screen (Phase 6): anyone with the link marks availability per slot
// and submits — as a guest or signed in. Times are formatted in the poll's zone
// server-side so the client never sees UTC.
export default async function VotePage({ params }: VotePageProps) {
  const { slug } = await params;

  const poll = await prisma.poll.findUnique({
    where: { slug },
    include: {
      createdBy: { select: { name: true, email: true } },
      timeOptions: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!poll) {
    notFound();
  }

  const user = await getSessionUser();
  // Only the creator proposed these times, so only they get the presumed-
  // available prefill (the owner viewing someone else's poll must not).
  const isCreator = user !== null && user.id === poll.createdById;
  const closed = poll.status !== "open" || poll.finalTimeOptionId !== null;

  const slots = poll.timeOptions.map((opt) => {
    const s = formatSlotInZone(opt.startTime, opt.endTime, poll.timezone);
    return { id: opt.id, date: s.date, start: s.start, end: s.end };
  });

  // Signed-in voters get their saved ballot pre-filled; guests restore any
  // in-progress votes from a local draft on the client.
  const savedBallot = user
    ? await loadBallot(poll.id, { userId: user.id })
    : {};
  const hasSavedBallot = Object.keys(savedBallot).length > 0;
  // The creator is presumed available: with no ballot yet (and voting still
  // open), default every slot to "yes" so they just clear the times that don't
  // work. This is a fallback — createPoll persists this ballot at creation —
  // and it must never reach the owner viewing someone else's poll.
  const initialVotes =
    isCreator && !hasSavedBallot && !closed
      ? Object.fromEntries(slots.map((s) => [s.id, "yes" as const]))
      : savedBallot;

  return (
    <VoteForm
      slug={poll.slug}
      title={poll.title}
      hostFirstName={firstName(poll.createdBy.name, poll.createdBy.email)}
      description={poll.description}
      location={poll.location}
      tzLabel={tzChipLabel(poll.timezone)}
      closed={closed}
      slots={slots}
      isLoggedIn={user !== null}
      userName={user?.name ?? null}
      userImage={user?.image ?? null}
      initialVotes={initialVotes}
      hasSavedBallot={hasSavedBallot}
    />
  );
}
