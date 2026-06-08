import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { isOwnerEmail } from "@/lib/access";
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
  // The host (creator or owner) gets a home button back to their dashboard.
  const isHost =
    user !== null &&
    (user.id === poll.createdById || isOwnerEmail(user.email));
  const closed = poll.status !== "open" || poll.finalTimeOptionId !== null;

  const slots = poll.timeOptions.map((opt) => {
    const s = formatSlotInZone(opt.startTime, opt.endTime, poll.timezone);
    return { id: opt.id, date: s.date, start: s.start, end: s.end };
  });

  // Signed-in voters get their saved ballot pre-filled; guests restore any
  // in-progress votes from a local draft on the client.
  const savedBallot = user ? await loadBallot(poll.id, { userId: user.id }) : {};
  const hasSavedBallot = Object.keys(savedBallot).length > 0;
  // The host is presumed available: with no ballot yet (and voting still open),
  // default every slot to "yes" so they just clear the times that don't work.
  const initialVotes =
    isHost && !hasSavedBallot && !closed
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
      isHost={isHost}
      userName={user?.name ?? null}
      initialVotes={initialVotes}
      hasSavedBallot={hasSavedBallot}
    />
  );
}
