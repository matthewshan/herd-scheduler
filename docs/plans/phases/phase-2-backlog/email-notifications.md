# Phase 2 backlog — Email notifications

> **Post-MVP. Not built.** Captured by Phase 10 as a future work order.
> **⚠ Blocked on a decision first:** the email provider is still an open
> question — spec **§11 Q1** (Resend / SES / plain SMTP). Decide it (and move
> it to the spec footer's "Resolved" line) before any implementation.

## What

Notify the host by email when (a) someone votes on their poll and (b) a poll
they're in is finalized, with the chosen time.

## Shape already decided

- Recipients are **hosts only** at first (they're the only users guaranteed
  to have an email — guests have none). Voter-facing mail would need an
  opt-in address field and is a separate, later decision.
- Whatever provider wins, access it behind one `lib/email.ts` seam with
  config via env (`EMAIL_*`) — portability rule: a deployment without email
  config runs fine with notifications silently off.
- Batch/debounce new-vote mail (e.g. at most one per poll per N minutes) so a
  20-person poll doesn't send 20 emails — exact policy TBD at implementation.
- **Anonymity guard (spec §9):** for `anonymousVoting` polls the new-vote
  email must not name the voter — counts only. Source from the same
  `lib/results.ts` layer as the UI, never from `AuditLog`.
- Copy follows the design bundle voice (sentence case, peer-to-peer, host by
  first name).

Spec: §2 (Phase 2), §9 (anonymity), §11 Q1 (provider — open).
