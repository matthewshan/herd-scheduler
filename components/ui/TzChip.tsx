import { Globe } from "lucide-react";

export interface TzChipProps {
  /** Full label, e.g. "Times shown in Eastern Time · ET". */
  label: string;
}

// Pill chip announcing the poll's display timezone. Shown on every screen that
// lists times (times are stored UTC, displayed in the poll's timezone).
export function TzChip({ label }: TzChipProps) {
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-pill bg-surface-2 px-[11px] font-body text-[12.5px] font-medium text-fg2">
      <Globe size={14} />
      {label}
    </span>
  );
}
