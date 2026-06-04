"use client";

import { Check } from "lucide-react";

// The three availability answers. `null` means "not marked yet".
export type VoteValue = "yes" | "maybe" | "no";

export interface SegmentedProps {
  value: VoteValue | null;
  /** Called with the new value, or `null` when the active segment is re-tapped. */
  onChange: (value: VoteValue | null) => void;
}

const SEG: { key: VoteValue; label: string }[] = [
  { key: "yes", label: "Yes" },
  { key: "maybe", label: "If-need-be" },
  { key: "no", label: "No" },
];

// "on" background + ink per answer. The base option is fg2; hover lifts to fg1.
const ON_TINT: Record<VoteValue, string> = {
  yes: "bg-yes-tint text-yes",
  maybe: "bg-maybe-tint text-maybe-ink",
  no: "bg-no-tint text-no",
};

// Signature 3-way control. The selected segment cross-fades to its semantic
// tint and reveals a check glyph; re-tapping the active segment clears it.
export function Segmented({ value, onChange }: SegmentedProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Your availability"
      className="grid grid-cols-3 gap-1.5 rounded-pill bg-surface-2 p-[5px]"
    >
      {SEG.map((o) => {
        const on = value === o.key;
        return (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(on ? null : o.key)}
            className={`flex h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-pill font-body text-[13.5px] font-semibold transition-colors duration-ds ease-ds ${
              on ? ON_TINT[o.key] : "text-fg2 hover:text-fg1"
            }`}
          >
            <Check
              size={16}
              className={`transition-all duration-ds ease-ds ${
                on ? "scale-100 opacity-100" : "scale-[.6] opacity-0"
              }`}
            />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
