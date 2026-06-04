# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository state

**Phases 1–2 are done.** A Next.js App Router + TypeScript app is live at the repo root with Prisma against Postgres and Auth.js v5 Google sign-in (JWT sessions, no allowlist/adapter yet). The portable production image is proven by the `Dockerfile` (`docker build`); `docker compose` is dev-only and runs just a local Postgres. **Phase 2** plumbed the full design-token set from `docs/design/colors_and_type.css` into Tailwind `theme.extend` + CSS variables (`app/globals.css`), wired self-hosted fonts (Space Grotesk via `next/font/local`, Inter via `next/font/google`) and `lucide-react`, and shipped the `data-theme` light/dark mechanism (no-flash inline script + `lib/theme.ts` + `localStorage` `herd-theme`). Token specimen page: `/dev/tokens`. Phases 3–8 build on this — see `docs/plans/phases/`.

Package manager is **pnpm** (pinned via `packageManager` in `package.json`; `.npmrc` sets `node-linker=hoisted` so the standalone build and Prisma engine resolve). Commands (run from repo root):

- `pnpm install` — installs deps; `postinstall` runs `prisma generate`.
- `pnpm dev` — local dev server at http://localhost:3000.
- `pnpm build` — production standalone build (`output: 'standalone'`).
- `pnpm start` — serve a production build.
- `pnpm lint` — ESLint (`next lint`); `pnpm format` / `pnpm format:check` — Prettier.
- `pnpm migrate:dev` — create + apply a dev migration (`prisma migrate dev`).
- `pnpm migrate:deploy` — apply pending migrations (`prisma migrate deploy`).
- `docker compose up` — a **local dev Postgres only** (default port 5432, persistent `pgdata` volume), foreground so nothing lingers. The app runs on the host via `pnpm dev`. Copy `.env.example` → `.env` first (real Google OAuth creds needed for sign-in).
- `docker build -t herd-scheduler .` — the self-contained production image (the portability constraint), runnable on any container runtime against any `DATABASE_URL`.

No automated test suite exists yet — add one when the first phase that warrants it lands.

The current Prisma schema is a single `HealthCheck` placeholder model proving the DB wire; the full data model arrives in Phase 4 and replaces it.

## Authoritative documents

Two source-of-truth documents shape every decision in this repo. Read them before proposing changes that touch features, data model, or UI.

- **`docs/plans/initial-tech-spec.md`** — product spec. Defines features, access-control model, data model, deployment story, milestones, and the open questions still in play. The footer's "Resolved" line is a fast index of locked-in decisions.
- **`docs/design/Herd Scheduler/`** — design system handoff bundle from Claude Design (claude.ai/design). Authoritative for **all** user-facing visuals, copy voice, and screen-level interactions. Start at `docs/design/Herd Scheduler/README.md` and follow its imports (`colors_and_type.css`, `ui_kits/herd-scheduler/`, `preview/`).

The design bundle is read-only reference material — do not modify files under `docs/design/`. The prototype's internal structure (global-scoped React via script tags, CDN-loaded fonts/icons) is throwaway; only the visual output and copy are normative. Production self-hosts fonts and uses `lucide-react` instead of the CDN.

## Planned stack

Per `docs/plans/initial-tech-spec.md` §3 — the next scaffolding step lands these together:

- **Next.js (App Router, TypeScript)** with `output: 'standalone'` for portable container builds.
- **Auth.js v5** with Google OIDC (basic scopes only — no Google verification needed).
- **PostgreSQL via Prisma** through a single `DATABASE_URL`. No provider-specific features.
- **Tailwind CSS** with the design tokens from `docs/design/Herd Scheduler/colors_and_type.css` plumbed into `theme.extend` + CSS variables.
- **Theming**: `data-theme` attribute on `<html>`, initial value from `prefers-color-scheme`, user choice persisted in `localStorage` (`herd-theme`). Dark mode is MVP, not Phase 2.
- **Self-hosted fonts** via `next/font` (Space Grotesk for display, Inter for body) and **Lucide React** for icons — both bundled into the image, no runtime CDN.

## Cross-cutting rules to keep in mind

- **Portability is a hard constraint.** The app must run on any container runtime and connect to any Postgres via `DATABASE_URL`. Don't introduce host-specific code paths (Vercel-only, Supabase-only, etc.). Vercel + Supabase is one supported reference setup, not the target.
- **Times are stored UTC**, displayed in the poll's timezone. The poll-timezone picker is a fixed 5-zone enum (ET / CT / MT / PT / GMT), not the full IANA list.
- **Best-fit scoring formula:** `yes*3 + maybe - no*4`. Top score wins; ties highlighted equally. "Works for everyone" is an independent badge fired when a slot has zero hard-No votes.
- **Per-poll anonymity flag** (`anonymousVoting` on `Poll`) gates whether the Results API returns per-voter rows or aggregate counts only. Default visible. When `true`, never leak voter identity to any viewer.
- **Slug format:** `kebab(title) + "-" + nanoid(5)` (e.g. `game-night-x9f2`). Unique constraint; retry on collision.
- **Voice:** sentence case everywhere, peer-to-peer, address user as "you", refer to the host by first name. The design bundle's README has the full content guide.

## Working with the tech spec

The spec is meant to keep evolving. When user requests change product behavior:
1. Update the spec first (or alongside the code) — don't let it drift.
2. The footer's "Resolved" line is the canonical short-form list of locked decisions; add to it when a new decision lands.
3. Open questions live in §11. Move items out of §11 when answered.
