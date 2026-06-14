# Phase 2 backlog — "View in my local timezone" toggle

> **Post-MVP. Not built.** Captured by Phase 10 as a future work order.

## What

A per-viewer toggle on the vote and results screens that re-renders every
displayed time in the **viewer's** timezone instead of the poll's. The poll's
zone stays the storage/display default and the timezone chip stays visible —
the toggle adds a second rendering, it doesn't change the poll.

## Shape already decided

- Times are stored UTC (spec rule), so this is **display-only**: no schema or
  write-path changes.
- Viewer zone comes from `Intl.DateTimeFormat().resolvedOptions().timeZone`
  client-side — full IANA, *not* limited to the 5-zone poll enum (that enum is
  a creation-time picker, not a display constraint).
- `lib/time.ts` already does DST-correct UTC↔zone conversion via
  `date-fns-tz`; it needs a variant that accepts an arbitrary IANA zone
  rather than the 5-zone enum.
- Persist the preference like the theme choice (`localStorage`,
  `herd-tz-view` or similar); server renders the poll zone, client swaps —
  same no-flash concern as `data-theme` if it ever moves above the fold.

## Watch out for

- The slot grouping-by-day on vote/results must regroup under the viewer's
  zone (a slot can fall on a different calendar day), not just relabel times.
- Copy voice: the toggle label is the viewer's zone name in sentence case.

Spec: §2 (Phase 2), §8 (timezone chip).
