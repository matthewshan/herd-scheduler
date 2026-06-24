# Herd Scheduler

A self-hostable group availability poll. Pick a few candidate times, share a link, and let
people mark yes / maybe / no — then see the best-fit slot.

The app is feature-complete: create + share polls, vote (signed-in or as a guest), live results
with best-fit scoring, host finalize, and per-poll anonymity. It ships as a single portable
container image plus any PostgreSQL reachable through `DATABASE_URL` — nothing host-specific.

- Stack: Next.js (App Router, TS) · Prisma + PostgreSQL · Auth.js v5 (Google) · Tailwind
- Package manager: **pnpm** · Task runner: **[go-task](https://taskfile.dev)** (optional)

**Two ways in:**

- [**Self-hosting (production)**](#self-hosting-production) — run the published container image
  against your own Postgres. Start here if you just want to host it.
- [**Local development**](#local-development) — run the app from source with `pnpm`.

Both paths need the same two external things set up once: a **Google OAuth client**
([guide](#google-oauth-setup)) and a **PostgreSQL database** ([guide](#database-setup)).

---

## Self-hosting (production)

You don't need to build anything. CI publishes two images to GitHub Container Registry on every
release — the app and a one-shot migration runner:

| Image | Purpose |
|---|---|
| `ghcr.io/matthewshan/herd-scheduler:latest` | The app. Non-root, runs `node server.js` on port `3000`. |
| `ghcr.io/matthewshan/herd-scheduler:latest-migrate` | One-shot `prisma migrate deploy`. Run to completion **before** the app, on each deploy. |

Pin an immutable tag in real deployments (`:X.Y.Z` from a release, or `:sha-<shortsha>` from a
merge); `latest` is for convenience. The app container **never migrates** — it only serves — so
you always run the migrate image first. `prisma migrate deploy` is idempotent, so running it on
every deploy is safe (zero pending migrations is a no-op).

### Quickest path: docker compose

This is enough to stand up the whole stack — Postgres, a migration pass, and the app — on one
host. (The committed `docker-compose.yml` is **dev-only**; this is a separate production shape.)

```yaml
# compose.prod.yml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: change-me
      POSTGRES_DB: scheduler
    volumes: ["pgdata:/var/lib/postgresql/data"]

  migrate:
    image: ghcr.io/matthewshan/herd-scheduler:latest-migrate
    environment:
      DATABASE_URL: postgres://app:change-me@db:5432/scheduler
    depends_on: [db]
    restart: "no"

  app:
    image: ghcr.io/matthewshan/herd-scheduler:latest
    environment:
      DATABASE_URL: postgres://app:change-me@db:5432/scheduler
      AUTH_SECRET: "REPLACE — openssl rand -base64 32"
      AUTH_URL: https://your.domain
      AUTH_TRUST_HOST: "true"
      GOOGLE_CLIENT_ID: ...apps.googleusercontent.com
      GOOGLE_CLIENT_SECRET: ...
      OWNER_EMAIL: you@example.com
    ports: ["3000:3000"]
    depends_on:
      migrate:
        condition: service_completed_successfully
volumes: { pgdata: {} }
```

```bash
docker compose -f compose.prod.yml up -d
```

`app` waits for `migrate` to finish before it starts. Put a TLS-terminating proxy
(Caddy, nginx, Cloudflare Tunnel, …) in front of port `3000` and point `AUTH_URL` at the public
HTTPS URL. The app is stateless — sessions are database rows, fonts/icons are baked into the
image — so you can run any number of replicas behind any load balancer with no sticky sessions.

### Other targets

The same two images drop into any container platform; the migrate image becomes whatever
"run a task before deploy" primitive that platform offers (a Kubernetes `Job`, a PaaS release
command, a CI step). [`docs/deployment.md`](docs/deployment.md) is the full runbook and covers
three reference deployments in detail:

- **Reference A** — any container runtime + Postgres (the compose shape above).
- **Reference B** — Vercel + Supabase (serverless; needs `DIRECT_URL` for migrations).
- **Reference C** — self-hosted k3s + LAN Postgres behind a Cloudflare Tunnel (the home target).

### Build the image yourself

If you'd rather not pull from `ghcr.io`:

```bash
docker build -t herd-scheduler .                    # the app image
docker build -t herd-scheduler-migrate --target migrate .   # the migration runner
```

---

## Environment variables

Every variable the app reads. For local dev, copy `.env.example` → `.env` and fill it in; in a
container, pass them as environment.

| Variable | Required | What it is |
|----------|----------|------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string. Local dev (the compose Postgres) uses `postgres://app:app@localhost:5432/scheduler`. |
| `DIRECT_URL` | pooler-only | Direct (non-pooled) URL for migrations when `DATABASE_URL` points at a pooler (e.g. Supabase). Leave empty for a direct connection. |
| `AUTH_SECRET` | ✅ | Session signing secret. Generate with `openssl rand -base64 32`. |
| `AUTH_URL` | ✅ | Public base URL of the deployment. Must match a Google redirect URI. Local: `http://localhost:3000`. |
| `AUTH_TRUST_HOST` | self-hosted | Set `true` on any non-Vercel deployment so Auth.js validates OAuth callbacks against `AUTH_URL`'s origin. Without it, Google sign-in fails with a missing `iss` error. |
| `GOOGLE_CLIENT_ID` | ✅ | From the Google OAuth client. See [Google OAuth](#google-oauth-setup). |
| `GOOGLE_CLIENT_SECRET` | ✅ | From the Google OAuth client. |
| `OWNER_EMAIL` | ✅ | Bootstrap owner/admin (seeded on first sign-in or `pnpm db:seed`); always allowed to create polls and reach `/admin`. |
| `ALLOWLIST_ENABLED` | no (default `true`) | `true` = poll creation requires an allowlist row; `false` = any *verified* Google login can create. The owner always passes; the blocklist + email-verified gate always apply. |
| `APP_TIMEZONE` | no | Default poll display timezone, IANA name (e.g. `America/New_York`). |
| `RATE_LIMIT_CREATE_MAX` / `RATE_LIMIT_CREATE_WINDOW_SECONDS` | no | Poll creation per creator; default 20 per 3600s. |
| `RATE_LIMIT_VOTE_MAX` / `RATE_LIMIT_VOTE_WINDOW_SECONDS` | no | Vote submits per client IP; default 30 per 60s. |
| `MAX_POLLS_PER_CREATOR` | no (default 100) | Lifetime poll cap per creator. |
| `MAX_SLOTS_PER_POLL` | no (default 60) | Time options per poll. |
| `MAX_PARTICIPANTS_PER_POLL` | no (default 250) | Distinct voters per poll. |
| `ENABLE_DEV_LOGIN` | **never in prod** | Dev-only sign-in bypass (`GET /api/dev/login?email=…`). Ignored in production builds; leave unset/false everywhere real. |

Rate limits are enforced **per app replica** (in-process memory, no external service): N replicas
raise the effective ceiling N×. Size caps are DB row counts and replica-independent.

---

## Google OAuth setup

Auth.js signs users in with Google using basic scopes only (`openid`, `email`, `profile`) — no
Google app verification is needed for personal/internal use. Takes about five minutes.

1. **Open [Google Cloud Console](https://console.cloud.google.com/)** and create (or pick) a
   project. Anything will do — there's no billing or API enablement required for basic OIDC.
2. **Configure the OAuth consent screen** (APIs & Services → OAuth consent screen):
   - User type **External**, publishing status **Testing** is fine for personal use.
   - Fill in app name + support email. You can skip scopes (the defaults cover `openid`,
     `email`, `profile`).
   - Under **Test users**, add every Google account that will sign in while the app is in
     Testing mode.
3. **Create credentials** (APIs & Services → Credentials → Create credentials → OAuth client ID):
   - Application type: **Web application**.
   - **Authorized redirect URIs** — add one per origin you'll use, each in the form
     `<AUTH_URL>/api/auth/callback/google`:
     - `http://localhost:3000/api/auth/callback/google` (local dev / compose)
     - `https://your-domain/api/auth/callback/google` (production)
   - You usually don't need "Authorized JavaScript origins" for this server-side flow.
4. **Copy the Client ID and Client secret** into your env:
   ```dotenv
   GOOGLE_CLIENT_ID=...apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=...
   AUTH_URL=http://localhost:3000
   ```

> Redirect URIs must match `AUTH_URL` **exactly** (scheme, host, port, no trailing slash).
> A mismatch is the most common cause of `redirect_uri_mismatch` errors.

### First sign-in and the owner

`OWNER_EMAIL` is bootstrapped on its first sign-in (and by `pnpm db:seed`) — that account always
passes the creator gate and can reach the owner-only `/admin` screen. With
`ALLOWLIST_ENABLED=true` (the default), every **other** account needs an allowlist entry to
create polls; set `ALLOWLIST_ENABLED=false` to let any verified Google login create. Anyone can
vote without an account (guest voting).

---

## Database setup

Any PostgreSQL works — the app only needs a `DATABASE_URL`, with no provider-specific features.

**Self-hosted / local Postgres (most setups).** Point `DATABASE_URL` at a direct connection and
leave `DIRECT_URL` empty. The production compose above runs Postgres for you; otherwise use your
own server. Apply migrations with the migrate image (`...:latest-migrate`) or, from source,
`pnpm migrate:deploy`.

**Managed Postgres behind a pooler (e.g. Supabase).** A pooler can't run migrations, so split the
URLs — pooled for the app, direct for migrations:

1. **Create a project** at [supabase.com](https://supabase.com/dashboard) and set a database
   password. Wait for it to finish provisioning.
2. **Grab both connection strings** from Project Settings → **Database** → *Connection string*:
   - **Pooled** (Supavisor, transaction mode, port **6543**) → `DATABASE_URL`. Add
     `?pgbouncer=true` so Prisma disables prepared statements.
   - **Direct** (port **5432**) → `DIRECT_URL`, used for migrations only.
3. **Set them** (replace `[PASSWORD]`, `[REF]`, `[REGION]`):
   ```dotenv
   DATABASE_URL=postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
   DIRECT_URL=postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
   ```
4. **Apply migrations:** `pnpm migrate:deploy` (or the migrate image) with both URLs set.

> **Portability note:** Supabase is one supported reference, not the target. The app must run
> against any Postgres via `DATABASE_URL` — don't introduce Supabase-only code paths.

---

## Local development

For running the app from source.

```bash
cp .env.example .env        # then fill it in — see Google OAuth + Database above
pnpm install                # installs deps; runs `prisma generate`
docker compose up           # local dev Postgres on :5432 (Ctrl+C to stop)
pnpm migrate:dev            # in another shell: applies migrations
pnpm dev                    # http://localhost:3000
```

`docker compose up` runs **only a local Postgres** (default port 5432, data kept in a named
volume) in the foreground — Ctrl+C stops it, nothing lingers. The app runs on the host via
`pnpm dev`. You can point `DATABASE_URL` at any other Postgres instead and skip compose entirely.

### Common commands

```bash
pnpm dev                 # dev server (http://localhost:3000)
pnpm build && pnpm start # production build, then serve it
pnpm migrate:dev         # create + apply a dev migration
pnpm migrate:deploy      # apply pending migrations (prod-style)
pnpm db:seed             # bootstrap OWNER_EMAIL into the allowlist
pnpm test                # Vitest unit tests
pnpm lint                # ESLint
pnpm format              # Prettier
```

### Verify sign-in

Start the app, open `http://localhost:3000`, and click **Continue with Google**. A successful
round-trip returns to the home page signed in. For testing access-control flows without the
Google round-trip, set `ENABLE_DEV_LOGIN=true` and hit
`GET /api/dev/login?email=test@example.com` (dev builds only — see `CLAUDE.md`).

### Task shortcuts

An optional [`Taskfile.yml`](Taskfile.yml) wraps the common commands. With
[go-task](https://taskfile.dev/installation/) installed:

```bash
task db        # start the dev Postgres (foreground)
task migrate   # create + apply a dev migration
task dev       # run the Next.js dev server
task --list    # see all tasks
```

---

## Project docs

- [`docs/deployment.md`](docs/deployment.md) — production deployment runbook (the three reference targets).
- [`docs/plans/initial-tech-spec.md`](docs/plans/initial-tech-spec.md) — product + technical spec (source of truth).
- [`docs/plans/phases/`](docs/plans/phases/) — the phased implementation plan.
- [`docs/design/Herd Scheduler/`](docs/design/) — design system handoff (read-only).
- [`CLAUDE.md`](CLAUDE.md) — working notes / commands for contributors.
</content>
</invoke>
