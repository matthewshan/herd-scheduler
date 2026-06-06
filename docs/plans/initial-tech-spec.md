# Herd Scheduler — Plan

A Doodle-style availability/scheduling app for a small group of friends. Create a poll with proposed time slots, share a link, everyone marks availability, and the creator picks the time — with the best-fitting slots highlighted. Optional Google login, unindexed/private, mobile-first, and portable to any container runtime + any Postgres.

The visual identity, voice, and screen-level interactions are fixed by the design system in `docs/design/Herd Scheduler/` — that bundle is authoritative for anything user-facing. This document covers everything else: features, stack, data, deployment, access control.

---

## 1. Goals & Constraints

- **Small, private audience** (friends), not a public SaaS — this simplifies auth, scaling, and Google verification.
- **Unindexed / private (decided: Model A).** Not discoverable by search engines (noindex headers, unguessable slugs, no sitemap). The poll link is shareable and loadable by anyone who has it — guest voting stays. See §9.
- **Optional login.** Voting works without an account; creating polls requires login + being allowlisted.
- **Owner-controlled poll creation.** Only emails you approve can create polls.
- **Portable by design.** Ships as a standard container image deployable to any container runtime (Docker, k3s, Cloud Run, Fly, ECS, a VM…) and connects to any PostgreSQL via `DATABASE_URL`. Vercel + Supabase is one supported reference setup, not a hard dependency. See §4.
- **Default timezone: US Eastern (`America/New_York`)**, with the active timezone shown clearly in the UI. Poll creators pick from a fixed list of five zones (ET / CT / MT / PT / GMT).
- **Mobile-first.** Most voting happens on phones; design target is a ~390px frame.
- **Dark mode is first-class.** Light + dark themes with a toggle on every screen, `localStorage` persistence, and `prefers-color-scheme` fallback. Tokens for both themes already live in `docs/design/Herd Scheduler/colors_and_type.css`.
- **Visual identity is fixed.** The design bundle (`docs/design/Herd Scheduler/`) is the source of truth for tokens, components, voice, and screen layouts. Implementation must match it pixel-for-pixel.

---

## 2. Features

### MVP
- Google login (optional for voters, required for creators).
- Allowlist of creator emails, managed by you (owner/admin).
- **Create poll** with: title, description (optional), location (optional), timezone (5-zone picker — ET / CT / MT / PT / GMT — defaults to ET), an integrated **month calendar to multi-select days at once**, and a shared start/end **time-range picker** (30-minute preset dropdown) that becomes the default for the next add — so a host can rapidly tile slots across many days.
- **Per-poll anonymity toggle** at create time. Default: voters' names and avatars are visible on the Results screen. When anonymous, results show aggregate counts only.
- Times displayed with a timezone chip (e.g. "Times shown in Eastern Time · ET") on every screen that lists times.
- Share poll via link (no login required to vote). URL shape: `/p/{slug}` where slug = `kebab(title) + "-" + random5` (e.g. `game-night-x9f2`).
- **Vote per slot** via a 3-way segmented control: **Yes / If-need-be / No**. Tapping the currently-selected segment clears the vote back to "not marked".
- **Guest voting** (display name only) with an **inline Google sign-in** affordance on the same screen — a guest can convert to a logged-in voter without leaving the vote page.
- **Sticky bottom bar** with `N of M marked` progress + a primary Submit; success state collapses to a "Saved — you can update anytime" toast.
- **Results view:** per-slot stacked tally bar, Yes/Maybe/No counts, avatar stack of who can make it (when non-anonymous), best-fit highlight (cerulean ring + "★ Best fit" pill), "Works for everyone" pill when no hard-No.
- **Best-fit scoring formula:** `yes*3 + maybe - no*4`. Top score wins; ties are all highlighted equally. "Works for everyone" is an independent badge that fires whenever `no == 0` on a slot.
- Creator **manually finalizes** the winning slot — highlighting is guidance, never an automatic decision. A finalized banner + per-card marker appears on Results; the host can change the pick.
- **Light + dark theme** with a toggle on every screen's app bar.
- Mobile-first responsive UI (390px target; phone-width column on larger viewports).

### Phase 2
- "View in my local timezone" toggle (convert from the poll's tz to each viewer's zone).
- Poll expiry / auto-close.
- Email notifications (new vote, poll finalized) — provider TBD when this lands.

### Out of scope (for now)
- **Google Calendar integration** (availability overlay, add-to-calendar). Dropped per current decision — can revisit later.

### Nice-to-have / later
- Recurring polls, ranked-choice, comments per slot, ICS export, reminders.

---

## 3. Tech Stack (recommended)

| Concern | Choice | Why |
|---|---|---|
| Framework | **Next.js (App Router, TypeScript)** | One repo, full-stack. `output: 'standalone'` produces a self-contained server image that runs on any container runtime (and deploys to Vercel too). |
| Auth | **Auth.js (NextAuth v5)**, Google provider | Handles OIDC, sessions, and the allowlist gate. Basic sign-in scopes only — no sensitive scopes, so no Google verification needed. |
| Database | **Any PostgreSQL** via **Prisma** (`DATABASE_URL`) | Managed (Supabase, Neon, RDS) or self-hosted — nothing depends on a specific provider's features. |
| Styling | **Tailwind CSS** with the design tokens from `colors_and_type.css` plumbed through `theme.extend` + CSS variables. Optional shadcn/ui for primitives that match the design. | Mobile-first utility classes, fast to build a clean touch UI. |
| Theming | CSS custom properties + a `data-theme` attribute on `<html>`. Initial value comes from `prefers-color-scheme`; user choice persists in `localStorage` (`herd-theme`). | Matches the prototype's mechanism exactly; no extra runtime cost. |
| Icons | **Lucide React** (`lucide-react` npm package) | Production replacement for the prototype's CDN load. Same icon shapes. |
| Fonts | **Space Grotesk** (500/700) for display/heading; **Inter** (400/500/600) for body — self-hosted via `next/font`. | Tabular figures required on all clock times. Self-hosting keeps the container offline-capable. |
| Dates/TZ | **`date-fns` + `date-fns-tz`** (or Luxon) | Reliable UTC↔tz conversion and timezone labels. |
| Data layer | React Server Components + Server Actions | Keeps the API surface small; no separate backend needed for MVP. |
| Slug generation | `slugify` + `nanoid(5)` | `kebab(title) + "-" + nanoid(5)` is human-recognizable and unguessable enough for §9. |

**Alternative considered (database):** MongoDB would work, but the data here is strongly relational — Polls→TimeOptions, Participants→Votes, and a many-to-many between participants and slots. Foreign keys/cascading deletes, joins, and `GROUP BY` aggregations (counting Yes/No/If-need-be per slot) are native in Postgres and have to be hand-rolled or `$lookup`-ed in Mongo. Mongo wins for fluid/nested/denormalized-at-scale data, which this isn't. Any Postgres works — managed or self-hosted.

---

## 4. Deployment & Portability

**Design principle: runs anywhere.** The app ships as a standard container image and talks to any PostgreSQL over a single connection string. No piece depends on a specific host or DB provider — Vercel + Supabase is just one of the reference setups below.

### Portability rules we hold to
- **One container image.** Next.js `output: 'standalone'` + a multi-stage Dockerfile produce a self-contained server (`node server.js`) that runs on Docker, k3s, Cloud Run, Fly, ECS, Render, or a plain VM — anywhere an OCI image runs.
- **Any Postgres.** Connect via `DATABASE_URL`; no provider-specific features used.
- **12-factor config.** Everything via env vars; no host-specific code paths.
- **Stateless app.** No local disk state; sessions in a JWT cookie or the DB, so you can run N replicas behind any load balancer.
- **Migrations as a one-shot.** `prisma migrate deploy` runs as an entrypoint step / init container / CI step — not tied to any platform.
- **Fonts + icons bundled.** Both ship inside the image — no runtime CDN dependency (the design prototype loads them from CDN; production self-hosts).

### Container build (sketch)
Multi-stage Dockerfile: install deps → `next build` (standalone) → copy the standalone server into a slim runtime image, run as non-root. Small image, no build tooling shipped to production.

### Reference deployment A — any container runtime + Postgres
The portable unit is the **image** built from the `Dockerfile` (`docker build`) — it runs on any
container runtime against any `DATABASE_URL`. The repo's committed `docker-compose.yml` is
**dev-only** and starts just a local Postgres (the app runs on the host via `pnpm dev`). The
snippet below illustrates how you'd wire that same image to a Postgres in a compose-style
production deployment:
```yaml
services:
  app:
    image: herd-scheduler:latest
    environment:
      DATABASE_URL: postgres://app:app@db:5432/scheduler
      AUTH_SECRET: ...
      AUTH_URL: https://your.domain
      GOOGLE_CLIENT_ID: ...
      GOOGLE_CLIENT_SECRET: ...
      OWNER_EMAIL: ...
      APP_TIMEZONE: America/New_York
    ports: ["3000:3000"]
    depends_on: [db]
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
      POSTGRES_DB: scheduler
    volumes: ["pgdata:/var/lib/postgresql/data"]
volumes: { pgdata: {} }
```
The same image drops into k3s (Deployment + Service + Ingress) or any managed container service.

### Reference deployment B — Vercel + Supabase (serverless)
Also supported, with one wrinkle: serverless functions open many short-lived connections, so use Supabase's **pooled** connection (port `6543`, `?pgbouncer=true&connection_limit=1`) for `DATABASE_URL` and the **direct** connection (`5432`) as Prisma's `directUrl` for migrations. On a long-running container you don't need this — Prisma pools internally against a direct `DATABASE_URL`.

### Env vars (all deployments)
```
DATABASE_URL=          # any Postgres connection string
DIRECT_URL=            # optional; only when DATABASE_URL points at a pooler (migrations)
AUTH_SECRET=           # Auth.js session signing
AUTH_URL=              # public base URL of this deployment (set explicitly)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
OWNER_EMAIL=           # bootstrap admin/allowlist owner; gets isOwner + admin access in any mode
ALLOWLIST_ENABLED=     # "true" (default) gates poll creation by the AllowedCreator list;
                       # "false" lets any verified Google login create polls
APP_TIMEZONE=America/New_York
```

### Scheduled tasks
Keep them portable: expose poll auto-close as a plain authenticated endpoint or a CLI command, triggered by whatever scheduler the host has (k8s `CronJob`, system cron, Vercel Cron…). None required for MVP.

> **Gotcha (OAuth):** register an authorized redirect URI per deployed domain in the Google Cloud Console, and set `AUTH_URL` to match. Platforms with rotating preview URLs (e.g. Vercel) should test auth on a stable domain.

---

## 5. Auth & Access Control Model

Levels of access:

1. **Anonymous voter** — opens a poll link, votes as a guest (display name only). No account.
2. **Logged-in voter** — signs in with Google. Gets a stable identity tied to their votes.
3. **Creator** — logged in and permitted to create/manage polls (see the allowlist toggle below).
4. **Owner (you)** — a creator with an admin flag who manages access (allowlist, blocklist, audit log).

**Creator access is a configurable mode** via `ALLOWLIST_ENABLED`:

- `true` (default) — must be logged in **and** on the `AllowedCreator` list. The list is seeded from `OWNER_EMAIL` on first boot; you manage the rest from the admin screen.
- `false` — any **verified** logged-in Google user can create polls (no list to maintain).

Flow for creating a poll: must be logged in (and `email_verified`, see §7) → not on the blocklist → if `ALLOWLIST_ENABLED`, on the `AllowedCreator` list → allow/deny. The owner always passes. A single server-side helper (`requireCreator()`) is the chokepoint for this decision.

> **Authentication ≠ authorization.** A successful Google sign-in proves *identity*, not *trustworthiness* — anyone can create a Gmail account in minutes. So the allowlist/blocklist is the authorization gate; it is what keeps the site from being abused when opened up, **not** the act of signing in.

**Blocklist** (`BlockedEmail`) — a reactive deny list, checked at sign-in and in `requireCreator()` in **both** modes. Lets the owner ban an abuser spotted in the audit log without flipping the whole site back to allowlist mode. The owner can never be blocked.

**Audit log** (`AuditLog`) — every meaningful action (sign-in, poll create/update/close/finalize/delete, vote cast/update, creator add/remove, email block/unblock) is recorded for after-the-fact abuse review. It is a **detective** control, not preventive. Owner-only; never feeds the Results API (see §9).

The Vote screen exposes an **inline "Sign in" link** next to the guest name input. This uses the same Auth.js Google provider as the dedicated Sign-in screen — it's an alternate entry point, not a separate flow. After completing OAuth, the user returns to the same vote page with their votes preserved.

---

## 6. Data Model (sketch)

- **User** — id, email, name, image, isOwner. (Plus Auth.js `Account`/`Session` tables.)
- **AllowedCreator** — email, addedBy, addedAt.
- **BlockedEmail** — email (unique), reason?, blockedBy, blockedAt.
- **AuditLog** — id, createdAt, actorUserId? (nullable for guests/anon), actorEmail? (snapshot, survives user deletion), guestName?, action (e.g. `signin`, `poll.create`, `poll.update`, `poll.close`, `poll.finalize`, `poll.delete`, `vote.cast`, `vote.update`, `creator.add`, `creator.remove`, `email.block`, `email.unblock`), targetType?, targetId?, ip?, userAgent?, metadata (JSON). Indexed on createdAt and action.
- **Poll** — id, slug (unique), title, description?, location?, timezone (enum: `America/New_York` | `America/Chicago` | `America/Denver` | `America/Los_Angeles` | `Etc/GMT`), createdById, status (`open` | `closed`), **anonymousVoting** (bool, default `false`), finalTimeOptionId?, createdAt, closesAt?.
- **TimeOption** — id, pollId, startTime (UTC), endTime (UTC), sortOrder.
- **Participant** — id, pollId, userId? (nullable for guests), guestName?, createdAt.
- **Availability** — id, participantId, timeOptionId, response (`yes` | `no` | `ifneedbe`). Rows are only persisted for non-null responses; the absence of a row means "not marked" (so tapping a selected segment to clear deletes the row).

Notes:
- `slug` is unique; generation = `slugify(title) + "-" + nanoid(5)`. Retry on collision.
- When `anonymousVoting = true`, the Results API returns aggregate counts only — never per-voter rows or avatar stacks.
- All times stored in **UTC**. Displayed in the poll's timezone (Eastern by default) with a visible timezone chip everywhere times appear. A per-viewer "show in my local time" toggle is a Phase 2 nicety.

---

## 7. Google Login

Standard OpenID Connect via the Auth.js Google provider, using only the basic sign-in scopes (`openid`, `email`, `profile`).

- These are **non-sensitive** scopes, so the app does **not** require Google's verification/security review, and there's no test-user cap to worry about. (This is the upside of dropping calendar integration — that was the only piece that pulled in sensitive scopes.)
- **`email_verified` is enforced:** the `signIn` callback rejects any account whose ID-token `email_verified` claim is not `true`. The `email` scope returns this claim, so it costs nothing and rejects edge-case unverified accounts before they get an identity.
- You still create an OAuth client in the Google Cloud Console and register redirect URIs.
- Both the dedicated Sign-in screen and the inline "Sign in" link on the Vote screen use the same OAuth client — they're just two entry points into the same flow.

> **Gotcha:** register an authorized redirect URI for each domain you deploy to, and set `AUTH_URL` to match (see §4).

---

## 8. UI Implementation Notes

The design system in `docs/design/Herd Scheduler/` is authoritative — implementation must match it. Reference files:

- `README.md` — voice, color tokens, typography, spacing, iconography, sample data.
- `colors_and_type.css` — all design tokens (color, type scale, spacing, radii, shadow, motion) for both light + dark.
- `ui_kits/herd-scheduler/` — concrete screens (`VoteScreen.jsx`, `ResultsScreen.jsx`, `CreateScreen.jsx`, `SecondaryScreens.jsx`) and the signature `Segmented`, `MiniCalendar`, `StackedBar`, `Tally`, `AvatarStack`, `TzChip` components.
- `preview/` — atomic component specs (segmented control, slot card, stacked tally, pills, etc.).

Things to carry over verbatim:

- ~390px mobile-first frame; phone-width column on larger viewports.
- Sticky app bar (poll title + host line + timezone chip + theme toggle) and sticky bottom action bar where a primary action exists; the slot list scrolls between them.
- 3-way `Segmented` control is the signature interaction — pill track + tinted thumb + check glyph + tap-to-clear.
- Touch targets ≥ 44px; **tabular figures on all clock times**.
- Results: best-fit cards get a 2px cerulean ring + "★ Best fit" pill. Independent "Works for everyone" pill when `no == 0`. Finalized cards get a check marker + top-of-page banner.
- Theme toggle visible in every screen's app bar; switches `data-theme` on `<html>`, persists in `localStorage`.
- Voice: sentence case, peer-to-peer, "you" / first names; never "the organizer". See README §CONTENT FUNDAMENTALS.

The prototype's React-via-script-tag structure is throwaway — only the visual output and copy are normative. Production builds these as standard Next.js components.

---

## 9. Privacy, Discoverability & Security

**Decided: unindexed but link-shareable.** The site won't appear in search engines, but anyone with a poll link can load and vote on it (guest voting works). This keeps friction near zero.

### Keep it out of search engines
- Send `X-Robots-Tag: noindex, nofollow` on every response, plus a `<meta name="robots" content="noindex,nofollow">` fallback. Stronger than `robots.txt`, which only asks polite crawlers and doesn't actually prevent indexing.
- No `sitemap.xml`, no inbound links from any public site.
- **Unguessable poll slugs** (`kebab(title) + "-" + nanoid(5)`) so URLs can't be enumerated.

### Vote authorship visibility
- **Per-poll setting**, configurable by the creator at poll creation. Default: visible (avatar stacks + names on Results).
- When set to anonymous, the Results API returns aggregate counts only — never per-voter data — regardless of viewer role.

### General hardening
- `AUTH_SECRET` set per environment; secure, http-only cookies (Auth.js handles CSRF).
- **`email_verified` sign-in gate** (§7) and a reactive **blocklist** (§5) — the authorization gate that keeps the site safe when `ALLOWLIST_ENABLED=false`.
- **Audit log** (§5) of meaningful actions for after-the-fact abuse review. **Privacy guard:** the owner-only audit viewer shows actor identity even for `anonymousVoting` polls, so the Results API must **never** derive voter identity from `AuditLog` — keep the two paths strictly separate or the anonymity flag is backdoored.
- Rate-limit poll creation and voting, plus per-creator / per-poll size caps (Phase 8).
- *(If you later want the site fully unreachable to outsiders — not just unindexed — the path is an identity proxy like Cloudflare Access or a VPN, which would mean dropping anonymous guest voting. Out of scope for now.)*

---

## 10. Milestones

1. **Scaffold** — Next.js + TS + Tailwind + Prisma + Auth.js Google login. Dockerfile + docker-compose early so the portable path is proven from day one. Plumb the design tokens from `colors_and_type.css` into Tailwind's `theme.extend` + CSS variables. Self-host fonts (Space Grotesk + Inter via `next/font`) and Lucide (via `lucide-react`).
2. **Design-system parity** — build the kit components against the tokens: `Segmented` 3-way control, slot card, stacked tally bar, avatar + avatar stack, `TzChip`, sticky app bar, sticky bottom bar, mini-calendar, theme toggle. Visual diff against the prototype screens.
3. **Core polls** — data model, create flow with multi-select calendar + shared time-range picker, share-link success state with copy-link, guest voting + inline Google sign-in, vote submit/update with "Saved" toast.
4. **Access control** — allowlist + admin screen + owner bootstrap from `OWNER_EMAIL`.
5. **Results + finalize** — scoring (`yes*3 + maybe - no*4`), best-fit highlighting, "Works for everyone" pill, manual finalize with banner + change-pick affordance, anonymity-aware rendering.
6. **Polish + Phase 2** — per-viewer local-tz toggle, poll expiry/auto-close, email notifications.

---

## 11. Open Questions

1. **Email provider** when notifications land in Phase 2 — Resend, SES, SMTP?
2. **Mutability of the anonymity setting** after votes already exist. Default proposal: lock it once any vote is cast (otherwise it would retroactively reveal or hide identities a voter assumed were private/public when they responded).

*Resolved:* rename to Herd Scheduler with cat brand mark; dark mode in MVP; per-poll anonymity (default visible); multi-select calendar create flow with sticky last-range; best-fit scoring `yes*3 + maybe - no*4`; fixed 5-zone timezone picker (ET / CT / MT / PT / GMT, ET default); tap-to-clear on segmented control; slug = `kebab(title) + "-" + nanoid(5)`; preset 30-min time dropdown; inline Google sign-in on Vote screen; email notifications stay Phase 2; portable container + any Postgres (Vercel/Supabase as one reference setup); portability proven via `docker build` (the committed `docker-compose.yml` is dev-only: a local Postgres on port 5432, app runs on the host); unindexed/Model A privacy; no Google Calendar; manual finalize with best-fit highlighting; Postgres over Mongo; optional allowlist via `ALLOWLIST_ENABLED` (default on); reactive email blocklist; owner-only audit log + viewer; `email_verified` sign-in gate; per-poll/per-creator size caps deferred to Phase 8.
