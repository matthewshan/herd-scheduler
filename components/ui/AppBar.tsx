"use client";

import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

export interface AppBarProps {
  title: string;
  /** Back affordance — renders a leading icon button when provided. */
  onBack?: () => void;
  /** Secondary line under the title (host, location, etc.). */
  hostLine?: ReactNode;
  /** Trailing controls, typically the theme toggle. */
  right?: ReactNode;
}

// Sticky, frosted app header: optional back button, title, trailing controls,
// and an optional host/meta line. Blur + translucency come from the theme's
// appbar-bg token.
export function AppBar({ title, onBack, hostLine, right }: AppBarProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-appbar-bg px-4 pb-[13px] pt-3 backdrop-blur-[10px] backdrop-saturate-[1.4]">
      <div className="flex items-center gap-2.5">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-[10px] text-fg1 transition-colors duration-ds ease-ds hover:bg-surface-2"
          >
            <ArrowLeft size={20} />
          </button>
        )}
        <h1 className="ds-h1 min-w-0 flex-1 truncate">{title}</h1>
        {right}
      </div>
      {hostLine && (
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 font-body text-[13px] text-fg2">
          {hostLine}
        </div>
      )}
    </header>
  );
}
