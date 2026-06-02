# Phase 4 — Data model + auth & access control

> Part of the [phased implementation plan](README.md). Read the shared rules in that README before starting.

## Goal

Land the full Prisma schema and make the three-tier access model work end to end: anonymous voters,
logged-in voters, allowlisted creators, and the owner. After this phase, login persists to the DB, poll
creation is gated by the allowlist, and the owner can manage creators.

## Depends on

Phase 1 (Prisma + Auth.js installed). Independent of Phases 2–3, so it can run in parallel with them.

## Scope

- **Full Prisma schema per spec §6**, replacing the Phase 1 placeholder model:
  - **`User`** — id, email, name, image, `isOwner`. Plus Auth.js **`Account`** / **`Session`** /
    **`VerificationToken`** tables.
  - **`AllowedCreator`** — email (unique), addedBy, addedAt.
  - **`Poll`** — id, `slug` (unique), title, description?, location?, `timezone` enum
    (`America/New_York` | `America/Chicago` | `America/Denver` | `America/Los_Angeles` | `Etc/GMT`),
    createdById, `status` (`open` | `closed`), **`anonymousVoting`** (bool, default `false`),
    `finalTimeOptionId`?, createdAt, `closesAt`?.
  - **`TimeOption`** — id, pollId, startTime (UTC), endTime (UTC), sortOrder.
  - **`Participant`** — id, pollId, userId? (nullable for guests), guestName?, createdAt.
  - **`Availability`** — id, participantId, timeOptionId, response (`yes` | `no` | `ifneedbe`). Rows persist
    **only for non-null responses**; absence of a row = "not marked".
  - Foreign keys + cascading deletes (Poll→TimeOption, Participant→Availability, etc.).
- **Migrations:** generate the initial migration; `prisma migrate deploy` must run clean.
- **Auth.js Prisma adapter** so login persists `User`/`Account`/`Session` (replacing Phase 1's JWT-only
  setup, or layering the adapter on — match Auth.js v5 conventions).
- **Allowlist gate** on poll creation: must be logged in → email checked against `AllowedCreator` →
  allow/deny. Expose a reusable server-side helper (e.g. `requireCreator()`).
- **Owner bootstrap:** on first boot, seed `AllowedCreator` (and set `User.isOwner`) from `OWNER_EMAIL`.
  Idempotent — safe to run repeatedly.
- **Admin screen** (owner-only): list creators, add by email, remove. Build from the prototype's
  `AdminScreen`.
- **Sign-in screen** wired to the Google provider (from the prototype's `SignInScreen`).
- **Slug helper:** `slugify(title) + "-" + nanoid(5)` (e.g. `game-night-x9f2`), unique constraint, **retry
  on collision**. Expose as a reusable utility for Phase 5.

## Files to create / touch

- `prisma/schema.prisma` (full schema), `prisma/migrations/**`, `prisma/seed.ts` (owner bootstrap)
- `auth.ts` / `auth.config.ts` (add Prisma adapter)
- `lib/auth.ts` — `requireCreator()`, owner checks, session helpers
- `lib/slug.ts` — slug generation + collision retry
- `app/admin/page.tsx` + server actions for add/remove creator (owner-only)
- `app/signin/page.tsx` — sign-in screen
- `lib/db.ts` — Prisma client singleton

## Reuse from design bundle

- `docs/design/Herd Scheduler/ui_kits/herd-scheduler/SecondaryScreens.jsx` — `SignInScreen` and
  `AdminScreen` markup/layout.
- Kit components from Phase 3 (`Button`, `Input`, `AppBar`, `ThemeToggle`).

## Acceptance criteria

- Google login persists a `User` row (+ `Account`/`Session`).
- A logged-in but non-allowlisted user is **denied** poll creation; an allowlisted user is allowed.
- `OWNER_EMAIL` is auto-allowlisted and flagged `isOwner` on first boot; re-running the seed is a no-op.
- Owner can add and remove creators from the admin screen; non-owners cannot reach it.
- `slug` helper produces `kebab(title)-nanoid(5)` and retries on a forced collision.
- `prisma migrate deploy` applies cleanly against a fresh Postgres.

## Out of scope

- The create-poll form and share flow (Phase 5) — only the gate + helpers + admin live here.
- The vote and results screens (Phases 6–7).
- Rate limiting (Phase 8).

## Spec references

§5 (auth & access model), §6 (data model), §7 (Google login), §10 milestone 4.
