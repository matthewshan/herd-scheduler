"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { LogIn } from "lucide-react";
import { ThemeToggle } from "@/components/ui";
import type { PublicPollSummary } from "@/lib/polls";
import { loadVisits, removeVisit } from "@/lib/guest-history";
import { loadVisitedPollSummaries } from "./actions";
import { BrandMark, PollSummaryCard } from "./PollSummaryCard";

// The signed-out landing (Phase 12). A guest has no server-side home, so this
// lists the polls they've opened — remembered per-browser in localStorage — and
// keeps nudging them to sign in so the list isn't only on this device.
//
// Flow: render the cached titles immediately (fast), then fetch live public
// summaries for the same slugs and upgrade the cards; prune any poll the server
// no longer has (deleted).
export function GuestHome() {
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

  const signIn = (
    <Link
      href="/signin"
      className="flex items-center justify-center gap-2 rounded-btn bg-brand px-4 py-2.5 font-body text-[14px] font-semibold text-white transition-colors duration-ds ease-ds hover:brightness-95"
    >
      <LogIn size={17} />
      Sign in to keep your polls
    </Link>
  );

  const isEmpty = hydrated && order.length === 0;

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

      {isEmpty ? (
        <main className="mx-auto flex w-full max-w-[390px] flex-1 flex-col items-center justify-center px-7 text-center">
          <BrandMark size={34} box={64} radius="rounded-[20px]" />
          <h2 className="ds-display mt-4 text-[24px]">No polls yet</h2>
          <p className="ds-body mt-1 text-[15px] text-fg2">
            Open a poll link a friend shared and it&apos;ll show up here so you
            can find your way back. Sign in to keep them across devices.
          </p>
          <div className="mt-6 w-full">{signIn}</div>
        </main>
      ) : (
        <main className="mx-auto w-full max-w-[390px] flex-1 px-4 py-4">
          {/* Persistent nudge — the list is only on this browser until they sign in. */}
          <div className="mb-3.5">{signIn}</div>
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
      )}
    </div>
  );
}
