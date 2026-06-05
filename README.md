# Herd Scheduler

A self-hostable group availability poll. Pick a few candidate times, share a link, and let
people mark yes / maybe / no — then see the best-fit slot.

This repo is built in phases (see [`docs/plans/phases/`](docs/plans/phases/)). **Phase 1
(scaffold + container baseline) is done.** This README covers the one-time setup needed to run
it locally or in a container.

- Stack: Next.js (App Router, TS) · Prisma + PostgreSQL · Auth.js v5 (Google) · Tailwind
- Package manager: **pnpm** · Task runner: **[go-task](https://taskfile.dev)** (optional)

---

## Quick start

```bash
cp .env.example .env        # then fill it in — see the two setup guides below
pnpm install                # installs deps; runs `prisma generate`
docker compose up           # local dev Postgres on :5432 (Ctrl+C to stop)
pnpm migrate:dev            # in another shell: applies migrations
pnpm dev                    # http://localhost:3000
```

`docker compose up` runs **only a local Postgres** (default port 5432, data kept in a
named volume) in the foreground — Ctrl+C stops it, nothing lingers in the background. The app
runs on the host via `pnpm dev`. You can point `DATABASE_URL` at any other Postgres instead and
skip compose entirely. Production portability is proven by the [`Dockerfile`](Dockerfile)
(`docker build`), not compose — see [tech spec §4](docs/plans/initial-tech-spec.md).

You need two external things set up before sign-in works: a **Google OAuth client** and a
**PostgreSQL database**. Both are one-time, few-minute tasks — guides below.

---

## Environment variables

Copy `.env.example` → `.env` and fill these in (every variable is from tech spec §4):

| Variable | Required | What it is |
|----------|----------|------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string. Local dev (the compose Postgres) uses `postgres://app:app@localhost:5432/scheduler`. |
| `DIRECT_URL` | pooler-only | Direct (non-pooled) URL for migrations when `DATABASE_URL` points at a pooler. See [Supabase](#database-setup-supabase). |
| `AUTH_SECRET` | ✅ | Session signing secret. Generate with `openssl rand -base64 32`. |
| `AUTH_URL` | ✅ | Public base URL of the deployment. Must match a Google redirect URI. Local: `http://localhost:3000`. |
| `AUTH_TRUST_HOST` | self-hosted | Set `true` on any non-Vercel deployment so Auth.js validates OAuth callbacks against `AUTH_URL`'s origin. Without it, Google sign-in fails with a missing `iss` error. `.env.example` sets it to `true`. |
| `GOOGLE_CLIENT_ID` | ✅ | From the Google OAuth client. See [Google OAuth](#google-oauth-setup). |
| `GOOGLE_CLIENT_SECRET` | ✅ | From the Google OAuth client. |
| `OWNER_EMAIL` | Phase 4 | Bootstrap admin/allowlist owner (seeded on first boot, later phase). |
| `APP_TIMEZONE` | ✅ | Default poll display timezone, IANA name (e.g. `America/New_York`). |

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
4. **Copy the Client ID and Client secret** into `.env`:
   ```dotenv
   GOOGLE_CLIENT_ID=...apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=...
   AUTH_URL=http://localhost:3000
   ```

> Redirect URIs must match `AUTH_URL` **exactly** (scheme, host, port, no trailing slash).
> A mismatch is the most common cause of `redirect_uri_mismatch` errors.

### Verify sign-in

Start the app (`pnpm dev`, with the compose Postgres running), open `http://localhost:3000`,
and click **Continue with Google**. A successful round-trip returns to the home page showing
"Signed in as …". (This is Phase 1 acceptance criterion 4, and is the one check that isn't
scriptable — it needs a human at the consent screen.)

---

## Database setup (Supabase)

Any PostgreSQL works — the app only needs a `DATABASE_URL`, no provider-specific features. For a
managed option, Supabase's free tier is a good fit. (You do **not** need Terraform or any IaC to
provision this; it's a couple of clicks.)

1. **Create a project** at [supabase.com](https://supabase.com/dashboard) and set a database
   password. Wait for it to finish provisioning.
2. **Grab the connection strings** from Project Settings → **Database** → *Connection string*.
   Supabase gives you two that matter here:
   - **Pooled** (Supavisor, transaction mode, port **6543**) — use for `DATABASE_URL`. Add
     `?pgbouncer=true` so Prisma disables prepared statements.
   - **Direct** (port **5432**) — use for `DIRECT_URL`. Prisma needs a direct connection to run
     migrations; the pooler can't.
3. **Set them in `.env`** (replace `[PASSWORD]`, `[REF]`, `[REGION]`):
   ```dotenv
   DATABASE_URL=postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
   DIRECT_URL=postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
   ```
   For a plain self-hosted/local Postgres, just set `DATABASE_URL` and leave `DIRECT_URL` empty.
4. **Apply migrations:**
   ```bash
   pnpm migrate:deploy        # apply existing migrations (prod-style)
   # or, while developing the schema:
   pnpm migrate:dev
   ```

> **Portability note:** Supabase is one supported reference, not the target. Don't introduce
> Supabase-only code paths — the app must run against any Postgres via `DATABASE_URL`.

---

## Task shortcuts

An optional [`Taskfile.yml`](Taskfile.yml) wraps the common commands. With
[go-task](https://taskfile.dev/installation/) installed:

```bash
task db        # start the dev Postgres (foreground)
task migrate   # create + apply a dev migration
task dev       # run the Next.js dev server
task --list    # see all tasks
```

To produce and check the portable production build directly:

```bash
pnpm build && test -d .next/standalone   # standalone server artifact
docker build -t herd-scheduler .         # the self-contained image
```

---

## Project docs

- [`docs/plans/initial-tech-spec.md`](docs/plans/initial-tech-spec.md) — product + technical spec (source of truth).
- [`docs/plans/phases/`](docs/plans/phases/) — the 8-phase implementation plan.
- [`docs/design/Herd Scheduler/`](docs/design/) — design system handoff (read-only).
- [`CLAUDE.md`](CLAUDE.md) — working notes / commands for contributors.
