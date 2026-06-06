# Phase 3 — Design-system kit components

> Part of the [phased implementation plan](README.md). Read the shared rules in that README before starting.

## Goal

Build the production React component library matching the design prototype pixel-for-pixel, against the
real tokens from Phase 2. These are **presentational only** — no data fetching, no server actions. Phases
5–7 assemble them into screens.

## Depends on

Phase 2 (tokens, fonts, icons, theming all available).

## Scope

Build each of these as a standard Next.js/React + Tailwind component, ported from the prototype's
`Shared.jsx`, `Calendar.jsx`, and `kit.css`:

- **`Segmented`** — the signature 3-way control (Yes / If-need-be / No): pill track, the selected segment
  cross-fades to its semantic vote tint, a check glyph reveals on it, and **tap-to-clear** (tapping the
  active segment returns to "not marked"). Matches the prototype's per-segment tint (no sliding thumb).
- **Slot card** — the container that holds a time + a `Segmented` (vote screen) or a tally (results).
- **`StackedBar`** — proportional Yes/Maybe/No tally bar.
- **`Tally`** — the Yes/Maybe/No count readout.
- **`Avatar`** + **`AvatarStack`** — initial/color avatars and the overlapping stack.
- **`TzChip`** — timezone chip (e.g. "Times shown in Eastern Time · ET").
- **Pills** — "★ Best fit", "Works for everyone", "Finalized" badges.
- **Buttons & inputs** — primary/secondary buttons, text inputs, selects, matching `components-buttons.html`
  and `components-inputs.html`.
- **`MiniCalendar`** — month calendar with **multi-day select**, ported from `Calendar.jsx` (keep its
  day-label / dayId helpers and the 30-min `TIME_OPTS` grid as reusable utilities, but make month/range
  data driven by props rather than the baked-in May–Aug 2026 sample).
- **Sticky app bar** — poll title + host line + `TzChip` + theme toggle.
- **Sticky bottom action bar** — holds a primary action (e.g. progress + Submit on the vote screen).
- **Theme toggle** — the polished app-bar version (switches `data-theme`, persists to `herd-theme`).

Deliver a **gallery / showcase page** (a dev-only route) that renders every component in all relevant
states, in both light and dark, for visual diffing against the prototype.

Carry over verbatim: ~390px mobile-first frame (phone-width column on larger viewports); touch targets
≥ 44px; tabular figures on all clock times; the `--ease` / `--dur` motion tokens for the segment tint
cross-fade and check reveal.

## Files to create / touch

- `components/ui/Segmented.tsx`, `SlotCard.tsx`, `StackedBar.tsx`, `Tally.tsx`, `Avatar.tsx`,
  `AvatarStack.tsx`, `TzChip.tsx`, `Pill.tsx`, `Button.tsx`, `Input.tsx`, `Select.tsx`,
  `MiniCalendar.tsx`, `AppBar.tsx`, `BottomBar.tsx`, `ThemeToggle.tsx`
- `lib/calendar.ts` (day-label/dayId helpers + 30-min time options, ported from `Calendar.jsx`)
- `app/(dev)/gallery/page.tsx` (or similar) — the showcase
- Co-located component tests if the project adopts a test runner

## Reuse from design bundle

- `docs/design/Herd Scheduler/ui_kits/herd-scheduler/Shared.jsx` — `Avatar`, `AvatarStack`, `TzChip`,
  `Segmented`, `StackedBar`, `Tally` (port logic + markup).
- `.../Calendar.jsx` — `MiniCalendar`, day helpers, `TIME_OPTS`.
- `.../Icons.jsx` — icon usage (now via `lucide-react`).
- `.../kit.css` — component styling reference.
- `docs/design/Herd Scheduler/preview/components-*.html` — atomic specs per component.
- `docs/design/Herd Scheduler/screenshots/` — visual diff targets.

## Acceptance criteria

- The gallery renders every component in light + dark with no console errors.
- `Segmented` cross-fades the selected segment's tint, shows the check, and **clears on re-tap of the
  active segment**.
- All touch targets ≥ 44px; clock times use tabular figures.
- `MiniCalendar` supports multi-day selection driven by props (not the baked-in sample data).
- Visual diff against `preview/*.html` and `screenshots/` is clean.

## Out of scope

- Wiring components to data, server actions, or routes (Phases 5–7).
- The actual Vote / Results / Create / Sign-in / Admin screens.

## Spec references

§8 (UI implementation notes), §10 milestone 2.
