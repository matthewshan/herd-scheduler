"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { CalendarPlus, Check, Clock, Pencil, Users } from "lucide-react";
import {
  AppBar,
  AvatarStack,
  Button,
  Pill,
  ShareButton,
  SlotCard,
  StackedBar,
  Tally,
  ThemeToggle,
  TzChip,
} from "@/components/ui";
import { recordVisit } from "@/lib/guest-history";
import { clearFinalization, finalizePoll } from "../finalize/actions";

// One slot's results, pre-formatted in the poll's zone server-side.
export interface ResultSlotView {
  id: string;
  /** e.g. "Fri, Jun 6". */
  date: string;
  /** e.g. "7:00 PM". */
  start: string;
  /** e.g. "10:00 PM". */
  end: string;
  yes: number;
  maybe: number;
  no: number;
  isBestFit: boolean;
  isFinal: boolean;
  worksForEveryone: boolean;
  canMakeItCount: number;
  /** yes+maybe voter names — `null` on anonymous polls (never rendered then). */
  attendees: string[] | null;
}

export interface ResultsViewProps {
  slug: string;
  title: string;
  hostFirstName: string;
  /** Full TzChip label, e.g. "Times shown in Eastern Time · ET". */
  tzLabel: string;
  respondedCount: number;
  anonymous: boolean;
  isHost: boolean;
  /** Poll still accepting votes — gates the "submit yours" link. */
  votingOpen: boolean;
  /** Viewer already submitted a ballot — switches the link to "edit yours". */
  viewerHasVoted: boolean;
  /** The finalized pick (for the banner), or null. */
  finalized: { date: string; start: string } | null;
  /** Slots, best-fit first. */
  slots: ResultSlotView[];
}

// The results screen (Phase 7): best-fit-sorted breakdown with a host-only
// finalize affordance. Anonymity is enforced server-side — `attendees` is null
// on anonymous polls, so no identity reaches this component to leak.
export function ResultsView({
  slug,
  title,
  hostFirstName,
  tzLabel,
  respondedCount,
  anonymous,
  isHost,
  votingOpen,
  viewerHasVoted,
  finalized,
  slots,
}: ResultsViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Remember this poll in the browser's "looked at" history for the guest home.
  useEffect(() => {
    recordVisit(slug, title);
  }, [slug, title]);

  const hasResponses = respondedCount > 0;

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (res.ok) {
        // Re-fetch the server-computed results so best-fit/finalized treatments
        // stay consistent rather than being recomputed on the client.
        router.refresh();
      } else {
        setError(res.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppBar
        title={title}
        // The host came from their dashboard, so home returns there; a guest
        // (no dashboard) goes back to the voting screen instead.
        homeHref={isHost ? "/" : undefined}
        backHref={isHost ? undefined : `/p/${slug}`}
        right={
          <>
            <ShareButton slug={slug} title={title} />
            <ThemeToggle />
          </>
        }
        hostLine={
          <>
            <span className="inline-flex items-center gap-1">
              <Users size={13} />
              {respondedCount} responded
            </span>
            <span>· Hosted by {hostFirstName}</span>
            <TzChip label={tzLabel} />
          </>
        }
      />

      <main className="mx-auto w-full max-w-[390px] flex-1 px-4 py-5">
        {finalized && (
          <div className="border-brand/25 mb-4 flex items-center gap-3 rounded-card border bg-brand-tint px-[14px] py-3">
            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand text-white">
              <Check size={18} />
            </span>
            <span className="font-body text-[13px] text-fg2">
              Finalized
              <br />
              <b className="tnum text-[15px] text-fg1">
                {finalized.date} · {finalized.start}
              </b>
            </span>
          </div>
        )}

        <div className="mb-2.5 flex items-center justify-between gap-2">
          <h2 className="ds-h2">
            {!hasResponses
              ? "No responses yet"
              : finalized
                ? "Final pick & other options"
                : "Sorted by best fit"}
          </h2>
          {/* Anyone viewing can vote in the poll — this is the way (back) to the
              vote screen (hidden once voting has ended). Reads "edit yours" once
              the viewer has submitted, "submit yours" before. */}
          {votingOpen && (
            <Link
              href={`/p/${slug}`}
              className="inline-flex flex-shrink-0 items-center gap-1.5 font-body text-[13px] font-semibold text-brand transition-colors duration-ds ease-ds hover:underline"
            >
              {viewerHasVoted ? (
                <Pencil size={14} />
              ) : (
                <CalendarPlus size={15} />
              )}
              {viewerHasVoted ? "Edit yours" : "Submit yours"}
            </Link>
          )}
        </div>

        {!hasResponses && (
          <p className="mb-4 font-body text-[14px] text-fg2">
            Share the link and the times will rank themselves as friends reply.
          </p>
        )}

        <div className="flex flex-col gap-2.5">
          {slots.map((s) => (
            <SlotCard
              key={s.id}
              day={s.date}
              time={`${s.start}–${s.end}`}
              best={s.isBestFit}
              finalized={s.isFinal}
              badge={
                s.isFinal ? (
                  <Pill variant="finalized" icon={<Check size={14} />}>
                    Finalized
                  </Pill>
                ) : s.isBestFit ? (
                  <Pill variant="best">★ Best fit</Pill>
                ) : undefined
              }
            >
              <div className="mt-3 flex flex-col gap-2.5">
                <StackedBar y={s.yes} m={s.maybe} n={s.no} />
                <Tally y={s.yes} m={s.maybe} n={s.no} />

                <div className="flex min-h-[28px] items-center gap-2.5">
                  {!anonymous && s.attendees && s.attendees.length > 0 && (
                    <AvatarStack names={s.attendees} size={28} max={5} />
                  )}
                  {s.worksForEveryone ? (
                    <Pill variant="all" icon={<Check size={13} />}>
                      Works for everyone
                    </Pill>
                  ) : (
                    <span className="font-body text-[12.5px] text-fg2">
                      {s.canMakeItCount > 0
                        ? `${s.canMakeItCount} can make it`
                        : "No one yet"}
                    </span>
                  )}
                </div>

                {isHost && !finalized && (
                  <Button
                    variant="outline"
                    size="sm"
                    block
                    disabled={isPending}
                    onClick={() => run(() => finalizePoll(slug, s.id))}
                  >
                    Finalize this time
                  </Button>
                )}
                {isHost && s.isFinal && (
                  <Button
                    variant="ghost"
                    size="sm"
                    block
                    disabled={isPending}
                    onClick={() => run(() => clearFinalization(slug))}
                  >
                    <Clock size={16} />
                    Change pick
                  </Button>
                )}
              </div>
            </SlotCard>
          ))}
        </div>

        {error && (
          <p className="border-no/30 mt-3 rounded-input border bg-no-tint px-3 py-2 font-body text-[13px] text-no-ink">
            {error}
          </p>
        )}

        <div className="h-2" />
      </main>
    </div>
  );
}
