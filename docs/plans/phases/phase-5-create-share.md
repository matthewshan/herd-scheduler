# Phase 5 — Create poll + share flow

> Part of the [phased implementation plan](README.md). Read the shared rules in that README before starting.

## Goal

Let an allowlisted host rapidly build a poll — multi-select days × a shared time range — publish it, and
share the link. After this phase a `Poll` with its `TimeOption` rows exists in the DB and has a shareable
`/p/{slug}` URL.

## Depends on

Phase 3 (kit components, especially `MiniCalendar`, `TzChip`, buttons/inputs) and Phase 4 (schema, creator
gate, slug helper).

## Scope

- **Create screen** (`CreateScreen.jsx` ported to production), creator-gated via `requireCreator()`:
  - Title (required), description (optional), location (optional).
  - **Timezone picker** — fixed 5-zone enum: ET / CT / MT / PT / GMT, **defaults to ET**
    (`America/New_York`). Not the full IANA list.
  - **Integrated month calendar** to **multi-select days at once** (the `MiniCalendar` from Phase 3).
  - **Shared start/end time-range picker** using a **30-minute preset dropdown**. The chosen range becomes
    the **default for the next add** (sticky last range) so the host can quickly tile slots across many
    selected days.
  - **Added-slots list** — each removable; this is the working set that becomes `TimeOption` rows.
  - **Per-poll anonymity toggle** at create time. **Default: visible** (`anonymousVoting = false`).
- **Server action** to create the poll:
  - Generates the slug via the Phase 4 helper (collision retry).
  - Writes the `Poll` + ordered `TimeOption` rows. **Convert the picked local (poll-timezone) times to UTC**
    for storage; keep `sortOrder`.
  - Persists `anonymousVoting`.
- **Share success state:** after create, show the `/p/{slug}` link with a **copy-link** affordance and the
  success copy from the design bundle.
- **Route `/p/{slug}`** registered (the vote screen itself is Phase 6; here just ensure the slug resolves
  and the share link is correct).

## Files to create / touch

- `app/create/page.tsx` + `app/create/actions.ts` (server action)
- `app/p/[slug]/page.tsx` — minimal resolver / placeholder (Phase 6 fills the vote UI)
- `lib/time.ts` — poll-timezone ↔ UTC conversion (via `date-fns-tz`/Luxon), 5-zone enum mapping
- Reuse `lib/slug.ts`, `lib/calendar.ts` from earlier phases

## Reuse from design bundle

- `docs/design/Herd Scheduler/ui_kits/herd-scheduler/CreateScreen.jsx` — full create flow layout + the
  share success state.
- `.../Calendar.jsx` — `TIME_OPTS` (30-min grid) and day helpers (now in `lib/calendar.ts`).
- `TzChip`, `MiniCalendar`, buttons/inputs/selects from Phase 3.
- `docs/design/Herd Scheduler/screenshots/01-create-*.png`, `create*.png` — visual diff targets.

## Acceptance criteria

- Only allowlisted users can reach `/create`; others are denied.
- Creating a poll writes a `Poll` plus correctly-ordered `TimeOption` rows whose `startTime`/`endTime` are
  **UTC** (verify a known ET input round-trips correctly).
- The time range sticks as the default for the next day added.
- Slug matches `kebab(title)-nanoid(5)`, is unique, and resolves at `/p/{slug}`.
- The anonymity toggle persists (`anonymousVoting`) and defaults to visible.
- Copy-link copies the full shareable URL.
- Timezone chip shows the selected zone; defaults to ET.

## Out of scope

- The voting UI on `/p/{slug}` (Phase 6).
- Results / finalize (Phase 7).
- Editing an existing poll's slots (not in MVP scope unless the spec adds it).

## Spec references

§2 (MVP create flow), §6 (data model, slug, UTC storage), §10 milestone 3.
