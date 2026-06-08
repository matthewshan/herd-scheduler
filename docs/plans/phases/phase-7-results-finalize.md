# Phase 7 — Results + finalize

> Part of the [phased implementation plan](README.md). Read the shared rules in that README before starting.

## Goal

Show best-fit-aware results for a poll, let the host manually finalize a winning slot, and guarantee that
anonymous polls never leak voter identity. This completes the MVP product surface.

## Depends on

Phase 5 (polls + slots exist) and Phase 6 (votes exist). Uses kit components from Phase 3.

## Scope

- **Results screen** (port `ResultsScreen.jsx`), sorted best-fit-first:
  - Per-slot **`StackedBar`** + **`Tally`** with Yes / Maybe (If-need-be) / No counts.
  - **Best-fit scoring:** `score = yes*3 + maybe - no*4`. The top score wins and gets a **2px cerulean ring
    + "★ Best fit" pill**. **Ties are all highlighted equally.**
  - **"Works for everyone" pill** — an **independent** badge that fires whenever `no == 0` on a slot
    (regardless of best-fit).
  - **`AvatarStack`** of who can make it — **only when the poll is non-anonymous**.
- **Manual finalize (host only):** writing `Poll.finalTimeOptionId`. Highlighting is guidance, never an
  automatic decision. Finalized state shows a **top-of-page banner** + a per-card check marker; the host can
  **change the pick**. The finalize/close server action calls the Phase 4 `logAction()` writer with
  `poll.finalize` / `poll.close`, targeting the poll.
- **Anonymity-aware Results API / data layer:** when `Poll.anonymousVoting == true`, return **aggregate
  counts only** — never per-voter rows or avatar data — **regardless of viewer role** (including the host).
  When false, per-voter avatars/names are returned for the attendee stack. Enforce this at the data-fetch
  layer, not just the UI, so identity can't leak through the API. **Never source Results from `AuditLog`**
  (which records voter identity for owner review even on anonymous polls) — keep the two paths separate.

## Files to create / touch

- `app/p/[slug]/results/page.tsx` (or a results tab on `/p/[slug]`) — the results screen
- `app/p/[slug]/finalize/actions.ts` — finalize / change-pick server action (host-gated)
- `lib/results.ts` — scoring (`yes*3 + maybe - no*4`), best-fit + tie detection, `works-for-everyone`
  (`no == 0`), and the **anonymity-aware aggregation** that decides per-voter vs aggregate output
- Reuse `lib/time.ts` for display

## Reuse from design bundle

- `docs/design/Herd Scheduler/ui_kits/herd-scheduler/ResultsScreen.jsx` — layout, finalize affordance,
  best-fit/finalized treatments, host/viewer modes.
- `StackedBar`, `Tally`, `AvatarStack`, `Pill` from Phase 3.
- `docs/design/Herd Scheduler/preview/components-tally.html`, `components-pills.html`,
  `components-slotcard.html` — atomic specs.
- `docs/design/Herd Scheduler/screenshots/results.png`, `mockups*.png` — visual diff targets.

## Acceptance criteria

- Scoring and ordering match `yes*3 + maybe - no*4`; the top score(s) get the cerulean ring + "★ Best fit".
- Tied top scores are **all** highlighted equally.
- "Works for everyone" fires **iff** a slot has zero `no` votes, independent of best-fit.
- Only the host can finalize; finalize persists `finalTimeOptionId`, shows the banner + per-card marker, and
  is changeable.
- For an anonymous poll, the data layer returns **only aggregate counts** — verified at the API level, no
  voter names/avatars in any response, even for the host.
- For a non-anonymous poll, the attendee avatar stack renders.

## Out of scope

- Per-viewer "show in my local time" toggle (Phase 2 / Phase 10 backlog).
- Poll expiry / auto-close, notifications (Phase 10 backlog).

## Spec references

§2 (MVP results + finalize), §6 (anonymity in the Results API), §9 (vote authorship visibility),
§10 milestone 5.
