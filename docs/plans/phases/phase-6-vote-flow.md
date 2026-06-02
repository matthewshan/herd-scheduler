# Phase 6 — Vote flow (guest + inline sign-in)

> Part of the [phased implementation plan](README.md). Read the shared rules in that README before starting.

## Goal

Let anyone with a poll link mark availability per slot and submit — as a guest (display name only) or
logged in — and let a guest convert to a logged-in voter inline without losing in-progress votes.

## Depends on

Phase 3 (kit components: `Segmented`, slot card, sticky bars, `TzChip`) and Phase 4 (schema:
`Participant`, `Availability`; auth). Phase 5 supplies real polls to vote on (or seed a poll for testing).

## Scope

- **Vote screen** at `/p/{slug}` (port `VoteScreen.jsx`):
  - Sticky **app bar**: poll title + host **first name** + `TzChip` + theme toggle.
  - Scrolling **slot list**: each slot shows its time (in the poll's timezone, tabular figures) with a
    3-way **`Segmented`** control (Yes / If-need-be / No, **tap-to-clear**).
  - **Guest display-name input** with an **inline "Sign in" affordance** (Google) next to it — the same
    Auth.js Google provider as the dedicated sign-in screen, just an alternate entry point.
  - Sticky **bottom bar**: `N of M marked` progress + a primary **Submit**; on success collapse to a
    "Saved — you can update anytime" toast.
- **Inline sign-in must preserve in-progress votes:** when a guest taps sign-in mid-vote, persist their
  current selections (e.g. to `localStorage` or a draft), complete OAuth, and **return to the same poll
  with votes intact**, now tied to the logged-in identity.
- **Server actions** for submit/update:
  - Create or find the `Participant` (by `userId` when logged in, or by `guestName` for guests).
  - Upsert `Availability` rows. **Tap-to-clear / unmarked = delete the row** (absence means "not marked").
  - **Re-submitting updates** the existing participant's rows rather than duplicating.
- Times displayed in the poll's timezone with the `TzChip`; never expose UTC to the user.

## Files to create / touch

- `app/p/[slug]/page.tsx` — the vote screen (replaces the Phase 5 placeholder)
- `app/p/[slug]/actions.ts` — submit/update server action
- `lib/votes.ts` — participant resolution + availability upsert/delete helpers
- Client logic for draft-vote preservation across the inline sign-in round-trip
- Reuse `lib/time.ts` (UTC→poll-tz display) from Phase 5

## Reuse from design bundle

- `docs/design/Herd Scheduler/ui_kits/herd-scheduler/VoteScreen.jsx` — layout, progress bar, saved toast,
  inline sign-in affordance.
- `Segmented`, slot card, `AppBar`, `BottomBar`, `TzChip`, `ThemeToggle` from Phase 3.
- `docs/design/Herd Scheduler/screenshots/vote.png`, `dark-check.png`, `signin-cat.png` — visual diff
  targets.

## Acceptance criteria

- A guest can vote with just a display name; the vote persists keyed to `guestName`.
- A logged-in vote ties to `userId`.
- Tapping the active segment clears it and **deletes** the corresponding `Availability` row.
- The `N of M marked` progress reflects only marked slots.
- Inline sign-in returns the user to the same poll with their in-progress votes preserved, now associated
  with their account.
- Re-submitting **updates** the participant's existing rows (no duplicate `Participant`/`Availability`).
- Times render in the poll's timezone with the chip; tabular figures on clock times.

## Out of scope

- Results, tallies, scoring, finalize (Phase 7).
- Anonymity-aware rendering — that lives on the Results side (Phase 7).

## Spec references

§2 (MVP vote flow), §5 (inline sign-in), §6 (data model, row-absence semantics), §10 milestone 3.
