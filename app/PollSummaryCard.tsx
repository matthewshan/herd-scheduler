"use client";

import Link from "next/link";
import { Cat, Check, Clock } from "lucide-react";
import { StatusPill } from "@/components/ui";
import type { PublicPollSummary } from "@/lib/polls";

interface BrandMarkProps {
  size?: number;
  /** Diameter of the rounded square. */
  box?: number;
  radius?: string;
}

// The brand mark — the real lucide Cat glyph in a brand-tint rounded square
// (the prototype's 🐱 emoji is a throwaway placeholder). Shared across the home
// screens.
export function BrandMark({
  size = 20,
  box = 34,
  radius = "rounded-[10px]",
}: BrandMarkProps) {
  return (
    <span
      className={`flex flex-shrink-0 items-center justify-center bg-brand-tint text-brand ${radius}`}
      style={{ width: box, height: box }}
      role="img"
      aria-label="Herd Scheduler"
    >
      <Cat size={size} />
    </span>
  );
}

interface PollSummaryCardProps {
  poll: PublicPollSummary;
  /** Link target — defaults to the vote screen. */
  href?: string;
}

// A read-only poll card for lists you don't own (a guest's "looked at" history,
// or polls you only joined): title, status, span, response count, and the
// leading/finalized time. No copy/delete footer — those are creator affordances.
export function PollSummaryCard({ poll, href }: PollSummaryCardProps) {
  const target = href ?? `/p/${poll.slug}`;
  const hasResp = poll.responded > 0;
  return (
    <Link
      href={target}
      className="hover:border-brand/40 block overflow-hidden rounded-card border border-border bg-surface px-[16px] pb-3.5 pt-[14px] shadow-sh-1 transition-colors duration-ds ease-ds"
    >
      <div className="flex items-start justify-between gap-2.5">
        <h2 className="font-display text-[16px] font-bold leading-snug text-fg1">
          {poll.title}
        </h2>
        <StatusPill status={poll.status} />
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 font-body text-[13px] text-fg2">
        <span>
          For <span className="tnum">{poll.span}</span>
        </span>
        <span>·</span>
        <span>
          {hasResp ? `${poll.responded} responded` : "no responses yet"}
        </span>
      </div>

      <div
        className={`mt-2.5 flex items-center gap-1.5 font-body text-[13px] ${
          poll.lead ? "text-fg1" : "text-fg3"
        }`}
      >
        {poll.lead ? (
          <>
            {poll.lead.kind === "finalized" ? (
              <Check size={15} className="flex-shrink-0 text-brand" />
            ) : (
              <Clock size={15} className="flex-shrink-0 text-fg2" />
            )}
            <span>
              {poll.lead.kind === "finalized" ? "Finalized: " : "Leading: "}
              <span className="tnum font-medium">{poll.lead.label}</span>
            </span>
          </>
        ) : (
          <>
            <Clock size={15} className="flex-shrink-0" />
            <span>No responses yet</span>
          </>
        )}
      </div>
    </Link>
  );
}
