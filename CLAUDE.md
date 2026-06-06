# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository state

**Phases 1–5 are done.** A Next.js App Router + TypeScript app is live at the repo root with Prisma against Postgres and Auth.js v5 Google sign-in (Prisma adapter + **database sessions** + full access control — see below). The portable production image is proven by the `Dockerfile` (`docker build`); `docker compose` is dev-only and runs just a local Postgres. **Phase 2** plumbed the full design-token set from `docs/design/colors_and_type.css` into Tailwind `theme.extend` + CSS variables (`app/globals.css`), wired self-hosted fonts (Space Grotesk via `next/font/local`, Inter via `next/font/google`) and `lucide-react`, and shipped the `data-theme` light/dark mechanism (no-flash inline script + `lib/theme.ts` + `localStorage` `herd-theme`). Token specimen page: `/dev/tokens`. **Phase 3** shipped the presentational component kit (`components/ui/`, showcase at `/dev/gallery`). **Phase 4** replaced the placeholder with the full Prisma data model and the access-control system — see "Auth & access control" below. **Phase 5** shipped the creator-gated create + share flow (`/create` → `CreateForm` client + `actions.ts` server action; multi-select calendar, sticky 30-min time range, per-poll anonymity toggle default-visible, slug + UTC `TimeOption` rows) and the resolving `/p/{slug}` page (Phase 6 fills in voting). It added `lib/time.ts` (the 5-zone ET/CT/MT/PT/GMT enum ↔ IANA + DST-correct wall-time↔UTC conversion via `date-fns-tz`) and promoted the audit action names to a single source of truth (`AUDIT_ACTIONS` / `AUDIT_ACTION_VALUES` in `lib/access.ts`) that both the `logAction` writers and the `/admin` filter derive from. Phases 6–8 build on this — see `docs/plans/phases/`.

**Visual capture (context engineering):** front-end flows are recorded as optimized GIFs via Playwright → ffmpeg (`tests/visual/capture.mts`, `pnpm capture:visual`), output to `docs/screenshots/phase-<n>/`. The workflow — including the dev-login bypass it uses and how to add per-phase scenarios — is documented in `docs/context-engineering/visual-capture.md`. Requires the app running against a migrated Postgres with `ENABLE_DEV_LOGIN=true`, plus `ffmpeg` and `npx playwright install chromium`.

Package manager is **pnpm** (pinned via `packageManager` in `package.json`; `.npmrc` sets `node-linker=hoisted` so the standalone build and Prisma engine resolve). Commands (run from repo root):

- `pnpm install` — installs deps; `postinstall` runs `prisma generate`.
- `pnpm dev` — local dev server at http://localhost:3000.
- `pnpm build` — production standalone build (`output: 'standalone'`).
- `pnpm start` — serve a production build.
- `pnpm lint` — ESLint (`next lint`); `pnpm format` / `pnpm format:check` — Prettier.
- `pnpm migrate:dev` — create + apply a dev migration (`prisma migrate dev`).
- `pnpm migrate:deploy` — apply pending migrations (`prisma migrate deploy`).
- `pnpm db:seed` — idempotent owner bootstrap (allowlists `OWNER_EMAIL`, sets `isOwner`).
- `pnpm test` — Vitest unit tests (`pnpm test:watch` to watch).
- `docker compose up` — a **local dev Postgres only** (default port 5432, persistent `pgdata` volume), foreground so nothing lingers. The app runs on the host via `pnpm dev`. Copy `.env.example` → `.env` first (real Google OAuth creds needed for sign-in).
- `docker build -t herd-scheduler .` — the self-contained production image (the portability constraint), runnable on any container runtime against any `DATABASE_URL`.

Testing has started with **Vitest unit tests** (`pnpm test`) covering the access-control logic (`lib/access.test.ts` — the `canCreatePolls` owner × blocked × allowlist matrix) and slug shaping (`lib/slug.test.ts`); DB use is mocked. The full harness — real-Postgres integration tests + a Playwright smoke layer + CI — is **Phase 9** (`docs/plans/phases/phase-9-testing.md`).

The Prisma schema is the full Phase 4 data model (Auth.js tables + access control + poll domain). The Phase 1 `HealthCheck` placeholder is gone.

## Auth & access control (Phase 4)

Google OIDC via Auth.js v5 with the **Prisma adapter** and **database sessions** (`session.strategy: "database"` — sign-in persists `User`/`Account`/`Session`). Split config: `auth.config.ts` is edge-safe (providers only, no Prisma); `auth.ts` adds the adapter, the `signIn` gate, and the session/events callbacks.

- **Creator access is mode-gated by `ALLOWLIST_ENABLED`** (default `true` when unset): `true` = poll creation requires an `AllowedCreator` row; `false` = any *verified* sign-in can create. The owner always passes.
- **`signIn` gate** rejects `email_verified !== true` and any `BlockedEmail` *before* a user is created.
- **Owner** = `OWNER_EMAIL` (case-insensitive). Bootstrapped by `pnpm db:seed` and the sign-in event (order-independent).
- **Server-side chokepoints:** `requireCreator()` / `requireOwner()` in `lib/auth.ts` (re-check the DB each call). Pure, session-free helpers (`canCreatePolls`, `isEmailBlocked`, `isOwnerEmail`, `logAction`) live in `lib/access.ts` — keep them there to avoid an import cycle with `auth.ts`.
- **`AuditLog`** records meaningful actions via `logAction()`; surfaced only on the owner-only `/admin` screen. **Never** source the Results API from it (anonymity privacy guard, spec §9).
- The Google provider sets **`allowDangerousEmailAccountLinking: true`** — safe because Google verifies emails and we enforce `email_verified`. It links a Google sign-in to an existing same-email user instead of erroring with `OAuthAccountNotLinked`.

### Local auth testing — dev-login bypass

`app/api/dev/login/route.ts` is a **dev-only** sign-in bypass so you can test access-control flows without the Google round-trip (and so automated/agent sessions can authenticate via `curl`): `GET /api/dev/login?email=you@example.com[&name=…][&callbackUrl=/admin]` mints a `Session` + cookie directly (DB sessions make this just a row).

- **Triple-gated:** returns 404 unless `NODE_ENV !== "production"` **and** `ENABLE_DEV_LOGIN === "true"` (default `false`). Never enable it in a real deployment.
- It creates a `User` + `Session` but **no `Account`** row (no OAuth identity). Real Google sign-in creates `User` + `Account` (provider `google`) + `Session`.
- **Gotcha:** before account-linking was enabled, dev-logging-in as an email you later used for *real* Google produced `OAuthAccountNotLinked` (an accountless user blocks the link). `allowDangerousEmailAccountLinking` now resolves this, but the cleaner habit is to **use throwaway emails (e.g. `test@example.com`) for the bypass and your real address only for real Google sign-in.** If you do hit a stale collision, delete the orphaned `User` row (cascades to `Session`/`Account`).

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
- **TypeScript conventions:** follow `docs/typescript-standards.md` — notably, component props are declared as named `interface`s (never inline object-type literals), `type` is reserved for unions/aliases, and native-element wrappers extend the matching `*HTMLAttributes` type.

## Working with the tech spec

The spec is meant to keep evolving. When user requests change product behavior:
1. Update the spec first (or alongside the code) — don't let it drift.
2. The footer's "Resolved" line is the canonical short-form list of locked decisions; add to it when a new decision lands.
3. Open questions live in §11. Move items out of §11 when answered.
