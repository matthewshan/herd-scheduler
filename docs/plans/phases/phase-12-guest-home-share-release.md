# Phase 12 — Guest home, "your polls vs joined", share button, release image

**Goal:** Give every visitor a usable home and an always-available share affordance — guests see "polls
you've looked at" (with a sign-in nudge), signed-in users get a "Your polls" / "Joined" tab split, and a
share icon lives on every poll screen. Plus a CI workflow that publishes the image on a GitHub release.

**Depends on:** 8 (creator home), 9 (guest identity), 7 (results — supplies the card data), 10 (CI image
publish — this adds a sibling workflow).

---

## Why

The home and sharing UX is creator-only today:

- `app/page.tsx` redirects anyone not signed in to `/signin`, and a signed-in non-creator hits a dead-end
  "you're all set to vote" screen (`CreatorHome.tsx` `noncreator` variant). A guest who opens a poll and
  navigates away has no way back — the flow is cumbersome.
- The creator home (`listPollsForCreator`) lists only polls you **created**. A signed-in user who votes in
  someone else's poll has nowhere that surfaces it; "yours" and "joined" are indistinguishable.
- Copy-link only exists post-creation (`CreateForm`) and on creator-home cards. A guest viewing a poll can't
  share it.
- CI publishes on `main` pushes and `v*.*.*` tag pushes, but there's no workflow keyed on a **GitHub
  release**.

Intended outcome: a guest landing that lists polls they've opened (browser-local) and keeps prompting them
to sign in; a signed-in home with **segmented tabs** for created vs joined; a share icon on the vote and
results screens for everyone; and a release-triggered image publish.

## Decisions (locked)

- Enriched home cards (live status via a public, aggregate-only server query).
- Share button = **app-bar icon** on vote + results screens.
- Signed-in home = **segmented tabs** ("Your polls" / "Joined").
- Guest sign-in = **prompt only**; **no** guest→account ballot migration this phase.
- **New** release workflow keyed on `release.tag_name` (Docker-safe); the existing `publish-image.yml`
  stays untouched.

## Constraints

- **Guests:** "looked at" history is **localStorage only** (mirrors `lib/guest.ts`) — no schema change.
- **Signed-in:** "joined" is **DB-queried** from `Participant` rows, not localStorage.
- Enrichment data is **aggregate-only** (title, status, span, response count, leading-slot label) — never
  voter identity. Anonymity stays enforced in `lib/results.ts`.
- Voice: sentence case, peer-to-peer, "you". Reuse existing card styling. Times stored UTC, shown in poll
  zone with the tz chip already present on these screens.
- Props as named `interface`s; `useState`/`useReducer` for local UI (`docs/typescript-standards.md`).

---

## Scope

### A. Always-available share button
- **`components/ui/ShareButton.tsx`** (new, `"use client"`): `interface ShareButtonProps { slug: string }`.
  Icon-only button styled like the app-bar leading control (`backBtnClass`, `AppBar.tsx:7`); lucide `Share2`
  → `Check` for ~1600ms after copy. Copies `${window.location.origin}/p/${slug}` via
  `navigator.clipboard?.writeText(...).catch(() => {})` (pattern from `CreateForm.tsx:103-113`). `aria-live`
  "Copied" pill + updated `aria-label` for the icon-only action. Export from `components/ui/index.ts`.
- Mount in the app-bar `right` slot (a `ReactNode`, so pass a fragment) on
  `app/p/[slug]/VoteForm.tsx:343-353` and `app/p/[slug]/results/ResultsView.tsx:97-114`:
  `right={<><ShareButton slug={slug} /><ThemeToggle /></>}`.

### B. Guest "looked at" history (localStorage)
- **`lib/guest-history.ts`** (new, client-safe): `GUEST_HISTORY_STORAGE_KEY = "herd-visited-polls"`;
  `interface VisitedPoll { slug; title; viewedAt }`; `recordVisit(slug, title)` (dedupe by slug, newest
  first, cap ~25, `typeof window` + try/catch); `loadVisits()`; `removeVisit(slug)`.
- Call `recordVisit(slug, title)` on mount: inside `VoteForm.tsx`'s existing init `useEffect` (~`:150-206`)
  and a new `useEffect` in `ResultsView.tsx`. Harmless for hosts (only surfaced on the guest/non-creator home).

### C. Server-side poll summaries (`lib/polls.ts`)
- Refactor `toRow` (`:46-77`) so a shared builder produces `PublicPollSummary` (= `CreatorPollRow` minus
  `youVoted`); `youVoted` becomes a creator-only add-on. Reuses `summarizeResults`/`formatSpan`/`formatLeadLabel`.
- `listPollSummariesBySlug(slugs: string[])` — `where: { slug: { in: slugs } }`, map via the builder,
  **re-order to input order** (recency), omit not-found (deleted) slugs. Powers the **guest** home.
- `listPollsJoined(userId: string)` — `where: { createdById: { not: userId }, participants: { some: { userId,
  availabilities: { some: {} } } } }`, `orderBy createdAt desc`, `include: pollResultsInclude`. Powers the
  signed-in **Joined** tab.

### D. Server action (`app/actions.ts`, new `"use server"`)
- `loadVisitedPollSummaries(slugs: string[])`: cap length (≤50), keep well-formed slugs, delegate to
  `listPollSummariesBySlug`. Public — same trust level as `/p/{slug}/results`.

### E. Home restructure
- **`app/GuestHome.tsx`** (new, signed-out): on mount `loadVisits()`, render cached titles immediately,
  then `loadVisitedPollSummaries(slugs)` in a `useTransition` and upgrade to enriched read-only cards; prune
  omitted slugs via `removeVisit`. **Persistent "sign in to keep your polls" CTA** (→ `/signin`) above the
  list and in the empty state. Empty state: brand mark + "Polls you open will show up here" + CTA.
- **`app/CreatorHome.tsx`**: add a `useState<"yours" | "joined">` segmented toggle. "Your polls" = existing
  created-poll cards (copy/delete). "Joined" = `listPollsJoined` read-only cards (title + `StatusPill` +
  span + responded + lead, link to `/p/{slug}`). Per-tab empty states. **Non-creator** signed-in: no "Your
  polls" tab/create button — Joined-only, keeping the "ask {ownerName}" hint (`:358-363`).
- **`app/page.tsx`**: `if (!user)` → `return <GuestHome />` (stop redirecting). Signed-in → pass
  `listPollsForCreator(user.id)` + `listPollsJoined(user.id)` (+ `mayCreate`, owner/name) into the tabbed
  home; drop the old standalone `noncreator` dead-end.

### F. Release image workflow
- **`.github/workflows/release-image.yml`** (new): `on: release: types: [published]` (+
  `workflow_dispatch`); `permissions: contents: read, packages: write`. Mirror `publish-image.yml` build
  steps (buildx, ghcr login, `docker/metadata-action`, two `build-push-action` jobs for `runner` + `migrate`
  with gha cache). Tag from `type=raw,value=${{ github.event.release.tag_name }}` (strip leading `v` to match
  the existing semver tag style); migrate image uses the same tag + `flavor: suffix=-migrate`.

## Files to create / touch

| File | Change |
|------|--------|
| `components/ui/ShareButton.tsx` | **new** — copy-link icon button |
| `components/ui/index.ts` | export `ShareButton` |
| `lib/guest-history.ts` | **new** — localStorage visit store |
| `app/actions.ts` | **new** — `loadVisitedPollSummaries` server action |
| `app/GuestHome.tsx` | **new** — signed-out landing + sign-in CTA |
| `lib/polls.ts` | `PublicPollSummary`, `listPollSummariesBySlug`, `listPollsJoined`; refactor `toRow` |
| `app/page.tsx` | guest → `GuestHome`; signed-in → tabbed home (both lists) |
| `app/CreatorHome.tsx` | "Your polls"/"Joined" tabs; read-only joined card; non-creator = Joined-only |
| `app/p/[slug]/VoteForm.tsx` | `recordVisit` on mount; `ShareButton` in app bar |
| `app/p/[slug]/results/ResultsView.tsx` | `recordVisit` on mount; `ShareButton` in app bar |
| `.github/workflows/release-image.yml` | **new** — publish on `release: published`, tag = release tag_name |

## Reuse from design bundle / existing code

- Card layout, `StatusPill`, `BrandMark`/`Header` from `app/CreatorHome.tsx`; copy-link pattern from
  `CreateForm.tsx:103-113`; `summarizeResults`/`formatSpan`/`formatLeadLabel` from `lib/results.ts` /
  `lib/time.ts`; the guest-identity localStorage idiom from `lib/guest.ts`.

## Acceptance criteria

- Signed-out `/` shows the visited-poll list (enriched), prunes deleted polls, and always shows a sign-in
  CTA; no history → empty state + CTA.
- Signed-in `/` shows "Your polls" (created) and "Joined" (voted in, excludes your own) as tabs; a
  non-creator sees only "Joined" + the "ask {owner}" hint.
- The app-bar share icon on the vote and results screens copies the correct `/p/{slug}` URL for guests and
  hosts, with a "Copied" confirmation, and never throws on a blocked clipboard.
- Visiting a poll records it in browser history; a returning guest sees it on `/`.
- `release-image.yml` publishes `ghcr.io/<owner>/herd-scheduler:<tag>` and `:<tag>-migrate` on a published
  release.
- A flow GIF (guest home, signed-in tabs, share) is captured via the `visual-capture` skill and embedded in
  the PR.

## Out of scope

- Guest→account ballot migration on sign-in (prompt only this phase).
- Server-persisted guest history / cross-device guest sync (stays browser-local).
- Changing the existing `publish-image.yml` triggers.

## Spec references

- §6 poll domain / best-fit scoring (`lib/results.ts`), §9 anonymity guard (aggregate-only summaries),
  §4 Reference C / Phase 10 CI image publish (sibling release workflow).
