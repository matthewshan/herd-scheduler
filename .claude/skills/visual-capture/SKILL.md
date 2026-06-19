---
name: visual-capture
description: Record a front-end flow as an optimized GIF for the docs (the "context engineering" media). Use when finishing a phase or UI change and you want to capture/refresh the rendered flow GIFs in docs/screenshots/phase-<n>/ via the Playwright → ffmpeg pipeline (pnpm capture:visual), or when adding a new capture scenario.
---

# Visual capture

Drive the real app with Playwright and render each flow as a small, sharp GIF
that lives next to the code. These GIFs are **context, not decoration**: a
recording of the real rendered flow is denser, higher-signal context than prose
for the reviewers and agents who pick up the work next. See the full rationale
and pipeline diagram in `docs/context-engineering/visual-capture.md` — this skill
is the operational checklist.

## What's in the repo

| Piece | Path |
|-------|------|
| Capture driver (Playwright → ffmpeg) | `tests/visual/capture.mts` |
| Run script | `pnpm capture:visual` |
| Output GIFs (per phase) | `docs/screenshots/phase-<n>/*.gif` |

## Run a capture

1. **Check prerequisites** (skip ones already satisfied):
   - A **full** ffmpeg with the `palettegen`/`paletteuse` filters
     (`ffmpeg -filters | grep palette` must list both — the GIF palette pass
     needs them). Either on `PATH`, or point the capture at a specific binary
     with the `FFMPEG` env var (e.g. `FFMPEG=/abs/path/ffmpeg.exe`).
     **Windows gotcha:** Playwright ships a *stripped* ffmpeg that lacks those
     filters, and Windows "N" editions have no system ffmpeg / `winget` /
     `scoop` at all. Download a full static build (BtbN or gyan.dev — force TLS
     1.2 in PowerShell 5.1: `[Net.ServicePointManager]::SecurityProtocol =
     'Tls12'` or the download fails with exit 58) and pass it via `FFMPEG`.
   - `npx playwright install chromium` — one-time browser install.
2. **Bring up the app against a migrated Postgres with dev-login enabled.** The
   capture authenticates via the dev-login bypass (no Google round-trip), so
   `ENABLE_DEV_LOGIN=true` is required:
   ```bash
   docker compose up -d                 # local Postgres only
   pnpm migrate:deploy && pnpm db:seed  # schema + owner bootstrap
   ENABLE_DEV_LOGIN=true ALLOWLIST_ENABLED=false pnpm dev   # app on :3000
   ```
   `ALLOWLIST_ENABLED=false` lets any dev-login identity create polls, so
   multi-user scenarios (a second host seeding a poll the owner then joins)
   work without allowlisting each email. If a dev server is already running on
   `:3000` (e.g. your editor's) **without** the dev-login flag, start the
   capture server on another port (`PORT=3100 ENABLE_DEV_LOGIN=true … pnpm dev`)
   and point the capture at it with `CAPTURE_BASE_URL=http://localhost:3100`.
   Per the repo's compose convention, this Postgres is dev-only — **tear it down
   when done** (`docker compose down`); don't leave containers running.
3. **Run the capture** in another shell:
   ```bash
   pnpm capture:visual                  # writes docs/screenshots/phase-<n>/*.gif
   ```
   Override the target with `CAPTURE_BASE_URL` / `OWNER_EMAIL` if the app isn't
   on `http://localhost:3000` or the owner differs.
4. **Verify** the GIFs in `docs/screenshots/phase-<n>/` look right and embed them
   in the phase doc / PR description.

## Add a scenario (per phase)

In `tests/visual/capture.mts`, add a
`record(browser, "<name>", "<light|dark>", fn)` call inside `main()`. The
`fn(page)` receives a fresh authenticated page. Point new output at the current
phase by updating `OUT_DIR` to `docs/screenshots/phase-<n>`.

Conventions:

- **Name by screen/flow**, kebab-case: `create-flow`, `poll-page`, `create-dark`.
- **One flow per GIF.** A dark-mode pass is a separate, shorter scenario.
- **Drive by role/label locators, not CSS** — robust as classes change, and it
  exercises the same accessibility surface a screen reader would (the locators
  double as a11y assertions).
- Use realistic pacing (`pressSequentially`, short `waitForTimeout`s) so the
  motion reads well.

## Notes

- The dev-login bypass is **triple-gated** and dev-only (404 in production); see
  CLAUDE.md → "Local auth testing". The owner email always passes
  `requireCreator`, so creator-gated flows like `/create` are reachable.
- `tests/visual/capture.mts` is a standalone ESM script run via `tsx`; the `.mts`
  extension marks it ESM regardless of the package's CommonJS default.
- **`main()` runs every phase's scenarios and re-renders all GIFs**, so a single
  run shows the whole `docs/screenshots/` tree as modified. When your change
  only touches one phase, **stage just that phase's folder** and `git checkout`
  the rest (re-encoding churn, not real diffs) — mirrors the repo's "revert
  unrelated drift" habit.
- For clean, uncluttered GIFs (especially the home/dashboard lists), start from
  an empty poll set: `docker exec -i <db> psql -U app -d scheduler -c
  'TRUNCATE TABLE "Poll" CASCADE;'` leaves the owner `User` intact.
- `main()` wipes `.capture-tmp` at the start of each run, so don't park a local
  ffmpeg there — keep it elsewhere (the repo ignores `/.capture-ffmpeg`) and
  reference it via `FFMPEG`.
- Time-sensitive flows: the create scenarios click **"Next month"** before
  picking hard-coded day numbers, so a day like "12" isn't disabled-as-past
  when the run happens late in the month. Keep that when adding date-driven
  scenarios.
