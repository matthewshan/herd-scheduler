# Phase 7.5 — Creator home ("My polls")

> Part of the [phased implementation plan](README.md). Read the shared rules in that README before starting.

## Goal

Give a signed-in host a home for the polls they've created: a newest-first list with each poll's status,
response count, and leading/finalized time, plus the row actions to open results or copy the share link.
This replaces the Phase 1 scaffold at `app/page.tsx` (`/`) with the real landing screen and closes the
loop opened in Phase 5 — there is currently **no in-app way to see the polls you own or the votes on them**.

Scope is **"polls I created" only**. Owner-sees-everything stays an `/admin` concern, not this screen.

## Depends on

**Phase 7 (results + finalize).** Each row's `Leading: …` / `Finalized: …` line and the open/closed/finalized
status come from results data: the leading slot is the best-fit winner from `lib/results.ts`
(`yes*3 + maybe - no*4`), the finalized slot is `Poll.finalTimeOption`, and the row's primary action targets
the Phase 7 results screen. Build Phase 7 first. Also uses kit components from Phase 3 and `lib/time.ts`
(Phase 5) for span/timezone display.

> Sequencing note: at the time this brief was written, Phase 6 was still on `phase-6-vote-flow` (PR #6, not
> merged) and Phase 7 had not started. Confirm 6 → 7 have landed before picking this up.

## Scope

- **Creator-home screen** (port `ui_kits/herd-scheduler/MyPollsScreen.jsx`), replacing `app/page.tsx`:
  - **Auth-gated.** Signed-out visitors redirect to `/signin`. The screen is for an authenticated user.
  - **App bar:** brand mark + "Your polls" title, a settings gear linking to `/admin` (**owner-only** — hide
    for non-owners), and the `ThemeToggle`. Sub-line: "Signed in as {first name}" · poll-count summary
    ("4 polls · newest first" / "no polls yet").
  - **Poll list — three row states**, each a card:
    - **Title** + emoji (host-authored, rendered as-is) and a **status pill** (open / closed / finalized).
    - **Meta line:** `For {span}` (min–max date across the poll's `TimeOption`s, in the **poll timezone**,
      tabular figures) · `{n} responded` / `no responses yet`.
    - **Lead line:** `Leading: {day · time tz}` (clock icon) for an open/closed poll with a best-fit winner;
      `Finalized: {day · time tz}` (check icon) when finalized; or a muted `Share the link to get the first
      reply` (share icon) when there are no responses yet.
    - **Actions:** a ghost button — `Open results` when the poll has responses, else `Open poll` — and a
      `Copy link` button that copies the poll's share URL (`/p/{slug}`) with a transient "Copied" state.
  - **Primary CTA:** sticky bottom-bar `+ New poll` (→ `/create`) when the list is non-empty.
- **Empty state** (approved creator, zero polls): centered brand mark, "No polls yet", the peer-to-peer
  body copy, and a full-width primary `+ New poll`.
- **Non-creator state** (signed in, but `canCreatePolls` is false): centered users icon, "You're all set to
  vote", copy explaining only approved hosts start polls (name the host/owner) + how to vote from a link,
  and a ghost `Open a poll to vote`. **No `New poll` CTA.**
- **Data layer** — a creator-scoped query (e.g. `lib/polls.ts` → `listPollsForCreator(userId)`):
  - Polls where `createdById === session user`, **newest first** (`createdAt desc`).
  - Per poll: `status` (the `PollStatus` enum directly), `span` (earliest/latest `TimeOption`, poll tz via
    `lib/time.ts`), **responded count** (distinct `Participant`s with ≥1 `Availability` row — a blank submit
    shouldn't inflate the count), and the **lead** — finalized slot if `finalTimeOptionId` is set, else the
    best-fit slot from `lib/results.ts`, else none.
  - Reuse Phase 7's `lib/results.ts` for the leading-slot computation rather than re-deriving scoring here.
- **Repoint the create-flow success button:** `app/create/CreateForm.tsx`'s "View responses" currently
  routes to `/p/{slug}` (the **vote** screen, mislabeled). Point it at the Phase 7 results screen.

## Files to create / touch

- `app/page.tsx` — **replace** the scaffold with the creator-home server component (auth gate + query +
  variant selection).
- `app/page.tsx`'s client pieces — co-locate the interactive bits (poll card with its copy-link state, the
  three variants). Keep the data fetch in the server component.
- `lib/polls.ts` — `listPollsForCreator(userId)` returning the shaped rows above. Leans on `lib/results.ts`
  (Phase 7) and `lib/time.ts`.
- `components/ui/StatusPill.tsx` (or extend the existing `Pill`) — open/closed/finalized pill (dot for
  open/closed, check for finalized). Reusable on the results screen too.
- `app/create/CreateForm.tsx` — repoint "View responses" to the results route.
- Map the prototype's new classes (`poll-card`, `spill`, `host-line`, `poll-lead`, …) onto Tailwind +
  existing design tokens; do not copy `kit.css` verbatim.

## Reuse from design bundle

- `docs/design/ui_kits/herd-scheduler/MyPollsScreen.jsx` — layout, the three variants, copy, the
  `Header`/`PollCard`/`StatusPill` structure, and the lead/empty/non-creator treatments.
- `docs/design/screenshots/mypolls-{light,dark,empty,noncreator}.png` — visual diff targets (light + dark).
- `AppBar`, `Button`, `Pill`, `Avatar`, `ThemeToggle`, `TzChip` from Phase 3.
- **Brand mark:** the prototype uses a 🐱 emoji placeholder — production must use the real brand mark
  (Phase 2/3), not the emoji.
- **Ignore the prototype's bottom nav** ("My / Vote / Results / Create / Sign in" in the screenshots) — that
  is the prototype's screen-switcher chrome, not app navigation.

## Acceptance criteria

- `/` shows the signed-in host their own polls, newest first; signed-out users are sent to `/signin`.
- Each row's status pill matches `Poll.status`; the lead line shows the finalized slot when finalized, else
  the best-fit leading slot, else the "share the link" prompt — all times in the poll timezone with a tz chip.
- "Responded" counts distinct participants with at least one availability (blank submits don't count).
- Row primary action opens results (poll with responses) or the poll (no responses); "Copy link" copies the
  `/p/{slug}` URL.
- Empty state (creator, no polls) and non-creator state (signed in, can't create — no `New poll` CTA) render
  per the screenshots, light **and** dark.
- The create-flow "View responses" button lands on the real results screen, not the vote screen.
- A captured GIF of the flow ships with the PR (see below).

## Out of scope

- Owner "all polls" view, search/filter/pagination, archiving, or deleting polls.
- Polls you only **voted** on (not created) — this screen is "polls I created" only.
- Poll expiry / auto-close and notifications (Phase 8 backlog).

## Front-end deliverable (mandatory)

This is a user-facing screen, so the PR must ship a captured GIF under `docs/screenshots/phase-7.5/`,
embedded in the PR description, via `pnpm capture:visual`. Add a `record(...)` scenario covering the list →
open-results / copy-link path (and ideally the empty + non-creator states) rather than hand-recording — see
`docs/context-engineering/visual-capture.md`.

## Spec references

§2 (MVP product surface), §6 (anonymity — the lead/results data must come from `lib/results.ts`, never
`AuditLog`), §9 (host visibility). Add a creator-home line to the §10 milestones and the footer "Resolved"
list when this lands.
