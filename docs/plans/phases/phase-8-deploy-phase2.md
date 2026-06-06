# Phase 8 — Deploy hardening + Phase 2 backlog

> Part of the [phased implementation plan](README.md). Read the shared rules in that README before starting.

## Goal

Take the day-one container from Phase 1 to production quality, document the portable deployment paths, add
the security hardening the spec calls for, and capture the post-MVP (Phase 2) features as clearly-marked
future work orders — **without building them here**.

## Depends on

Phase 7 (MVP feature-complete). Hardening work touches the Phase 1 Dockerfile/compose.

## Scope — MVP-completing (build this)

- **Harden the Dockerfile:** slim multi-stage build, run as **non-root**, ship no build tooling to the
  runtime image, copy only the standalone server. Keep the image small.
- **Migrations as a one-shot:** `prisma migrate deploy` as an entrypoint step / init container / CI step —
  not tied to any platform. Document the chosen approach.
- **Abuse hardening (preventive controls):**
  - **Rate-limit** poll creation and voting (portable, no host-specific service).
  - **Size caps** (env-tunable, portable): per-creator poll count, per-poll time-option count, per-poll
    participant count. Input-size guards that bound runaway abuse, complementing the Phase 4 audit log +
    blocklist (detective + reactive) and the `ALLOWLIST_ENABLED` gate.
- **Stateless verification:** confirm no local disk state — sessions in the JWT cookie or DB — so N
  replicas run behind any load balancer.
- **Deployment docs:**
  - **Reference A — any container runtime + Postgres** (the compose path; note k3s Deployment/Service/
    Ingress equivalence).
  - **Reference B — Vercel + Supabase:** pooled connection for `DATABASE_URL` (port `6543`,
    `?pgbouncer=true&connection_limit=1`) and the **direct** connection as Prisma `directUrl` (`5432`) for
    migrations. Note the OAuth redirect-URI-per-domain gotcha and setting `AUTH_URL` to match.
  - Finalize `.env` documentation (all of spec §4's vars, when `DIRECT_URL` is needed).

## Scope — Phase 2 backlog (document only, do **not** implement)

Create short stub briefs (in this folder or a `phase-2-backlog/` subfolder) marking each as **post-MVP**:

- **"View in my local timezone" toggle** — per-viewer conversion from the poll's tz to the viewer's zone.
- **Poll expiry / auto-close** — exposed as a plain authenticated endpoint or CLI command, triggered by
  whatever scheduler the host has (k8s CronJob, system cron, Vercel Cron). Portable; no host-specific code.
- **Email notifications** (new vote, poll finalized) — **provider still open** (spec §11 Q1: Resend / SES /
  SMTP). The brief should note the provider decision must be made before implementation.

## Files to create / touch

- `Dockerfile` (harden), `docker-compose.yml` (tighten), `.dockerignore`
- Entrypoint / init script for `prisma migrate deploy`
- `lib/rate-limit.ts` (or middleware) applied to create + vote actions
- Size-cap checks in the create + vote server actions (env-tunable limits)
- `docs/` deployment guide(s) — or expand spec §4 in place
- `docs/plans/phases/phase-2-backlog/*.md` (or equivalent) — the three stub briefs

## Reuse from design bundle

None — this is ops/infra and backlog documentation.

## Acceptance criteria

- The hardened image runs as a **non-root** user and contains no build tooling.
- `prisma migrate deploy` runs as a documented one-shot against a fresh DB.
- Rate limits are enforced on poll creation and voting (verify by exceeding the limit).
- Size caps are enforced (exceeding per-creator poll / per-poll option / per-poll participant limits is
  rejected with a clear error).
- Both deployment references are documented and the compose path is validated end-to-end.
- The three Phase 2 features exist as clearly-marked future briefs; the email brief flags the open provider
  decision (spec §11).

## Out of scope

- Implementing any Phase 2 feature (timezone toggle, expiry, notifications) — they are documented only.

## Spec references

§2 (Phase 2 features), §4 (deployment, portability, env vars, both reference setups), §9 (rate limiting),
§10 milestone 6, §11 (open questions — email provider).
