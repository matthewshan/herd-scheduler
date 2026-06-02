# Phase 1 — Scaffold + container baseline

> Part of the [phased implementation plan](README.md). Read the shared rules in that README before starting.

## Goal

Stand up a running Next.js app and prove the portable container path on day one. After this phase,
`npm run dev` serves a page locally and `docker compose up` brings the app up against Postgres — so every
later phase builds on a deployment story that already works.

## Depends on

Nothing. This is the first phase.

## Scope

- **Next.js (App Router, TypeScript)** initialized at the repo root, configured with
  `output: 'standalone'` in `next.config` (required for the portable image — see spec §4).
- **Tailwind CSS** installed and wired (base config + global stylesheet only). Do **not** plumb the design
  tokens yet — that is Phase 2. A plain default Tailwind setup is enough here.
- **Prisma** initialized against a single `DATABASE_URL`. Add one trivial placeholder model (e.g. a
  `HealthCheck` row, or a minimal `User` stub) purely to prove the DB wire end-to-end with a working
  migration. The full schema lands in Phase 4 — keep this minimal and expect it to be replaced.
- **Auth.js v5 (NextAuth)** installed and configured with the **Google provider** (`openid`, `email`,
  `profile` scopes only). Wire the route handler and a basic sign-in entry point. **No allowlist gate yet**
  and **no Prisma adapter yet** — JWT session strategy is fine for now; persistence + the allowlist arrive
  in Phase 4. The aim is a working "Continue with Google" round-trip, not the full access model.
- **ESLint + Prettier** configured to match a conventional Next.js + TypeScript setup.
- **`.env.example`** listing every variable from spec §4 with placeholder values and a one-line comment each:
  `DATABASE_URL`, `DIRECT_URL` (optional, pooler-only), `AUTH_SECRET`, `AUTH_URL`, `GOOGLE_CLIENT_ID`,
  `GOOGLE_CLIENT_SECRET`, `OWNER_EMAIL`, `APP_TIMEZONE`.
- **Privacy headers:** global `X-Robots-Tag: noindex, nofollow` on every response (via `next.config`
  headers or middleware) plus a `<meta name="robots" content="noindex,nofollow">` fallback in the root
  layout. No `sitemap.xml`. (Spec §9.)
- **Minimal multi-stage `Dockerfile`** — install deps → `next build` (standalone) → copy the standalone
  server into a slim runtime image and `node server.js`. Keep it simple; hardening (non-root, slimming,
  migrations entrypoint) is Phase 8.
- **`docker-compose.yml`** with `app` + `postgres:16` services matching the sketch in spec §4 (env vars,
  `depends_on`, a named `pgdata` volume). This is the canonical "anyone can run it" path.

## Files to create / touch

- `package.json`, `tsconfig.json`, `next.config.*`, `tailwind.config.*`, `postcss.config.*`
- `app/layout.tsx`, `app/page.tsx`, `app/globals.css`
- `app/api/auth/[...nextauth]/route.ts` (or the v5 `auth.ts` + handler convention)
- `auth.ts` / `auth.config.ts` (Auth.js v5 config)
- `prisma/schema.prisma`, `prisma/migrations/**`
- `.env.example`, `.eslintrc.*` / `eslint.config.*`, `.prettierrc*`
- `Dockerfile`, `docker-compose.yml`, `.dockerignore`
- Update `CLAUDE.md`: replace the "pre-implementation / no build commands" note once scaffolding lands
  (record the real `dev`/`build`/`test`/`migrate` commands).

## Reuse from design bundle

None strictly required this phase — this is plumbing. (Tokens, fonts, icons, and components all arrive in
Phases 2–3.) Do not pull in CDN fonts/icons even temporarily; Phase 2 self-hosts them.

## Acceptance criteria

- `npm run dev` serves a page with no console errors.
- `npm run build` produces a standalone build.
- `docker compose up` starts `app` + `db`; the app boots and successfully connects to Postgres (the
  placeholder model's migration applies).
- A "Continue with Google" round-trip completes against a real OAuth client (documented in `.env.example`).
- Every HTTP response carries `X-Robots-Tag: noindex, nofollow`; the root layout includes the robots meta.
- `.env.example` lists all spec §4 variables.

## Out of scope

- Design tokens / Tailwind theme plumbing (Phase 2).
- Any kit components or real screens (Phase 3+).
- Full Prisma schema, Auth.js Prisma adapter, allowlist, owner bootstrap (Phase 4).
- Dockerfile hardening, migrations-as-entrypoint, rate limiting, deploy docs (Phase 8).

## Spec references

§3 (tech stack), §4 (deployment & portability, env vars, compose sketch), §7 (Google scopes),
§9 (noindex), §10 milestone 1.
