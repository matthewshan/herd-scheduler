# Deployment guide

How to run Herd Scheduler in production. The architecture and portability
rules live in the tech spec ([§4](plans/initial-tech-spec.md)); this is the
operational runbook. The app is one container image plus any PostgreSQL
reachable through `DATABASE_URL` — nothing host-specific.

## The images

CI ([`.github/workflows/publish-image.yml`](../.github/workflows/publish-image.yml))
builds the `Dockerfile` and pushes **two targets** to GitHub Container
Registry on every merge to `main` (and on `v*.*.*` tags):

| Image | Dockerfile target | Purpose |
|---|---|---|
| `ghcr.io/matthewshan/herd-scheduler:latest` | `runner` (default) | The app. Non-root (`nextjs`, uid 1001), no build tooling, runs `node server.js` on port 3000. |
| `ghcr.io/matthewshan/herd-scheduler:latest-migrate` | `migrate` | One-shot `prisma migrate deploy`. Run it to completion against the same `DATABASE_URL` **before** rolling the app. |

Merges also publish immutable `:sha-<shortsha>` / `:sha-<shortsha>-migrate`
tags; release tags publish `:X.Y.Z` / `:X.Y.Z-migrate`. Pin the sha or semver
tags in real deployments; `latest` is for convenience.

Build locally with `docker build -t herd-scheduler .` (and
`--target migrate` for the migration image).

## Migrations are a one-shot

The app container never migrates — it only serves. Apply schema changes by
running the migrate image to completion first:

```sh
docker run --rm -e DATABASE_URL=postgres://… ghcr.io/matthewshan/herd-scheduler:latest-migrate
```

On Kubernetes this is a pre-deploy `Job` (in the home deployment, a
sync-wave-gated ArgoCD `Job` that must complete before the app's wave — see
Reference C); on a PaaS it's a release/CI step. `prisma
migrate deploy` is idempotent: applying zero pending migrations is a no-op,
so running it on every deploy is safe.

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Any Postgres connection string. |
| `DIRECT_URL` | pooler setups only | Direct (non-pooled) connection for migrations — Reference B. |
| `AUTH_SECRET` | yes | `openssl rand -base64 32`. |
| `AUTH_URL` | yes | Public base URL; must match a Google OAuth redirect URI. |
| `AUTH_TRUST_HOST` | yes off-Vercel | `true` behind any TLS-terminating proxy (Cloudflare Tunnel). |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | yes | Redirect URI: `<AUTH_URL>/api/auth/callback/google`. |
| `OWNER_EMAIL` | yes | Bootstrap owner/admin; seeded on sign-in or `pnpm db:seed`. |
| `ALLOWLIST_ENABLED` | no (default `true`) | `false` lets any verified Google login create polls. |
| `APP_TIMEZONE` | no | Default poll display timezone (IANA). |
| `RATE_LIMIT_CREATE_MAX` / `RATE_LIMIT_CREATE_WINDOW_SECONDS` | no | Poll creation per creator; default 20 per 3600s. |
| `RATE_LIMIT_VOTE_MAX` / `RATE_LIMIT_VOTE_WINDOW_SECONDS` | no | Vote submits per client IP; default 30 per 60s. |
| `MAX_POLLS_PER_CREATOR` | no (default 100) | Lifetime row cap per creator. |
| `MAX_SLOTS_PER_POLL` | no (default 60) | Time options per poll. |
| `MAX_PARTICIPANTS_PER_POLL` | no (default 250) | Distinct voters per poll. |
| `ENABLE_DEV_LOGIN` | never in prod | Dev-only sign-in bypass; ignored in production builds. |

Rate limits are enforced **per replica** (in-process memory, no external
service — the portability trade-off): N replicas raise the effective ceiling
N×. Size caps are DB row counts and replica-independent.

## Statelessness

The app keeps no local disk state: sessions are database rows (Auth.js
database strategy), uploads don't exist, and fonts/icons are baked into the
image. Any number of replicas can run behind any load balancer with no
sticky-session requirement. The runtime filesystem can be read-only except
for `/tmp`.

## Reference A — any container runtime + Postgres

The committed `docker-compose.yml` is **dev-only** (local Postgres, app on
the host). A production compose shape:

```yaml
services:
  migrate:
    image: ghcr.io/matthewshan/herd-scheduler:latest-migrate
    environment:
      DATABASE_URL: postgres://app:app@db:5432/scheduler
    depends_on: [db]
    restart: "no"
  app:
    image: ghcr.io/matthewshan/herd-scheduler:latest
    environment:
      DATABASE_URL: postgres://app:app@db:5432/scheduler
      AUTH_SECRET: …
      AUTH_URL: https://your.domain
      AUTH_TRUST_HOST: "true"
      GOOGLE_CLIENT_ID: …
      GOOGLE_CLIENT_SECRET: …
      OWNER_EMAIL: you@example.com
    ports: ["3000:3000"]
    depends_on:
      migrate:
        condition: service_completed_successfully
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
      POSTGRES_DB: scheduler
    volumes: ["pgdata:/var/lib/postgresql/data"]
volumes: { pgdata: {} }
```

The same two images drop into any managed container service; the migrate
image becomes whatever "run a task before deploy" primitive the platform has.

## Reference B — Vercel + Supabase (serverless)

Serverless opens many short-lived connections, so:

- `DATABASE_URL` = Supabase **pooled** connection — port `6543`,
  `?pgbouncer=true&connection_limit=1`.
- `DIRECT_URL` = the **direct** connection (port `5432`) — Prisma uses it for
  migrations only.
- Run `prisma migrate deploy` as a CI step (the migrate image, or
  `pnpm migrate:deploy` with both URLs set).
- Register the production domain's redirect URI in Google Cloud Console and
  set `AUTH_URL` to it — preview URLs rotate, so test auth on a stable domain.

## Reference C — self-hosted k3s + LAN Postgres (the home deployment)

The primary target. All cluster wiring lives in the owner-managed
[`k3s-homelab`](https://github.com/matthewshan/k3s-homelab) repo
(`applications/herd-scheduler/`); this repo only fixes the contract:

- **Image** pulled from `ghcr.io` (published by this repo's CI) — no
  in-cluster builds.
- **Postgres on the private LAN**, outside the cluster (a VM — provisioning
  is automated in `k3s-homelab`'s Ansible playbook). Direct connection, so
  `DIRECT_URL` stays unset.
- **Migrations**: the `-migrate` image as a **sync-wave-gated ArgoCD `Job`**
  (an earlier wave than the `Deployment`, replaced each sync) — it must
  succeed before the new app pods roll.
- **Public HTTPS via Cloudflare Tunnel**: TLS terminates at the edge, the app
  speaks plain HTTP in-cluster. `AUTH_URL` = the public domain,
  `AUTH_TRUST_HOST=true`.
- **Secrets** (`DATABASE_URL`, `AUTH_SECRET`, Google credentials) come from
  the cluster's secret manager (External Secrets); plain config
  (`AUTH_URL`, `OWNER_EMAIL`, `ALLOWLIST_ENABLED`, …) rides on the
  `Deployment` env.
- **OAuth**: register `<AUTH_URL>/api/auth/callback/google` in Google Cloud
  Console.
