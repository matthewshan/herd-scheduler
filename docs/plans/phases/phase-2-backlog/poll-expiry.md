# Phase 2 backlog — Poll expiry / auto-close

> **Post-MVP. Not built.** Captured by Phase 10 as a future work order.

## What

Let a host set an optional voting deadline; past it, the poll behaves exactly
like a manually closed one (no new votes; results stay visible).

## Shape already decided

- **Portable trigger (spec §4):** expose the sweep as a plain authenticated
  endpoint or CLI command — `POST /api/cron/close-expired` with a bearer
  token, or a one-shot container command. Whatever scheduler the host has
  (k8s `CronJob`, system cron, Vercel Cron) calls it. **No host-specific
  scheduler code in the app.**
- Schema: nullable `closesAt` on `Poll`. The sweep sets `status: "closed"`
  where `closesAt <= now() AND status = "open"`.
- Reuse the existing closed-poll semantics from Phase 7: `submitVote` and the
  vote page already treat non-`open` polls as closed — expiry only needs to
  flip the status (or the read paths can treat `closesAt` passed as closed
  even before the sweep runs, making the sweep cosmetic).
- Audit each auto-close (`poll.close` with a `cause: "expired"` metadata) via
  the existing `logAction` / `AUDIT_ACTIONS` single source of truth.

## Watch out for

- The create form needs a deadline picker consistent with the design bundle's
  date/time controls; default remains "no deadline".

Spec: §2 (Phase 2), §4 (scheduled tasks).
