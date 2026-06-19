"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, House } from "lucide-react";

const backBtnClass =
  "flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-[10px] text-fg1 transition-colors duration-ds ease-ds hover:bg-surface-2";

export interface AppBarProps {
  title: string;
  /**
   * Home affordance as a link — renders a leading house button (e.g. → the
   * creator dashboard or the guest's looked-at list). Takes precedence over the
   * back affordances when set, since a screen shows one leading control.
   */
  homeHref?: string;
  /** Accessible label for the home button (destination differs by viewer). */
  homeLabel?: string;
  /** Back affordance as a callback — renders a leading icon button. */
  onBack?: () => void;
  /** Back affordance as a link — for server-rendered pages (no client handler). */
  backHref?: string;
  /** Secondary line under the title (host, location, etc.). */
  hostLine?: ReactNode;
  /** Trailing controls, typically the theme toggle. */
  right?: ReactNode;
}

// Sticky, frosted app header: optional back button, title, trailing controls,
// and an optional host/meta line. Blur + translucency come from the theme's
// appbar-bg token.
export function AppBar({
  title,
  homeHref,
  homeLabel = "Your polls",
  onBack,
  backHref,
  hostLine,
  right,
}: AppBarProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-appbar-bg px-4 pb-[13px] pt-3 backdrop-blur-[10px] backdrop-saturate-[1.4]">
      {/* Frosted bar spans full width; its content tracks the centered phone
          column so the title/controls align with the screen body on web. */}
      <div className="mx-auto w-full max-w-[390px]">
        <div className="flex items-center gap-2.5">
          {homeHref ? (
            <Link
              href={homeHref}
              aria-label={homeLabel}
              className={backBtnClass}
            >
              <House size={20} />
            </Link>
          ) : onBack ? (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back"
              className={backBtnClass}
            >
              <ArrowLeft size={20} />
            </button>
          ) : (
            backHref && (
              <Link href={backHref} aria-label="Back" className={backBtnClass}>
                <ArrowLeft size={20} />
              </Link>
            )
          )}
          <h1 className="ds-h1 min-w-0 flex-1 truncate">{title}</h1>
          {right}
        </div>
        {hostLine && (
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 font-body text-[13px] text-fg2">
            {hostLine}
          </div>
        )}
      </div>
    </header>
  );
}
