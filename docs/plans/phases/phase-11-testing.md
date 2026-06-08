# Phase 11 — Automated testing

> Part of the [phased implementation plan](README.md). Read the shared rules in that README before starting.

## Goal

Stand up the project's first automated test suite. Two layers, by cost/value:

1. A fast **integration layer** (no browser) covering the access-control logic and the admin server
   actions against a **real Postgres** — this is where the security risk actually lives.
2. A thin **Playwright smoke layer** over the few flows that are only real end-to-end (the auth gates),
   driven through the existing dev-login bypass.

Plus the CI wiring to run both on every PR. This phase **establishes the harness and locks in the
Phase 4 (access-control) coverage**; later feature phases extend it rather than re-inventing it.

## Depends on

Phase 4 (the access-control system is the first security boundary worth testing — start here). The harness
is **cross-cutting**: it can begin as soon as Phase 4 lands and is extended as Phases 5–7 add the
create / vote / results flows. It does **not** block any feature phase.

## Scope — build this

**Runner & integration layer (Vitest, no browser).** The access logic is DB-backed, so test it against a
real Postgres, not mocks:

- **Access matrix** (`lib/access.ts`): `canCreatePolls` across the full owner × blocked × `ALLOWLIST_ENABLED`
  on/off matrix; `isEmailBlocked`; `isOwnerEmail` case-insensitivity; `normalizeEmail`.
- **Sign-in gate logic** (`auth.ts`): fail-closed on a missing/unverified `profile`; blocklist rejection
  before user creation.
- **Admin server actions** (`app/admin/actions.ts`): the `requireOwner` guard; the never-strip-owner /
  never-block-owner branches; **upsert idempotency** — adding a duplicate creator is a no-op, adding a new
  one grows the list (the exact bug class the misleading admin GIF exposed); audit rows written.
- **Slug** (`lib/slug.ts`): `slugify` / `makeSlug` shape; `generateUniqueSlug` retry-on-collision (seed a
  colliding row and assert it picks a fresh suffix, and that it throws after `maxAttempts`).
- **DB isolation:** a documented truncate-between-tests (or per-file) strategy so tests don't cross-
  contaminate; reuse the `TRUNCATE … RESTART IDENTITY CASCADE` pattern.

**Playwright smoke layer (browser, thin).** Only what's genuinely browser-level, using
`ENABLE_DEV_LOGIN=true` + `/api/dev/login` as the auth entry (it was built for exactly this):

- owner → `/admin` renders 200; non-owner → redirected to `/`; unauthenticated → `/signin`.
- blocked email via dev-login → 403.
- add-creator form actually **mutates the list** (regression guard for the no-op bug).
- allowlist **on vs off** rendering split — note this needs **two server instances / two Playwright
  projects**, because `ALLOWLIST_ENABLED` is read from the server env at request time, not toggleable per
  request.

**CI.** A GitHub Actions workflow: spin a Postgres service, `migrate deploy` + `db:seed`, run the
integration suite, then `build` + run the headless-chromium smoke suite. Required-green on PRs.

**Test-env hygiene.** A dedicated test database (separate `DATABASE_URL` / DB name). Destructive setup
(truncate) must **refuse to run** unless the target DB name matches the configured test DB — never let a
truncate point at a real database.

## Files to create / touch

- `vitest.config.ts`; a test setup file (Prisma test client + truncate helper + DB-name guard)
- `lib/access.test.ts`, `lib/slug.test.ts`, `app/admin/actions.test.ts`, and a sign-in-gate test for `auth.ts`
- `playwright.config.ts`; `e2e/` specs; a global-setup that boots the compose Postgres, migrates + seeds,
  and starts the dev server(s); the two `ALLOWLIST_ENABLED` projects
- `.github/workflows/test.yml`
- `package.json` — `test`, `test:watch`, `test:e2e` scripts + devDeps (`vitest`, `@playwright/test`, …)
- `CLAUDE.md` — replace the "No automated test suite exists yet" note; document how to run each layer, the
  test-DB guard, and dev-login's role as the E2E auth entry
- `.env.example` — note the test `DATABASE_URL` (and that `ENABLE_DEV_LOGIN=true` is required for E2E)

## Reuse from design bundle

None — this is test infrastructure. (Reuses the **dev-login bypass** as the E2E auth entry and the
**`docker compose` Postgres** as the test-DB substrate.)

## Acceptance criteria

- `pnpm test` runs the integration suite green against a fresh Postgres with no manual setup beyond a
  running DB.
- The access matrix is covered for **all** owner/blocked × allowlist-on/off combinations.
- It is asserted that adding a **duplicate** creator is a no-op and adding a **new** one grows the list
  (the admin-GIF regression).
- `pnpm test:e2e` runs the Playwright smoke suite headless and green: owner/non-owner/unauthenticated
  gates, the 403 blocked path, and both allowlist modes.
- The CI workflow runs both layers on PRs and is required-green.
- Destructive test setup **refuses to run** against a DB whose name isn't the configured test DB.

## Out of scope

- **Visual-regression / screenshot diffing** — the preview GIFs are manual review aids, not assertions.
- **Rate-limit / size-cap tests** — those land with the controls they cover (Phase 10).
- **Component unit tests** for the Phase 3 design kit beyond incidental smoke coverage — a later add.
- **Tests for flows not yet built** (create / vote / results) — added as Phases 5–7 land; this phase sets up
  the harness and the Phase 4 coverage, not future-phase assertions. When Results lands, add the §9
  assertion that the Results API never sources `AuditLog`.

## Spec references

§5 (access control), §6 (slug), §7 (auth / `email_verified` gate), §9 (anonymity guard — Results must never
source the audit log; assert when Phase 7 lands).
