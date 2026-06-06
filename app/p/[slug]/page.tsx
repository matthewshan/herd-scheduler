import { notFound } from "next/navigation";
import { MapPin } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { AppBar, ThemeToggle, TzChip } from "@/components/ui";
import { formatSlotInZone, tzChipLabel } from "@/lib/time";

interface VotePageProps {
  params: Promise<{ slug: string }>;
}

// First name only — the voice refers to the host by first name (design guide).
function firstName(name: string | null, email: string): string {
  if (name?.trim()) return name.trim().split(/\s+/)[0];
  return email.split("@")[0];
}

// Phase 5 placeholder: the slug resolves to a real, shareable page that lists
// the poll's times in its timezone. Phase 6 replaces this with the vote UI
// (Segmented controls + submit).
export default async function VotePage({ params }: VotePageProps) {
  const { slug } = await params;

  const poll = await prisma.poll.findUnique({
    where: { slug },
    include: {
      createdBy: { select: { name: true, email: true } },
      timeOptions: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!poll) notFound();

  const host = firstName(poll.createdBy.name, poll.createdBy.email);

  return (
    <div className="flex min-h-screen flex-col">
      <AppBar
        title={poll.title}
        right={<ThemeToggle />}
        hostLine={
          <>
            <span>{host} wants to find a time</span>
            <TzChip label={tzChipLabel(poll.timezone)} />
          </>
        }
      />

      <main className="mx-auto w-full max-w-[390px] flex-1 px-4 py-5">
        {poll.description && (
          <p className="mb-3 font-body text-[14px] text-fg2">
            {poll.description}
          </p>
        )}
        {poll.location && (
          <p className="mb-4 flex items-center gap-1.5 font-body text-[13px] text-fg2">
            <MapPin size={14} />
            {poll.location}
          </p>
        )}

        <div className="flex flex-col gap-2">
          {poll.timeOptions.map((opt) => {
            const s = formatSlotInZone(
              opt.startTime,
              opt.endTime,
              poll.timezone,
            );
            return (
              <div
                key={opt.id}
                className="flex items-center gap-3 rounded-card border border-border bg-surface px-[14px] py-3"
              >
                <span className="font-body text-[14px] font-medium text-fg1">
                  {s.date}
                </span>
                <span className="tnum flex-1 font-body text-[13.5px] text-fg2">
                  {s.start}–{s.end}
                </span>
              </div>
            );
          })}
        </div>

        <p className="mt-6 text-center font-body text-[12.5px] text-fg3">
          Voting opens here soon.
        </p>
      </main>
    </div>
  );
}
