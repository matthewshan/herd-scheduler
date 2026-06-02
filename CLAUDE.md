# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository state

This repo is **pre-implementation**. There is no application code yet — only design and planning documents. The initial commit contains `LICENSE` plus `docs/`. The first coding task will be scaffolding the stack described in §3 of the tech spec.

Do not assume any build, test, or run command exists until you've scaffolded the project (or confirmed scaffolding has been done since this file was written).

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
