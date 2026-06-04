export interface TallyCounts {
  /** Yes count. */
  y: number;
  /** If-need-be (maybe) count. */
  m: number;
  /** No count. */
  n: number;
}

// Proportional Yes/Maybe/No bar. Zero-width segments are omitted so a single
// vote type fills the track cleanly. Track height + radius match the prototype.
export function StackedBar({ y, m, n }: TallyCounts) {
  const total = Math.max(y + m + n, 1);
  const pct = (v: number) => `${(v / total) * 100}%`;
  return (
    <div className="flex h-[9px] overflow-hidden rounded-pill bg-surface-2">
      {y > 0 && <span style={{ width: pct(y), background: "var(--yes)" }} />}
      {m > 0 && <span style={{ width: pct(m), background: "var(--maybe)" }} />}
      {n > 0 && <span style={{ width: pct(n), background: "var(--no)" }} />}
    </div>
  );
}
