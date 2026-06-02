# Next steps

Quick orientation for picking this back up. Phase 1 (scaffold + container baseline)
is done and lives on the `feat/phase-1-scaffold` branch.

## 1. Things only you can do (need real accounts/secrets)

- [ ] **Create the Google OAuth web client** (free — no billing, no verification for
      `openid`/`email`/`profile`):
  1. [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
     → Create OAuth client ID → Web application.
  2. Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
     (add your deployed domain's `…/api/auth/callback/google` later too).
  3. `cp .env.example .env`, then fill `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
     and `AUTH_SECRET` (`openssl rand -base64 32`).
- [ ] **Test the sign-in round-trip:** `pnpm dev` → http://localhost:3000 →
      "Continue with Google" → confirm you land back signed in.

## 2. Verify the build paths (already green on my machine)

- [ ] `pnpm install && pnpm dev` — page loads, no console errors.
- [ ] `pnpm build` — standalone build succeeds.
- [ ] `docker compose up --build` — Postgres + migrate + app come up; home page shows
      "Database: connected".

## 3. Land Phase 1

- [ ] Open a PR from `feat/phase-1-scaffold` → `main` (or merge directly).

## 4. Infrastructure (separate repo)

- [ ] Review/merge the draft PR adding the Terraform module:
      [`cloud-infrastructure#3`](https://github.com/matthewshan/cloud-infrastructure/pull/3)
      (Supabase Postgres + GCP OAuth prerequisites).
- [ ] When you apply it: create the HCP workspace `terraform-herd-scheduler`, set
      `GOOGLE_CREDENTIALS` + `SUPABASE_ACCESS_TOKEN` as sensitive env vars, then use
      `terraform output -raw database_url` for the deployment's `DATABASE_URL`.

## 5. Next implementation phase

- [ ] **Phase 2 — design tokens, theming, fonts & icons**
      (`docs/plans/phases/phase-2-design-tokens.md`): plumb the tokens from
      `docs/design/Herd Scheduler/colors_and_type.css` into Tailwind, wire the
      `data-theme` light/dark toggle, self-host Space Grotesk + Inter, add Lucide.

> Delete this file once Phase 1 is merged — it's a working checkpoint, not docs.
