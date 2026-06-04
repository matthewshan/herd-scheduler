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
pnpm migrate:dev            # applies migrations to your DATABASE_URL
pnpm dev                    # http://localhost:3000
```

Or run the whole thing in containers (Postgres + migrate + app), no local Node needed:

```bash
docker compose up           # http://localhost:3000
```

You need two external things set up before sign-in works: a **Google OAuth client** and a
**PostgreSQL database**. Both are one-time, few-minute tasks — guides below.

---

## Environment variables

Copy `.env.example` → `.env` and fill these in (every variable is from tech spec §4):

| Variable | Required | What it is |
|----------|----------|------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string. Local compose uses `postgres://app:app@db:5432/scheduler`. |
| `DIRECT_URL` | pooler-only | Direct (non-pooled) URL for migrations when `DATABASE_URL` points at a pooler. See [Supabase](#database-setup-supabase). |
| `AUTH_SECRET` | ✅ | Session signing secret. Generate with `openssl rand -base64 32`. |
| `AUTH_URL` | ✅ | Public base URL of the deployment. Must match a Google redirect URI. Local: `http://localhost:3000`. |
| `AUTH_TRUST_HOST` | self-hosted | Set `true` on any non-Vercel deployment so Auth.js validates OAuth callbacks against `AUTH_URL`'s origin. Without it, Google sign-in fails with a missing `iss` error. The compose path defaults it to `true`. |
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

Start the app (`pnpm dev` or `docker compose up`), open `http://localhost:3000`, and click
**Continue with Google**. A successful round-trip returns to the home page showing
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

## Validating Phase 1

A [`Taskfile.yml`](Taskfile.yml) wraps the scripted Phase 1 acceptance checks. With
[go-task](https://taskfile.dev/installation/) installed:

```bash
task validate:phase-1      # lint, build, docker compose up, robots header, DB-connected
task --list                # see all tasks
```

This covers acceptance criteria 1, 2, 3, and 5. Criterion 4 (the Google sign-in round-trip) is
manual — see [Verify sign-in](#verify-sign-in) above. The full criteria live in
[`docs/plans/phases/phase-1-scaffold.md`](docs/plans/phases/phase-1-scaffold.md).

Without go-task, the equivalent steps are:

```bash
pnpm build && test -d .next/standalone            # AC 2
docker compose up -d --build                       # AC 3
curl -sI http://localhost:3000 | grep -i x-robots  # AC 5
curl -s  http://localhost:3000 | grep -i connected # AC 3 (DB wire)
```

---

## Project docs

- [`docs/plans/initial-tech-spec.md`](docs/plans/initial-tech-spec.md) — product + technical spec (source of truth).
- [`docs/plans/phases/`](docs/plans/phases/) — the 8-phase implementation plan.
- [`docs/design/Herd Scheduler/`](docs/design/) — design system handoff (read-only).
- [`CLAUDE.md`](CLAUDE.md) — working notes / commands for contributors.
