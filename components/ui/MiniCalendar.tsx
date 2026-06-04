"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  WEEKDAYS,
  buildMonthGrid,
  dayId,
  monthLabel,
} from "@/lib/calendar";

export interface MiniCalendarProps {
  /** Displayed year. */
  year: number;
  /** Displayed month, 0-indexed. */
  month: number;
  /** Navigate to a new month (already normalized across year boundaries). */
  onNavigate: (year: number, month: number) => void;
  /** dayIds that are currently selected (solid brand fill). */
  selected: Set<string>;
  /** dayIds already added elsewhere (outline ring) — optional. */
  added?: Set<string>;
  /** Toggle a day on/off. */
  onToggleDay: (year: number, month: number, day: number) => void;
  /** Earliest navigable month (inclusive). */
  min?: { year: number; month: number };
  /** Latest navigable month (inclusive). */
  max?: { year: number; month: number };
}

function cmp(
  a: { year: number; month: number },
  b: { year: number; month: number },
) {
  return a.year * 12 + a.month - (b.year * 12 + b.month);
}

// Month calendar with multi-day selection. Fully driven by props (no baked-in
// sample months): the parent owns the visible month and the selected set.
export function MiniCalendar({
  year,
  month,
  onNavigate,
  selected,
  added,
  onToggleDay,
  min,
  max,
}: MiniCalendarProps) {
  const cells = buildMonthGrid(year, month);
  const here = { year, month };
  const prevDisabled = min ? cmp(here, min) <= 0 : false;
  const nextDisabled = max ? cmp(here, max) >= 0 : false;

  const go = (delta: number) => {
    const idx = year * 12 + month + delta;
    onNavigate(Math.floor(idx / 12), ((idx % 12) + 12) % 12);
  };

  const navBtn =
    "flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2 text-fg1 transition-colors duration-ds ease-ds hover:bg-border disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="rounded-card border border-border bg-surface px-[14px] pb-4 pt-[14px] shadow-sh-1">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-display text-[16px] font-bold text-fg1">
          {monthLabel(year, month)}
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            className={navBtn}
            onClick={() => go(-1)}
            disabled={prevDisabled}
            aria-label="Previous month"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            className={navBtn}
            onClick={() => go(1)}
            disabled={nextDisabled}
            aria-label="Next month"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w, i) => (
          <div
            key={`dow-${i}`}
            className="pb-1 text-center font-body text-[11px] font-semibold uppercase tracking-[0.03em] text-fg3"
          >
            {w[0]}
          </div>
        ))}
        {cells.map((d, i) => {
          if (d === null)
            return <div key={`e${i}`} className="invisible aspect-square" />;
          const id = dayId(year, month, d);
          const isSel = selected.has(id);
          const isAdded = !isSel && (added?.has(id) ?? false);
          return (
            <button
              key={id}
              type="button"
              onClick={() => onToggleDay(year, month, d)}
              className={`tnum flex aspect-square items-center justify-center rounded-[9px] font-body text-[14px] transition-colors duration-ds ease-ds ${
                isSel
                  ? "bg-brand font-semibold text-white hover:bg-brand-hover"
                  : isAdded
                    ? "font-medium text-brand shadow-[inset_0_0_0_1.5px_var(--brand)] hover:bg-surface-2"
                    : "font-medium text-fg1 hover:bg-surface-2"
              }`}
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}
