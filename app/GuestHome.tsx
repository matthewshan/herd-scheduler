"use client";

import { useEffect, useState, useTransition } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ui";
import type { PublicPollSummary } from "@/lib/polls";
import { loadVisits, removeVisit } from "@/lib/guest-history";
import { loadVisitedPollSummaries } from "./actions";
import { BrandMark, PollSummaryCard } from "./PollSummaryCard";

export interface GuestHomeProps {
  /** Sign-in screen shown when this browser has no looked-at polls. */
  signInScreen: ReactNode;
}

// The signed-out landing (Phase 12). A guest has no server-side home, so this
// lists the polls they've opened — remembered per-browser in localStorage. If
// they haven't opened any, there's nothing to show, so we fall back to the
// plain sign-in screen (the old guest landing). When they do have polls, a
// quiet message nudges them to sign in so the list isn't only on this device.
//
// Flow: render the cached titles immediately (fast), then fetch live public
// summaries for the same slugs and upgrade the cards; prune any poll the server
// no longer has (deleted).
export function GuestHome({ signInScreen }: GuestHomeProps) {
  // Cached slugs+titles read from localStorage on mount (newest first).
  const [order, setOrder] = useState<{ slug: string; title: string }[]>([]);
  // Live summaries keyed by slug, merged in once fetched.
  const [summaries, setSummaries] = useState<Record<string, PublicPollSummary>>(
    {},
  );
  const [hydrated, setHydrated] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const visits = loadVisits();
    setOrder(visits.map((v) => ({ slug: v.slug, title: v.title })));
    setHydrated(true);
    if (visits.length === 0) {
      return;
    }
    const slugs = visits.map((v) => v.slug);
    startTransition(async () => {
      const rows = await loadVisitedPollSummaries(slugs);
      const map: Record<string, PublicPollSummary> = {};
      for (const row of rows) {
        map[row.slug] = row;
      }
      setSummaries(map);
      // Drop polls the server didn't return (deleted) from history + the view.
      const live = new Set(rows.map((r) => r.slug));
      for (const slug of slugs) {
        if (!live.has(slug)) {
          removeVisit(slug);
        }
      }
      setOrder((prev) => prev.filter((p) => live.has(p.slug)));
    });
  }, []);

  // Until localStorage is read we don't know which branch to show; render
  // nothing for that one frame rather than flash the wrong screen.
  if (!hydrated) {
    return null;
  }

  // No looked-at polls on this device → the plain sign-in landing.
  if (order.length === 0) {
    return <>{signInScreen}</>;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-appbar-bg px-4 pb-[13px] pt-3 backdrop-blur-[10px] backdrop-saturate-[1.4]">
        <div className="mx-auto w-full max-w-[390px]">
          <div className="flex items-center gap-2.5">
            <BrandMark />
            <h1 className="ds-h1 min-w-0 flex-1 truncate">
              Polls you&apos;ve seen
            </h1>
            <ThemeToggle />
          </div>
          <div className="mt-0.5 font-body text-[13px] text-fg2">
            The polls you open on this device show up here
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[390px] flex-1 px-4 py-4">
        {/* Quiet nudge — the list lives only in this browser until they sign in. */}
        <p className="mb-3.5 font-body text-[13px] text-fg2">
          <Link
            href="/signin"
            className="font-semibold text-brand hover:underline"
          >
            Sign in
          </Link>{" "}
          to keep these polls across your devices.
        </p>
        <div className="flex flex-col gap-2.5">
          {order.map((p) => {
            const summary = summaries[p.slug];
            return summary ? (
              <PollSummaryCard key={p.slug} poll={summary} />
            ) : (
              // Pre-fetch placeholder: cached title only, still tappable.
              <Link
                key={p.slug}
                href={`/p/${p.slug}`}
                className="block rounded-card border border-border bg-surface px-[16px] pb-3.5 pt-[14px] shadow-sh-1"
              >
                <h2 className="font-display text-[16px] font-bold leading-snug text-fg1">
                  {p.title}
                </h2>
                <p className="mt-1.5 font-body text-[13px] text-fg3">
                  Loading…
                </p>
              </Link>
            );
          })}
        </div>
        <div className="h-2" />
      </main>
    </div>
  );
}
