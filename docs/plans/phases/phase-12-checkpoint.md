# Phase 12 — checkpoint (resume here)

Status snapshot for picking the work back up. Phase 12 = guest home, your/joined
tabs, always-available share button, release-image workflow.

## Done & committed

- **Implementation** is complete and pushed: commit `c8a1ace`
  ("feat: guest home, your/joined tabs, share button, release workflow") on
  branch `phase-12-guest-home-share`.
- **Plan doc** committed: `b036dad` (`docs/plans/phases/phase-12-guest-home-share-release.md`
  + README index row).
- Verified before commit: `pnpm lint` clean, `pnpm build` type-checks,
  `pnpm test` = 89 passing.

### What shipped in c8a1ace

- `components/ui/ShareButton.tsx` (new) + export in `components/ui/index.ts` —
  app-bar copy-link icon (Share2→Check, "Link copied" aria-live pill).
- `lib/guest-history.ts` (new) — localStorage visit store
  (`herd-visited-polls`, cap 25): `loadVisits`, `recordVisit`, `removeVisit`.
- `lib/polls.ts` — `PublicPollSummary` interface, `CreatorPollRow extends` it,
  shared `toSummary` builder, `listPollsJoined(userId)`,
  `listPollSummariesBySlug(slugs)` (input-order, omits deleted).
- `app/actions.ts` (new) — `loadVisitedPollSummaries(slugs)` server action
  (caps ≤50, slug-regex filtered).
- `app/PollSummaryCard.tsx` (new) — `BrandMark` + read-only `PollSummaryCard`.
- `app/GuestHome.tsx` (new) — signed-out landing; cached titles → live
  summaries; persistent "Sign in to keep your polls" CTA.
- `app/CreatorHome.tsx` — rewritten with Your polls / Joined segmented tabs;
  non-creator = Joined-only view.
- `app/page.tsx` — guest → `<GuestHome />`; signed-in → tabbed home.
- `app/p/[slug]/VoteForm.tsx`, `.../results/ResultsView.tsx` — `recordVisit`
  on mount + `ShareButton` in app bar.
- `lib/polls.test.ts` (new) — `listPollSummariesBySlug` ordering/empty tests.
- `.github/workflows/release-image.yml` (new) — publish runner+migrate images
  on `release: published`, tagged from `github.event.release.tag_name`.

## Uncommitted work in progress

- `tests/visual/capture.mts` (modified, **committed with this checkpoint**):
  - New helpers `devLoginAs`, `quickCreateAs`, `voteAsUser`.
  - 3 Phase 12 scenarios in `main()` after the phase-9 block: seed Taylor's
    poll + owner votes, then `record(... 12, "guest-home" ...)`,
    `record(... 12, "share-button" ...)`, `record(... 12, "home-tabs" ...)`.
  - **Date-robustness fix**: "Next month" click added to `driveCreate`,
    `quickCreate`, `quickCreateAs`, and the inline `create-dark` scenario, so
    hard-coded day numbers aren't disabled as past days (today is 2026-06-18).

## REMAINING — what to do on resume

1. **Resolve ffmpeg (the blocker).** The Playwright-bundled ffmpeg
   (`...ms-playwright\ffmpeg-1011\ffmpeg-win64.exe`) is stripped and **lacks the
   `palettegen` / `paletteuse` filters** that `webmToGif` in `capture.mts`
   needs, so GIF conversion fails. Need a full static ffmpeg build on PATH (or
   pointed at via the script). Tried & failed: `choco install ffmpeg` (no
   admin), gyan.dev download (Invoke-WebRequest exit 58). winget/scoop not
   present. Options: install ffmpeg with admin, or grab a static build manually
   and put it on PATH, then verify `ffmpeg -filters | findstr palettegen`.
2. **Capture the GIFs.** With ffmpeg fixed: ensure the dev server is running
   with `ENABLE_DEV_LOGIN=true ALLOWLIST_ENABLED=false` against the migrated
   local Postgres, then `pnpm capture:visual`. Output lands in
   `docs/screenshots/phase-12/` (guest-home, share-button, home-tabs).
3. **Stage only the phase-12 GIFs** (avoid committing churn from regenerated
   earlier-phase GIFs), commit, then **open the PR** with the GIFs embedded in
   the description (see CLAUDE.md visual-capture rule).

## Environment notes (may need re-establishing on resume)

- Local docker Postgres `herd-scheduler-db-1` running & migrated; the `Poll`
  table was truncated clean (owner `User` left intact).
- Dev server was running as a background task with
  `ENABLE_DEV_LOGIN=true` + `ALLOWLIST_ENABLED=false`, logging to
  `.capture-dev.log`.
- Playwright Chromium build 1223 installed.
- **Do not commit** `.capture-dev.log` or `.capture-tmp/` — they're local
  capture scratch (consider adding to `.gitignore`).
