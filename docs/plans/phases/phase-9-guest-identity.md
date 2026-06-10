# Phase 9 — Persistent guest identity

> Part of the [phased implementation plan](README.md). Read the shared rules in that README before starting.

## Goal

Let an **anonymous (guest) voter be remembered on their own device** so a return visit recognizes them:
their name is pre-filled, their existing ballot is reloaded, and re-submitting **edits** their prior vote
instead of creating a second, duplicate participant. Today a guest is a one-shot — the moment they leave the
page their identity is gone, so coming back to a poll they already voted on shows an empty form and a fresh
submit risks a confusing collision with their earlier entry.

This is the guest-side analogue of what a signed-in voter already gets (`loadBallot` by `userId`), done
**without an account** — a soft, per-browser identity held in `localStorage`, never a server-side login.

> Sequencing: a **product** phase that lands after [8 creator home](phase-8-creator-home.md) and before
> [10 deploy hardening](phase-10-deploy-phase2.md) — get the guest experience right before shipping to
> production.

## Depends on

**Phase 6 (vote flow)** and **Phase 7 (results)**. It reworks the guest path in `app/p/[slug]/VoteForm.tsx`
+ `app/p/[slug]/actions.ts` and the participant resolution in `lib/votes.ts`, and it must preserve the
anonymity guarantees enforced in `lib/results.ts` (Phase 7). No new screens — it deepens an existing flow.

## The problem, precisely

- `Participant` is keyed per poll on **`guestName`** (`@@unique([pollId, guestName])`). The display name
  *is* the identity, which means:
  - Two different guests who both type "Alex" **collide** — the second silently edits the first's ballot.
  - A returning guest has no stable handle the server can use to find their prior row, so the vote page
    (a server component that can't read `localStorage`) renders an empty ballot for them.
- In-progress votes only survive the **OAuth round-trip** via a per-slug `localStorage` draft
  (`herd-vote:{slug}`), which is **cleared on a successful submit** — so it deliberately does *not* persist a
  submitted guest's identity across a later visit.

## Scope

- **Stable anonymous key (data model).** Add a `guestKey String?` to `Participant` — an opaque,
  client-generated id (e.g. `nanoid()`), distinct from the human-readable `guestName` (which becomes a
  *display label only*). Key guests on it:
  - Add `@@unique([pollId, guestKey])`; **keep** `guestName` but drop its role as the identity (remove the
    `@@unique([pollId, guestName])` constraint, or relax it — two guests may now legitimately share a name).
  - Migration is additive; existing guest rows keep `guestName` and get a `null` `guestKey` (treated as
    legacy/un-rebindable — acceptable, pre-launch).
- **Client identity (`localStorage`).** On first guest interaction, mint and persist a per-browser identity
  **once, globally** (not per-slug): `herd-guest-id` (the `guestKey`) and `herd-guest-name` (last name they
  used). Reuse it across every poll on that browser so the name field is pre-filled everywhere and the same
  person is recognized poll-to-poll. The existing per-slug `herd-vote:{slug}` **draft** stays for
  in-progress/OAuth-survival work; the new keys are the *durable* identity.
- **Identity resolution (`lib/votes.ts`).** Extend `ParticipantIdentity` with `guestKey`; resolve/`upsert`
  guests on `pollId_guestKey`. `saveBallot` writes both `guestKey` (identity) and `guestName` (current
  label, updatable — a guest can rename and the row follows). `loadBallot` accepts a `guestKey` identity and
  returns that guest's saved ballot.
- **Server action (`app/p/[slug]/actions.ts`).** `submitVote` accepts the `guestKey` from the client
  (validated/shape-checked) and threads it into `saveBallot`. `vote.cast` vs `vote.update` keys off whether
  the `guestKey` participant already existed.
- **Hydration on return (`VoteForm.tsx`).** The vote page is a server component and can't see
  `localStorage`, so a returning guest's saved ballot is **hydrated client-side**: on mount, read
  `herd-guest-id`; if present, load that guest's ballot for this poll (a `loadBallot`-backed server action or
  route) and pre-fill — mirroring how a signed-in voter is pre-filled server-side. Precedence: an
  in-progress **draft** (latest unsaved work) > the **hydrated saved ballot** > empty. The submit button
  reads "Update availability" once a saved ballot is found.
- **"Not me" escape hatch.** Because the identity is per-browser (shared devices exist), give a returning
  guest a small affordance to **start fresh** — clear `herd-guest-id`/`herd-guest-name` and vote as a new
  person. Keep it quiet (a text link near the pre-filled name), not a prominent control.

## Files to create / touch

- `prisma/schema.prisma` — add `Participant.guestKey`, add `@@unique([pollId, guestKey])`, relax/drop
  `@@unique([pollId, guestName])`. Update the explanatory comment block.
- `prisma/migrations/**` — `pnpm migrate:dev` for the additive column + constraint change.
- `lib/votes.ts` — `guestKey` on `ParticipantIdentity`; guest resolution/upsert on `pollId_guestKey`;
  `loadBallot` by `guestKey`; `saveBallot` updates `guestName` on the existing row.
- `app/p/[slug]/actions.ts` — accept + thread `guestKey` in `submitVote`; (new, if needed) a tiny
  `loadGuestBallot(slug, guestKey)` server action for client hydration.
- `app/p/[slug]/VoteForm.tsx` — mint/read the global guest identity, hydrate the saved ballot on mount,
  pre-fill the name, send `guestKey` on submit, and the "not me / start fresh" link.
- `lib/votes.test.ts` (new) or extend existing unit coverage — guest identity resolution: distinct keys →
  distinct participants (same name no longer collides), rename updates the label not the identity, reload by
  key returns the saved ballot.

## Reuse from design bundle

No new screens. The pre-filled-name + "not me" affordance should match the existing vote-screen identity row
(`docs/design/ui_kits/herd-scheduler/` vote screen) — same `Input`, `Avatar`, and text-link treatments
already used for the guest name and inline sign-in. Voice stays peer-to-peer, sentence case.

## Acceptance criteria

- A guest votes, closes the tab, returns to the same poll on the same browser → their **name is pre-filled**
  and their **prior ballot is shown**, and re-submitting **edits** it (no duplicate participant, no extra
  responder in the count).
- Two different guests on two different browsers who both use the name "Alex" produce **two distinct
  participants** (no collision, no overwrite).
- A guest renames themselves on a return visit → the **same** participant row updates its label; the count
  and results don't double them.
- "Not me / start fresh" clears the stored identity and lets the next submit create a new participant.
- Anonymity is unchanged: on an anonymous poll, results still expose **no** names/keys (the `guestKey` is
  never returned to any viewer; `lib/results.ts` still drops attendees). The key is never sent to clients
  other than its owner's browser.
- A captured GIF of the return-and-edit flow ships with the PR (see below).

## Out of scope

- **Cross-device** identity (the key is per-browser by design — clearing storage or switching devices is a
  new guest). No magic links, no email capture, no accounts — that's the sign-in path.
- Merging a guest's prior votes into their account when they later sign in (possible future follow-up; note
  it in spec §11 if raised, don't build it here).
- Any change to the signed-in voter path, which already loads by `userId` server-side.
- Owner/host visibility changes — host-side results are a Phase 7 concern.

## Front-end deliverable (mandatory)

This alters a user-facing flow (the guest vote/return experience), so the PR must ship a captured GIF under
`docs/screenshots/phase-9/`, embedded in the PR description, via `pnpm capture:visual`. Add a `record(...)`
scenario for "guest votes → returns → ballot pre-filled → edits" rather than hand-recording — see
`docs/context-engineering/visual-capture.md`.

## Spec references

§6 (vote flow, participant model), §9 (anonymity — the `guestKey` must never leak to other viewers; results
still come from `lib/results.ts`, never `AuditLog`). Add a "persistent guest identity" line to the §10
milestones and, when it lands, to the footer "Resolved" list; if the sign-in-merge question is raised, record
it in §11 (Open Questions).
