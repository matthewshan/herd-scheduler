"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Cat,
  Check,
  Clock,
  Copy,
  Plus,
  Settings,
  Share2,
  Trash2,
  Users,
} from "lucide-react";
import {
  BottomBar,
  Button,
  StatusPill,
  ThemeToggle,
} from "@/components/ui";
import { deletePoll } from "@/app/p/[slug]/finalize/actions";
import type { CreatorPollRow } from "@/lib/polls";

export type CreatorHomeVariant = "list" | "empty" | "noncreator";

// Duration of the delete card's collapse+fade. Kept as a constant so the CSS
// transition and the "refresh after it lands" timer can't drift apart.
const DELETE_ANIM_MS = 480;

export interface CreatorHomeProps {
  firstName: string;
  isOwner: boolean;
  variant: CreatorHomeVariant;
  /** Owner's first name — for the non-creator "ask {owner}" copy. */
  ownerName: string;
  polls: CreatorPollRow[];
}

interface BrandMarkProps {
  size?: number;
  /** Diameter of the rounded square. */
  box?: number;
  radius?: string;
}

// The brand mark — production uses the real lucide Cat glyph in a brand-tint
// rounded square (the prototype's 🐱 emoji is a throwaway placeholder).
function BrandMark({ size = 20, box = 34, radius = "rounded-[10px]" }: BrandMarkProps) {
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

interface HeaderProps {
  firstName: string;
  isOwner: boolean;
  /** Poll count for the sub-line; null hides the count (non-creator state). */
  count: number | null;
}

function Header({ firstName, isOwner, count }: HeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-appbar-bg px-4 pb-[13px] pt-3 backdrop-blur-[10px] backdrop-saturate-[1.4]">
      <div className="mx-auto w-full max-w-[390px]">
        <div className="flex items-center gap-2.5">
          <BrandMark />
          <h1 className="ds-h1 min-w-0 flex-1 truncate">Your polls</h1>
          {isOwner && (
            <Link
              href="/admin"
              aria-label="Manage access"
              className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-[10px] text-fg1 transition-colors duration-ds ease-ds hover:bg-surface-2"
            >
              <Settings size={19} />
            </Link>
          )}
          <ThemeToggle />
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 font-body text-[13px] text-fg2">
          <span>Signed in as {firstName}</span>
          {count !== null && (
            <>
              <span>·</span>
              <span>
                {count === 0
                  ? "no polls yet"
                  : `${count} ${count === 1 ? "poll" : "polls"} · newest first`}
              </span>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

interface PollCardProps {
  poll: CreatorPollRow;
  copied: boolean;
  onCopy: (slug: string) => void;
  confirming: boolean;
  deleting: boolean;
  onRequestDelete: (slug: string) => void;
  onCancelDelete: () => void;
  onConfirmDelete: (slug: string) => void;
}

function PollCard({
  poll,
  copied,
  onCopy,
  confirming,
  deleting,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
}: PollCardProps) {
  const hasResp = poll.responded > 0;
  // Default destination keys on *your* ballot, not the crowd's: once you've
  // voted the card opens the breakdown; until then it drops you onto the vote
  // screen so you mark your own availability first.
  const target = poll.youVoted ? `/p/${poll.slug}/results` : `/p/${poll.slug}`;
  return (
    <div className="overflow-hidden rounded-card border border-border bg-surface shadow-sh-1 transition-colors duration-ds ease-ds hover:border-brand/40">
      <Link href={target} className="block px-[16px] pb-3 pt-[14px]">
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
              <Share2 size={15} className="flex-shrink-0" />
              <span>Share the link to get the first reply</span>
            </>
          )}
        </div>
      </Link>

      <div className="flex items-center justify-between gap-2 border-t border-border px-[12px] py-2">
        {confirming ? (
          <>
            <span className="pl-1 font-body text-[13px] font-medium text-fg1">
              Delete this poll?
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onCancelDelete}
                disabled={deleting}
                className="inline-flex h-9 items-center rounded-btn px-3 font-body text-[13.5px] font-medium text-fg2 transition-colors duration-ds ease-ds hover:bg-surface-2 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => onConfirmDelete(poll.slug)}
                disabled={deleting}
                className="inline-flex h-9 items-center rounded-btn bg-no px-3.5 font-body text-[13.5px] font-semibold text-white transition-colors duration-ds ease-ds hover:brightness-95 disabled:opacity-60"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onCopy(poll.slug)}
              className="inline-flex h-9 items-center gap-1.5 rounded-btn px-3 font-body text-[13.5px] font-medium text-brand transition-colors duration-ds ease-ds hover:bg-brand-tint"
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? "Copied" : "Copy link"}
            </button>
            <button
              type="button"
              onClick={() => onRequestDelete(poll.slug)}
              aria-label="Delete poll"
              className="inline-flex h-9 items-center gap-1.5 rounded-btn px-3 font-body text-[13.5px] font-medium text-fg3 transition-colors duration-ds ease-ds hover:bg-no-tint hover:text-no"
            >
              <Trash2 size={15} />
              Delete
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// The signed-in creator's home (Phase 7.5): the polls you created, newest first.
// Three states — your list, the empty state, and the non-creator state for a
// signed-in person who can't start polls.
export function CreatorHome({
  firstName,
  isOwner,
  variant,
  ownerName,
  polls,
}: CreatorHomeProps) {
  const router = useRouter();
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [confirmingSlug, setConfirmingSlug] = useState<string | null>(null);
  const [deletingSlug, setDeletingSlug] = useState<string | null>(null);
  const [removedSlugs, setRemovedSlugs] = useState<Set<string>>(new Set());
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [, startDelete] = useTransition();

  function copy(slug: string) {
    const url = `${window.location.origin}/p/${slug}`;
    void navigator.clipboard?.writeText(url).catch(() => {});
    setCopiedSlug(slug);
    setTimeout(
      () => setCopiedSlug((cur) => (cur === slug ? null : cur)),
      1600,
    );
  }

  function confirmDelete(slug: string) {
    setDeleteError(null);
    setDeletingSlug(slug);
    startDelete(async () => {
      const res = await deletePoll(slug);
      if (res.ok) {
        // Collapse the card first, then re-fetch once the animation lands so the
        // row doesn't pop out abruptly. The server action revalidated "/", so
        // the refresh drops the deleted poll from the list for good.
        setConfirmingSlug(null);
        setDeletingSlug(null);
        setRemovedSlugs((cur) => new Set(cur).add(slug));
        // Wait for the collapse+fade to finish before re-fetching, so the row
        // settles out gracefully instead of snapping mid-animation. Stays a
        // touch longer than the card's transition (see DELETE_ANIM_MS).
        setTimeout(() => router.refresh(), DELETE_ANIM_MS + 60);
      } else {
        setDeleteError(res.error);
        setDeletingSlug(null);
      }
    });
  }

  // ---- empty: approved creator, no polls yet ----
  if (variant === "empty") {
    return (
      <div className="flex min-h-screen flex-col">
        <Header firstName={firstName} isOwner={isOwner} count={0} />
        <main className="mx-auto flex w-full max-w-[390px] flex-1 flex-col items-center justify-center px-7 text-center">
          <BrandMark size={34} box={64} radius="rounded-[20px]" />
          <h2 className="ds-display mt-4 text-[24px]">No polls yet</h2>
          <p className="ds-body mt-1 text-[15px] text-fg2">
            Start your first one and drop the link in the group chat — your
            friends pick what works.
          </p>
          <Button block className="mt-6" onClick={() => router.push("/create")}>
            <Plus size={18} />
            New poll
          </Button>
        </main>
      </div>
    );
  }

  // ---- non-creator: signed in, but not an approved host ----
  if (variant === "noncreator") {
    return (
      <div className="flex min-h-screen flex-col">
        <Header firstName={firstName} isOwner={isOwner} count={null} />
        <main className="mx-auto flex w-full max-w-[390px] flex-1 flex-col items-center justify-center px-7 text-center">
          <span
            className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-surface-2 text-fg2"
            role="img"
            aria-label="Voting"
          >
            <Users size={26} />
          </span>
          <h2 className="ds-display mt-4 text-[24px]">You&apos;re all set to vote</h2>
          <p className="ds-body mt-1 text-[15px] text-fg2">
            Only approved hosts can start polls. Ask {ownerName} to add you —
            then you can make your own. Got a poll link? Open it to mark your
            availability.
          </p>
        </main>
      </div>
    );
  }

  // ---- default: list of your polls ----
  return (
    <div className="flex min-h-screen flex-col">
      <Header firstName={firstName} isOwner={isOwner} count={polls.length} />
      <main className="mx-auto w-full max-w-[390px] flex-1 px-4 py-4">
        {deleteError && (
          <p className="mb-3 rounded-input border border-no/30 bg-no-tint px-3 py-2 font-body text-[13px] text-no-ink">
            {deleteError}
          </p>
        )}
        <div className="flex flex-col gap-2.5">
          {polls.map((p) => {
            const removed = removedSlugs.has(p.slug);
            // grid-rows 1fr→0fr collapses the row height while it fades, so the
            // cards below slide up smoothly as the deleted one drops out.
            return (
              <div
                key={p.slug}
                style={{ transitionDuration: `${DELETE_ANIM_MS}ms` }}
                className={`grid transition-all ease-ds ${
                  removed
                    ? "grid-rows-[0fr] scale-[0.97] opacity-0"
                    : "grid-rows-[1fr] scale-100 opacity-100"
                }`}
              >
                <div className="min-h-0 overflow-hidden">
                  <PollCard
                    poll={p}
                    copied={copiedSlug === p.slug}
                    onCopy={copy}
                    confirming={confirmingSlug === p.slug}
                    deleting={deletingSlug === p.slug}
                    onRequestDelete={(slug) => {
                      setDeleteError(null);
                      setConfirmingSlug(slug);
                    }}
                    onCancelDelete={() => setConfirmingSlug(null)}
                    onConfirmDelete={confirmDelete}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div className="h-2" />
      </main>
      <BottomBar>
        <Button block onClick={() => router.push("/create")}>
          <Plus size={18} />
          New poll
        </Button>
      </BottomBar>
    </div>
  );
}
