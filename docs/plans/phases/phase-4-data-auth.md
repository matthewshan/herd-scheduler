# Phase 4 — Data model + auth & access control

> Part of the [phased implementation plan](README.md). Read the shared rules in that README before starting.

## Goal

Land the full Prisma schema and make the access model work end to end: anonymous voters,
logged-in voters, creators, and the owner. After this phase, login persists to the DB, poll
creation is gated by a **configurable** allowlist (`ALLOWLIST_ENABLED`), unverified and blocked
accounts are rejected, meaningful actions are written to an audit log, and the owner can manage
creators, the blocklist, and review the audit log.

## Depends on

Phase 1 (Prisma + Auth.js installed). Independent of Phases 2–3, so it can run in parallel with them.

## Scope

- **Full Prisma schema per spec §6**, replacing the Phase 1 placeholder model:
  - **`User`** — id, email, name, image, `isOwner`. Plus Auth.js **`Account`** / **`Session`** /
    **`VerificationToken`** tables.
  - **`AllowedCreator`** — email (unique), addedBy, addedAt.
  - **`BlockedEmail`** — email (unique), reason?, blockedBy, blockedAt.
  - **`AuditLog`** — id, createdAt, `actorUserId`? (FK→User, nullable for guests/anon), `actorEmail`?
    (snapshot string), `guestName`?, `action` (e.g. `signin`, `poll.create`, `poll.update`,
    `poll.close`, `poll.finalize`, `poll.delete`, `vote.cast`, `vote.update`, `creator.add`,
    `creator.remove`, `email.block`, `email.unblock`), `targetType`?, `targetId`?, `ip`?,
    `userAgent`?, `metadata` (Json?). Index on `createdAt` and `action`.
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
- **`signIn` callback gate:** reject when the Google profile's `email_verified !== true`; reject when the
  email is on `BlockedEmail`; write a `signin` `AuditLog` row on success. Blocklist + audit need DB
  access — keep this in `auth.ts` (Node runtime with the adapter), not the edge-safe `auth.config.ts`.
- **Mode-aware creator gate** on poll creation, exposed as a reusable helper `requireCreator()`:
  - must be logged in (verified) and **not** blocked — always;
  - owner (`isOwner`) always passes;
  - if `ALLOWLIST_ENABLED` (default `true`) → require `AllowedCreator` membership; else allow any
    verified user.
- **Audit log writer** `logAction(input)` — the reusable chokepoint all server actions call. Captures
  actor from the session (or `guestName`), plus `ip`/`userAgent` from the request where available.
  Wired in this phase to the chokepoints that exist now (`signin`, `creator.add`/`creator.remove`,
  `email.block`/`email.unblock`); poll/vote actions call it in Phases 5–7.
- **Owner bootstrap:** on first boot, seed `AllowedCreator` (and set `User.isOwner`) from `OWNER_EMAIL`.
  Idempotent — safe to run repeatedly. Owner gets admin access in **either** allowlist mode.
- **Admin screen** (owner-only), built from the prototype's `AdminScreen`:
  - **Creator management** — list/add/remove `AllowedCreator`; shown only when `ALLOWLIST_ENABLED`,
    with an explanatory note when allowlist is off.
  - **Blocklist** (always) — block an email (optional reason) / unblock.
  - **Audit log viewer** (always) — recent actions, filterable by `action`. **Privacy guard:** it shows
    actor identity even for `anonymousVoting` polls (owner-only, trusted); the Results API must never
    derive voter identity from `AuditLog`.
- **Sign-in screen** wired to the Google provider (from the prototype's `SignInScreen`).
- **Slug helper:** `slugify(title) + "-" + nanoid(8)` (e.g. `game-night-x9f2`), unique constraint, **retry
  on collision**. Expose as a reusable utility for Phase 5.

## Files to create / touch

- `prisma/schema.prisma` (full schema), `prisma/migrations/**`, `prisma/seed.ts` (owner bootstrap)
- `auth.ts` / `auth.config.ts` (Prisma adapter; `signIn` gate — `email_verified` + blocklist — in `auth.ts`)
- `lib/auth.ts` — mode-aware `requireCreator()`, owner checks, session helpers, `logAction()` writer
- `lib/slug.ts` — slug generation + collision retry
- `app/admin/page.tsx` + server actions — creator add/remove (allowlist mode), block/unblock, audit
  viewer (all owner-only)
- `app/signin/page.tsx` — sign-in screen
- `lib/db.ts` — Prisma client singleton
- `.env.example` — add `ALLOWLIST_ENABLED`

## Reuse from design bundle

- `docs/design/Herd Scheduler/ui_kits/herd-scheduler/SecondaryScreens.jsx` — `SignInScreen` and
  `AdminScreen` markup/layout.
- Kit components from Phase 3 (`Button`, `Input`, `AppBar`, `ThemeToggle`).

## Acceptance criteria

- Google login persists a `User` row (+ `Account`/`Session`).
- **Allowlist on** (`ALLOWLIST_ENABLED=true`): a logged-in but non-allowlisted user is **denied** poll
  creation; an allowlisted user is allowed. **Allowlist off**: any verified user is allowed, and the
  admin creator-management section is hidden.
- A sign-in with `email_verified=false` is **rejected**.
- A blocked email is denied poll creation and sign-in in **both** modes; unblocking restores access; the
  owner can never be blocked out of admin.
- `OWNER_EMAIL` is auto-allowlisted and flagged `isOwner` on first boot; re-running the seed is a no-op.
- Owner can add/remove creators, block/unblock emails, and browse the audit log; non-owners cannot reach
  `/admin`.
- `signin`, `creator.add/remove`, and `email.block/unblock` actions appear in the audit viewer.
- `slug` helper produces `kebab(title)-nanoid(8)` and retries on a forced collision.
- `prisma migrate deploy` applies cleanly against a fresh Postgres.

## Out of scope

- The create-poll form and share flow (Phase 5) — only the gate + helpers + admin live here. Phases 5–7
  wire their own `logAction()` calls for poll/vote actions.
- The vote and results screens (Phases 6–7).
- Rate limiting and per-creator / per-poll size caps (Phase 8).

## Spec references

§4 (env vars — `ALLOWLIST_ENABLED`), §5 (auth & access model, blocklist, audit log), §6 (data model),
§7 (Google login, `email_verified`), §9 (hardening), §10 milestone 4.
