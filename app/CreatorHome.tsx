"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useReducer, useState, useTransition } from "react";
import {
  Check,
  Clock,
  Copy,
  Plus,
  Settings,
  Share2,
  Trash2,
  Users,
} from "lucide-react";
import { BottomBar, Button, StatusPill, ThemeToggle } from "@/components/ui";
import { deletePoll } from "@/app/p/[slug]/finalize/actions";
import type { CreatorPollRow, PublicPollSummary } from "@/lib/polls";
import { BrandMark, PollSummaryCard } from "./PollSummaryCard";

// Duration of the delete card's collapse+fade. Kept as a constant so the CSS
// transition and the "refresh after it lands" timer can't drift apart.
const DELETE_ANIM_MS = 480;

// The per-card delete flow is a small state machine — idle → confirming →
// deleting → removed (or → error). Modeled with useReducer so the transitions
// read as named actions instead of a scatter of four interdependent setters.
// (See docs/typescript-standards.md → State management.) The copy-link toast is
// independent of all this, so it stays its own useState.
interface DeleteState {
  /** Slug whose confirm bar is showing, or null. */
  confirmingSlug: string | null;
  /** Slug whose delete request is in flight, or null. */
  deletingSlug: string | null;
  /** Slugs collapsing out of the list after a successful delete. */
  removedSlugs: Set<string>;
  /** Last delete failure, surfaced above the list. */
  error: string | null;
}

type DeleteAction =
  | { type: "request"; slug: string }
  | { type: "cancel" }
  | { type: "deleting"; slug: string }
  | { type: "removed"; slug: string }
  | { type: "failed"; error: string };

const initialDeleteState: DeleteState = {
  confirmingSlug: null,
  deletingSlug: null,
  removedSlugs: new Set(),
  error: null,
};

function deleteReducer(state: DeleteState, action: DeleteAction): DeleteState {
  switch (action.type) {
    case "request":
      return { ...state, confirmingSlug: action.slug, error: null };
    case "cancel":
      return { ...state, confirmingSlug: null };
    case "deleting":
      return { ...state, deletingSlug: action.slug, error: null };
    case "removed":
      // Clear the confirm/in-flight markers and start the collapse animation.
      return {
        ...state,
        confirmingSlug: null,
        deletingSlug: null,
        removedSlugs: new Set(state.removedSlugs).add(action.slug),
      };
    case "failed":
      return { ...state, deletingSlug: null, error: action.error };
  }
}

export interface CreatorHomeProps {
  firstName: string;
  isOwner: boolean;
  /** Whether this signed-in user may create polls (gates the "Your polls" tab). */
  mayCreate: boolean;
  /** Owner's first name — for the non-creator "ask {owner}" copy. */
  ownerName: string;
  /** Polls you created (the "Your polls" tab). */
  created: CreatorPollRow[];
  /** Polls you voted in but didn't create (the "Joined" tab). */
  joined: PublicPollSummary[];
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
    <div className="hover:border-brand/40 overflow-hidden rounded-card border border-border bg-surface shadow-sh-1 transition-colors duration-ds ease-ds">
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

type HomeTab = "yours" | "joined";

interface TabButtonProps {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}

// Segmented-control tab — "Your polls" / "Joined". Lightweight, token-styled.
function TabButton({ active, label, count, onClick }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-[8px] py-2 font-body text-[13.5px] font-semibold transition-colors duration-ds ease-ds ${
        active ? "bg-surface text-fg1 shadow-sh-1" : "text-fg2 hover:text-fg1"
      }`}
    >
      {label}
      {count > 0 && (
        <span
          className={`tnum rounded-full px-1.5 text-[11px] font-bold ${
            active ? "bg-brand-tint text-brand" : "bg-surface-2 text-fg3"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

// The signed-in home (Phase 8 + 12): a creator's polls, split into "Your polls"
// (created) and "Joined" (voted in elsewhere) tabs. A signed-in non-creator —
// who can't start polls — sees the Joined list on its own.
export function CreatorHome({
  firstName,
  isOwner,
  mayCreate,
  ownerName,
  created,
  joined,
}: CreatorHomeProps) {
  const router = useRouter();
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [del, dispatch] = useReducer(deleteReducer, initialDeleteState);
  const [, startDelete] = useTransition();
  const [tab, setTab] = useState<HomeTab>("yours");

  function copy(slug: string) {
    const url = `${window.location.origin}/p/${slug}`;
    void navigator.clipboard?.writeText(url).catch(() => {});
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug((cur) => (cur === slug ? null : cur)), 1600);
  }

  function confirmDelete(slug: string) {
    dispatch({ type: "deleting", slug });
    startDelete(async () => {
      const res = await deletePoll(slug);
      if (res.ok) {
        // Collapse the card first, then re-fetch once the animation lands so the
        // row doesn't pop out abruptly. The server action revalidated "/", so
        // the refresh drops the deleted poll from the list for good.
        dispatch({ type: "removed", slug });
        // Wait for the collapse+fade to finish before re-fetching, so the row
        // settles out gracefully instead of snapping mid-animation. Stays a
        // touch longer than the card's transition (see DELETE_ANIM_MS).
        setTimeout(() => router.refresh(), DELETE_ANIM_MS + 60);
      } else {
        dispatch({ type: "failed", error: res.error });
      }
    });
  }

  const joinedList = (
    <div className="flex flex-col gap-2.5">
      {joined.map((p) => (
        <PollSummaryCard key={p.slug} poll={p} />
      ))}
    </div>
  );

  // ---- non-creator: signed in, but not an approved host — Joined-only ----
  if (!mayCreate) {
    if (joined.length === 0) {
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
            <h2 className="ds-display mt-4 text-[24px]">
              You&apos;re all set to vote
            </h2>
            <p className="ds-body mt-1 text-[15px] text-fg2">
              Only approved hosts can start polls. Ask {ownerName} to add you —
              then you can make your own. Got a poll link? Open it to mark your
              availability.
            </p>
          </main>
        </div>
      );
    }
    return (
      <div className="flex min-h-screen flex-col">
        <Header firstName={firstName} isOwner={isOwner} count={null} />
        <main className="mx-auto w-full max-w-[390px] flex-1 px-4 py-4">
          <p className="mb-3 font-body text-[13px] text-fg2">
            Polls you&apos;ve joined. Want to start your own? Ask {ownerName} to
            add you.
          </p>
          {joinedList}
          <div className="h-2" />
        </main>
      </div>
    );
  }

  // ---- creator: tabbed "Your polls" / "Joined" ----
  return (
    <div className="flex min-h-screen flex-col">
      <Header firstName={firstName} isOwner={isOwner} count={created.length} />
      <main className="mx-auto w-full max-w-[390px] flex-1 px-4 py-4">
        <div className="mb-3.5 flex gap-1 rounded-input bg-surface-2 p-1">
          <TabButton
            active={tab === "yours"}
            label="Your polls"
            count={created.length}
            onClick={() => setTab("yours")}
          />
          <TabButton
            active={tab === "joined"}
            label="Joined"
            count={joined.length}
            onClick={() => setTab("joined")}
          />
        </div>

        {tab === "yours" ? (
          <>
            {del.error && (
              <p className="border-no/30 mb-3 rounded-input border bg-no-tint px-3 py-2 font-body text-[13px] text-no-ink">
                {del.error}
              </p>
            )}
            {created.length === 0 ? (
              <div className="flex flex-col items-center px-3 py-10 text-center">
                <BrandMark size={30} box={56} radius="rounded-[18px]" />
                <h2 className="ds-display mt-4 text-[20px]">No polls yet</h2>
                <p className="ds-body mt-1 text-[14px] text-fg2">
                  Start your first one and drop the link in the group chat —
                  your friends pick what works.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {created.map((p) => {
                  const removed = del.removedSlugs.has(p.slug);
                  // grid-rows 1fr→0fr collapses the row height while it fades,
                  // so the cards below slide up smoothly as it drops out.
                  return (
                    <div
                      key={p.slug}
                      style={{ transitionDuration: `${DELETE_ANIM_MS}ms` }}
                      className={`grid transition-all ease-ds ${
                        removed
                          ? "scale-[0.97] grid-rows-[0fr] opacity-0"
                          : "scale-100 grid-rows-[1fr] opacity-100"
                      }`}
                    >
                      <div className="min-h-0 overflow-hidden">
                        <PollCard
                          poll={p}
                          copied={copiedSlug === p.slug}
                          onCopy={copy}
                          confirming={del.confirmingSlug === p.slug}
                          deleting={del.deletingSlug === p.slug}
                          onRequestDelete={(slug) =>
                            dispatch({ type: "request", slug })
                          }
                          onCancelDelete={() => dispatch({ type: "cancel" })}
                          onConfirmDelete={confirmDelete}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : joined.length === 0 ? (
          <div className="flex flex-col items-center px-3 py-10 text-center">
            <span
              className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-surface-2 text-fg2"
              role="img"
              aria-label="Joined polls"
            >
              <Users size={24} />
            </span>
            <h2 className="ds-display mt-4 text-[20px]">Nothing joined yet</h2>
            <p className="ds-body mt-1 text-[14px] text-fg2">
              Polls you vote in — from links friends share — show up here.
            </p>
          </div>
        ) : (
          joinedList
        )}
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
