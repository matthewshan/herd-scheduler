"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { BarChart3, CheckCheck, MapPin, X } from "lucide-react";
import {
  AppBar,
  Avatar,
  BottomBar,
  Button,
  Input,
  Segmented,
  ShareButton,
  SlotCard,
  ThemeToggle,
  TzChip,
  type VoteValue,
} from "@/components/ui";
import {
  GUEST_ID_STORAGE_KEY,
  GUEST_NAME_STORAGE_KEY,
  mintGuestKey,
} from "@/lib/guest";
import { recordVisit } from "@/lib/guest-history";
import { LIMITS } from "@/lib/limits";
import { loadGuestBallot, submitVote, signInToVote } from "./actions";

// One candidate time, pre-formatted in the poll's zone (server-side, via
// lib/time) so the client never touches UTC.
export interface VoteSlot {
  id: string;
  /** e.g. "Fri, Jun 6". */
  date: string;
  /** e.g. "7:00 PM". */
  start: string;
  /** e.g. "10:00 PM". */
  end: string;
}

export interface VoteFormProps {
  slug: string;
  title: string;
  /** Host's first name — the voice refers to the host by first name. */
  hostFirstName: string;
  description: string | null;
  location: string | null;
  /** Full TzChip label, e.g. "Times shown in Eastern Time · ET". */
  tzLabel: string;
  /** Poll no longer accepting votes (closed/finalized). */
  closed: boolean;
  slots: VoteSlot[];
  isLoggedIn: boolean;
  /** Display name for a signed-in voter (their account name). */
  userName: string | null;
  /**
   * Pre-filled per-slot answers. A signed-in voter's saved ballot, or — for a
   * host with no ballot yet — every slot defaulted to "yes" (presumed available).
   */
  initialVotes: Record<string, VoteValue>;
  /**
   * Whether `initialVotes` is a real saved ballot (vs. prefilled host defaults).
   * Drives the "Submit" vs "Update" label so defaults don't read as submitted.
   */
  hasSavedBallot: boolean;
}

interface GoogleGProps {
  size?: number;
}

// Google's "G" — lucide has no brand logo, so inline the multi-color mark
// (matches the dedicated sign-in screen).
function GoogleG({ size = 16 }: GoogleGProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </svg>
  );
}

const draftKey = (slug: string) => `herd-vote:${slug}`;

interface VoteDraft {
  votes: Record<string, VoteValue>;
  name?: string;
}

// The core screen: anyone with the link marks availability per slot and submits.
// Votes live in local state; a local draft preserves in-progress votes across
// the inline sign-in round-trip (and an accidental refresh).
export function VoteForm({
  slug,
  title,
  hostFirstName,
  description,
  location,
  tzLabel,
  closed,
  slots,
  isLoggedIn,
  userName,
  initialVotes,
  hasSavedBallot,
}: VoteFormProps) {
  const [votes, setVotes] = useState<Record<string, VoteValue>>(initialVotes);
  const [guestName, setGuestName] = useState("");
  // Durable per-browser guest identity (Phase 9): the opaque key that lets a
  // returning guest's resubmit edit their own row. Read from localStorage on
  // mount; minted on first submit; persisted only after a successful save.
  const [guestKey, setGuestKey] = useState<string | null>(null);
  // True when this browser holds a remembered guest identity (name pre-filled /
  // ballot hydrated) — shows the quiet "not you?" escape hatch.
  const [recognized, setRecognized] = useState(false);
  const [touchedSubmit, setTouchedSubmit] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  // True once a ballot has been saved (this session or already on the server),
  // so the action reads "Update" rather than "Submit". Prefilled host defaults
  // aren't a saved ballot, so they don't flip this on.
  const [everSubmitted, setEverSubmitted] = useState(hasSavedBallot);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // The submit button lives in the sticky bottom bar, but the name field (and
  // its required-name error) sits up top — so a blocked submit can scroll it
  // back into view and focus it instead of silently doing nothing.
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Restore an in-progress draft on mount (survives the OAuth round-trip and
  // refreshes). A draft, when present, wins over server-loaded votes — it's the
  // voter's latest unsaved work. Then, for guests, restore the durable
  // per-browser identity (Phase 9): pre-fill their last-used name and hydrate
  // their saved ballot for this poll. Precedence: draft (latest unsaved work) >
  // hydrated saved ballot > empty. Runs once.
  const restoredRef = useRef(false);
  useEffect(() => {
    // Remember this poll in the browser's "looked at" history so it shows up on
    // the guest home. Records for everyone; only surfaced on the guest/non-creator
    // home (harmless for hosts).
    recordVisit(slug, title);

    try {
      const raw = localStorage.getItem(draftKey(slug));
      if (raw) {
        const draft = JSON.parse(raw) as VoteDraft;
        if (draft.votes && Object.keys(draft.votes).length > 0) {
          setVotes(draft.votes);
        }
        if (!isLoggedIn && draft.name) {
          setGuestName(draft.name);
        }
      }
    } catch {
      // Corrupt/blocked storage — fall back to the server-provided votes.
    }
    restoredRef.current = true;

    if (isLoggedIn) {
      return; // signed-in voters are pre-filled server-side by userId
    }
    let storedKey: string | null = null;
    try {
      storedKey = localStorage.getItem(GUEST_ID_STORAGE_KEY);
      const storedName = localStorage.getItem(GUEST_NAME_STORAGE_KEY);
      if (storedName) {
        setRecognized(true);
        // The draft name, when present, is newer than the global one.
        setGuestName((prev) => prev || storedName);
      }
    } catch {
      return; // storage unavailable — behave like a first-time guest
    }
    if (!storedKey) {
      return;
    }
    setGuestKey(storedKey);
    // The page is a server component that can't see this browser-held key, so
    // the returning guest's saved ballot is hydrated here instead.
    void loadGuestBallot(slug, storedKey).then((record) => {
      if (!record) {
        return; // no participant for this key on this poll
      }
      setRecognized(true);
      if (record.guestName) {
        const name = record.guestName;
        setGuestName((prev) => prev || name);
      }
      if (Object.keys(record.ballot).length > 0) {
        // They have a saved ballot — submitting again is an update.
        setEverSubmitted(true);
        // Don't clobber a restored draft or anything already tapped.
        setVotes((prev) =>
          Object.keys(prev).length > 0 ? prev : record.ballot,
        );
      }
    });
  }, [slug, title, isLoggedIn]);

  // Persist the working draft as it changes (skip the initial render so we don't
  // clobber a draft before restoring it). Cleared on a successful submit.
  useEffect(() => {
    if (!restoredRef.current || submitted) {
      return;
    }
    try {
      const hasVotes = Object.keys(votes).length > 0;
      const name = isLoggedIn ? undefined : guestName.trim() || undefined;
      if (!hasVotes && !name) {
        localStorage.removeItem(draftKey(slug));
      } else {
        const draft: VoteDraft = { votes, name };
        localStorage.setItem(draftKey(slug), JSON.stringify(draft));
      }
    } catch {
      // Storage unavailable — drafts just won't persist; voting still works.
    }
  }, [votes, guestName, submitted, slug, isLoggedIn]);

  const marked = Object.keys(votes).length;
  const total = slots.length;
  const nameMissing = !isLoggedIn && guestName.trim() === "";
  const showNameErr = touchedSubmit && nameMissing;

  function setVote(slotId: string, value: VoteValue | null) {
    setVotes((prev) => {
      const next = { ...prev };
      if (value === null) {
        delete next[slotId];
      } else {
        next[slotId] = value;
      }
      return next;
    });
    // Editing after a save returns the submit bar so the change can be saved.
    if (submitted) {
      setSubmitted(false);
    }
    if (error) {
      setError(null);
    }
  }

  function submit() {
    setTouchedSubmit(true);
    setError(null);
    if (nameMissing) {
      // Surface the (top-of-form) name error where the voter can see it — they
      // submitted from the bottom bar, so bring the empty field back into view.
      nameInputRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      nameInputRef.current?.focus({ preventScroll: true });
      return;
    }
    if (marked === 0) {
      return;
    }
    // Mint the durable guest key on first submit; keep using it from then on.
    const key = isLoggedIn ? null : (guestKey ?? mintGuestKey());
    startTransition(async () => {
      const res = await submitVote({
        slug,
        guestName: isLoggedIn ? undefined : guestName.trim(),
        guestKey: key ?? undefined,
        votes,
      });
      if (res.ok) {
        setSubmitted(true);
        setEverSubmitted(true);
        if (key) {
          // Persist the identity only once a ballot actually saved under it,
          // so lurkers who never submit get nothing written.
          setGuestKey(key);
          try {
            localStorage.setItem(GUEST_ID_STORAGE_KEY, key);
            localStorage.setItem(GUEST_NAME_STORAGE_KEY, guestName.trim());
          } catch {
            // best-effort — without storage they're a new guest next visit
          }
        }
        try {
          localStorage.removeItem(draftKey(slug));
        } catch {
          // best-effort
        }
      } else {
        setError(res.error);
      }
    });
  }

  // Shared devices exist: let a recognized guest discard this browser's stored
  // identity and vote as a brand-new person. The prior participant row (and
  // their votes) stays — only the local key/name/draft are cleared.
  function startFresh() {
    try {
      localStorage.removeItem(GUEST_ID_STORAGE_KEY);
      localStorage.removeItem(GUEST_NAME_STORAGE_KEY);
      localStorage.removeItem(draftKey(slug));
    } catch {
      // best-effort
    }
    setGuestKey(null);
    setGuestName("");
    setVotes({});
    setRecognized(false);
    setEverSubmitted(false);
    setSubmitted(false);
    setTouchedSubmit(false);
    setError(null);
  }

  // Save the in-progress draft before handing off to Google, so the votes are
  // there to restore when OAuth bounces back to this poll.
  function persistForSignIn() {
    try {
      const draft: VoteDraft = {
        votes,
        name: guestName.trim() || undefined,
      };
      localStorage.setItem(draftKey(slug), JSON.stringify(draft));
    } catch {
      // best-effort
    }
  }

  const submitLabel = everSubmitted
    ? "Update availability"
    : "Submit availability";

  return (
    <div className="flex min-h-screen flex-col">
      <AppBar
        title={title}
        // Everyone has a home now: the host's dashboard, a signed-in voter's
        // polls, or a guest's looked-at list (this poll is already in it).
        homeHref="/"
        homeLabel={isLoggedIn ? "Your polls" : "Polls you've seen"}
        right={
          <>
            <ShareButton slug={slug} />
            <ThemeToggle />
          </>
        }
        hostLine={
          <>
            <span>{hostFirstName} wants to find a time</span>
            <TzChip label={tzLabel} />
          </>
        }
      />

      <main className="mx-auto w-full max-w-[390px] flex-1 px-4 py-5">
        {description && (
          <p className="mb-3 font-body text-[14px] text-fg2">{description}</p>
        )}
        {location && (
          <p className="mb-4 flex items-center gap-1.5 font-body text-[13px] text-fg2">
            <MapPin size={14} />
            {location}
          </p>
        )}

        {/* identity row */}
        <div className="mb-2 flex items-center gap-3">
          {isLoggedIn ? (
            <>
              <Avatar name={userName ?? "You"} size={38} />
              <span className="min-w-0 flex-1 truncate font-body text-[15px] font-semibold text-fg1">
                {userName ?? "You"}
              </span>
              <span className="font-body text-[12px] text-fg3">Voting</span>
            </>
          ) : (
            <>
              <Input
                ref={nameInputRef}
                value={guestName}
                onChange={(e) => {
                  setGuestName(e.target.value);
                  if (showNameErr) {
                    setTouchedSubmit(false);
                  }
                }}
                placeholder="Your name"
                error={showNameErr}
                aria-label="Your name"
                aria-required
                maxLength={LIMITS.guestName}
                className="flex-1"
              />
              <form action={signInToVote.bind(null, slug)}>
                <Button
                  type="submit"
                  variant="ghost"
                  size="sm"
                  onClick={persistForSignIn}
                >
                  <GoogleG size={16} />
                  Sign in
                </Button>
              </form>
            </>
          )}
        </div>
        {/* Recognized returning guest — quiet escape hatch for shared devices.
            Clears the per-browser identity so the next submit is a new person. */}
        {!isLoggedIn && recognized && (
          <p className="mb-2 font-body text-[12.5px] text-fg3">
            Welcome back — we remembered you on this device.{" "}
            <button
              type="button"
              onClick={startFresh}
              className="font-medium text-fg2 underline underline-offset-2 transition-colors duration-ds ease-ds hover:text-brand"
            >
              Not you? Start fresh
            </button>
          </p>
        )}
        {showNameErr && (
          <p className="mb-2 flex items-center gap-[5px] font-body text-[12.5px] text-no">
            <X size={14} />
            Add your name so friends know who voted.
          </p>
        )}

        <h2 className="ds-h2 mb-2.5 mt-5">Which times work for you?</h2>

        <div className="flex flex-col gap-2.5">
          {slots.map((s) => (
            <SlotCard key={s.id} day={s.date} time={`${s.start}–${s.end}`}>
              <div className="mt-2.5">
                <Segmented
                  value={votes[s.id] ?? null}
                  onChange={(v) => setVote(s.id, v)}
                  disabled={closed}
                />
              </div>
            </SlotCard>
          ))}
        </div>

        {error && (
          <p className="border-no/30 mt-3 rounded-input border bg-no-tint px-3 py-2 font-body text-[13px] text-no-ink">
            {error}
          </p>
        )}

        {/* Anyone with the link can peek at the breakdown — quiet here while
            voting, surfaced prominently in the saved bar after submitting. */}
        {!submitted && (
          <div className="mt-5 text-center">
            <Link
              href={`/p/${slug}/results`}
              className="inline-flex items-center gap-1.5 font-body text-[13px] font-medium text-fg2 transition-colors duration-ds ease-ds hover:text-brand"
            >
              <BarChart3 size={15} />
              See responses
            </Link>
          </div>
        )}

        <div className="h-2" />
      </main>

      <BottomBar
        hint={submitted ? undefined : `${marked} of ${total} marked`}
        progress={submitted ? undefined : total > 0 ? marked / total : 0}
      >
        {submitted ? (
          <div className="flex flex-col items-center gap-2 py-1">
            <div className="flex items-center gap-2 font-body text-[14px] font-semibold text-yes">
              <CheckCheck size={18} />
              Saved — you can update anytime
            </div>
            <Link
              href={`/p/${slug}/results`}
              className="inline-flex items-center gap-1.5 font-body text-[13px] font-semibold text-brand transition-colors duration-ds ease-ds hover:underline"
            >
              <BarChart3 size={15} />
              See responses
            </Link>
          </div>
        ) : (
          <Button
            block
            disabled={closed || marked === 0 || isPending}
            onClick={submit}
          >
            {closed ? "Voting has ended" : isPending ? "Saving…" : submitLabel}
          </Button>
        )}
      </BottomBar>
    </div>
  );
}
