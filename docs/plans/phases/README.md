# Implementation phases

This folder re-slices the milestones in [`../initial-tech-spec.md`](../initial-tech-spec.md) §10 into
**8 agent-sized work orders**. Each file is a self-contained brief: hand one to an agent and it has
everything it needs without reading the others end-to-end.

## Phases

| # | Phase | Goal | Depends on | Done |
|---|-------|------|-----------|------|
| 1 | [Scaffold + container baseline](phase-1-scaffold.md) | Running Next.js app + proven `docker compose up` | — | ☑ |
| 2 | [Design tokens, theming, fonts & icons](phase-2-design-tokens.md) | Tokens in Tailwind + working light/dark theme | 1 | ☑ |
| 3 | [Design-system kit components](phase-3-kit-components.md) | Production components matching the prototype | 2 | ☑ |
| 4 | [Data model + auth & access control](phase-4-data-auth.md) | Full schema + access model (optional allowlist, blocklist, audit log) working | 1 | ☑ |
| 5 | [Create poll + share flow](phase-5-create-share.md) | Host builds and publishes a poll | 3, 4 | ☐ |
| 6 | [Vote flow (guest + inline sign-in)](phase-6-vote-flow.md) | Anyone with the link can mark availability | 3, 4 | ☐ |
| 7 | [Results + finalize](phase-7-results-finalize.md) | Best-fit results + manual finalize, anonymity-correct | 5, 6 | ☐ |
| 8 | [Deploy hardening + Phase 2 backlog](phase-8-deploy-phase2.md) | Production-ready container/ops + documented backlog | 7 | ☐ |

## Dependency graph

```
P1 Scaffold ─┬─> P2 Tokens/Theming ──> P3 Kit components ─┐
             └─> P4 Data model + Auth ─────────────────────┼─> P5 Create+Share ─┐
                                                            ├─> P6 Vote flow ────┼─> P7 Results+Finalize ─> P8 Deploy/Phase2
                                                            └────────────────────┘
```

P2 and P4 can run in parallel after P1. P3 needs P2. P5 and P6 need P3 + P4. P7 needs P5 + P6.

## Shared template

Every phase file follows the same shape: **Goal · Depends on · Scope · Files to create/touch ·
Reuse from design bundle · Acceptance criteria · Out of scope · Spec references.**

## Rules that apply to every phase

- The design bundle under [`../../design/`](../../design/) is **read-only** and authoritative for all
  visuals, copy voice, and screen-level interactions. Never modify it.
- **Voice:** sentence case everywhere, peer-to-peer, address the user as "you", refer to the host by first
  name. Never "the organizer". See the design bundle's README content guide.
- **Times are stored UTC**, displayed in the poll's timezone with a visible timezone chip on every screen
  that lists times.
- **Portability is a hard constraint** — no host-specific code paths (no Vercel-only / Supabase-only logic).
- When a phase changes product behavior, **update `initial-tech-spec.md` alongside the code** and move any
  resolved item out of §11 (Open Questions) into the footer's "Resolved" line.
