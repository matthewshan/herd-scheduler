import type { ReactNode } from "react";

export interface BottomBarProps {
  /** Hint text on the left of the progress row (e.g. "2 of 4 marked"). */
  hint?: ReactNode;
  /** Completion fraction 0–1; renders the capped progress meter when set. */
  progress?: number;
  /** Primary action(s) — typically a block Button. */
  children: ReactNode;
}

// Sticky, frosted bottom action bar. Holds the screen's primary action and an
// optional progress hint row above it. Pads for the iOS home indicator.
export function BottomBar({ hint, progress, children }: BottomBarProps) {
  const showHint = hint != null || progress != null;
  const pct = Math.round(Math.min(Math.max(progress ?? 0, 0), 1) * 100);

  return (
    <div className="border-t border-border bg-bottombar-bg px-4 pt-3 shadow-sh-2 backdrop-blur-[10px] backdrop-saturate-[1.4] [padding-bottom:calc(12px+env(safe-area-inset-bottom))]">
      {showHint && (
        <div className="mb-[9px] flex items-center justify-between font-body text-[12.5px] text-fg2">
          <span>{hint}</span>
          {progress != null && (
            <div className="ml-3 h-[5px] max-w-[120px] flex-1 overflow-hidden rounded-full bg-surface-2">
              <span
                className="block h-full rounded-full bg-brand transition-[width] duration-ds ease-ds"
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
