import type { ReactNode } from "react";

export interface SlotCardProps {
  /** Day label, e.g. "Fri, Jun 6". */
  day: string;
  /** Time range, e.g. "7:00–10:00 PM". Rendered with tabular figures. */
  time: string;
  /** Best-fit styling: 2px brand border + raised shadow. */
  best?: boolean;
  /** Finalized styling: 2px brand border (no shadow bump). */
  finalized?: boolean;
  /** Top-right slot (e.g. a Pill badge). */
  badge?: ReactNode;
  /** Body below the header — a Segmented (vote) or Tally/StackedBar (results). */
  children?: ReactNode;
}

// Container for one candidate time. The same card backs both the vote screen
// (holding a Segmented) and the results screen (holding a tally). `best` and
// `finalized` thicken the border to brand; `best` also pads in by 1px to keep
// the inner box from shifting under the heavier border.
export function SlotCard({
  day,
  time,
  best = false,
  finalized = false,
  badge,
  children,
}: SlotCardProps) {
  const emphasis = best
    ? "border-2 border-brand shadow-sh-2 px-[15px] py-[13px]"
    : finalized
      ? "border-2 border-brand shadow-sh-1 px-[15px] py-[13px]"
      : "border border-border shadow-sh-1 px-[16px] py-[14px]";

  return (
    <div className={`rounded-card bg-surface ${emphasis}`}>
      <div className="flex items-start justify-between gap-2.5">
        <div>
          <div className="font-display text-[16px] font-bold text-fg1">
            {day}
          </div>
          <div className="tnum mt-px font-body text-[13px] text-fg2">
            {time}
          </div>
        </div>
        {badge}
      </div>
      {children}
    </div>
  );
}
