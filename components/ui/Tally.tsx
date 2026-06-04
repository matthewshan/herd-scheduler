import type { TallyCounts } from "./StackedBar";

function Dot({ color }: { color: string }) {
  return (
    <span
      className="inline-block h-2 w-2 rounded-full"
      style={{ background: color }}
    />
  );
}

// Yes/Maybe/No count readout. The Yes count keeps its "Yes" word; the others
// are count-only with a colored dot. Tabular figures keep counts aligned.
export function Tally({ y, m, n }: TallyCounts) {
  return (
    <div className="tnum flex gap-[14px] font-body text-[12.5px] font-semibold">
      <span className="inline-flex items-center gap-[5px] text-yes">
        <Dot color="var(--yes)" />
        {y} Yes
      </span>
      <span className="inline-flex items-center gap-[5px] text-maybe-ink">
        <Dot color="var(--maybe)" />
        {m}
      </span>
      <span className="inline-flex items-center gap-[5px] text-no">
        <Dot color="var(--no)" />
        {n}
      </span>
    </div>
  );
}
