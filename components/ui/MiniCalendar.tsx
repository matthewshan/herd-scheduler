"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  WEEKDAYS,
  addMonths,
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
  /** Earliest selectable day (inclusive); earlier days render disabled. */
  minDay?: { year: number; month: number; day: number };
  /** Latest navigable month (inclusive). */
  max?: { year: number; month: number };
}

function cmp(
  a: { year: number; month: number },
  b: { year: number; month: number },
) {
  return a.year * 12 + a.month - (b.year * 12 + b.month);
}

// Variant classes for the four mutually-exclusive day-cell states. Held in
// named constants (not bare string tokens) and selected by `dayCellClass` so
// the render is a flat call instead of a nested ternary.
const DAY_CELL_BASE =
  "tnum flex aspect-square items-center justify-center rounded-[9px] font-body text-[14px] transition-colors duration-ds ease-ds";
const DAY_CELL_PAST = "cursor-not-allowed font-medium text-fg3 opacity-40";
const DAY_CELL_SELECTED =
  "bg-brand font-semibold text-white hover:bg-brand-hover";
const DAY_CELL_ADDED =
  "font-medium text-brand shadow-[inset_0_0_0_1.5px_var(--brand)] hover:bg-surface-2";
const DAY_CELL_DEFAULT = "font-medium text-fg1 hover:bg-surface-2";

function dayCellClass(opts: {
  isPast: boolean;
  isSelected: boolean;
  isAdded: boolean;
}): string {
  if (opts.isPast) {
    return DAY_CELL_PAST;
  }
  if (opts.isSelected) {
    return DAY_CELL_SELECTED;
  }
  if (opts.isAdded) {
    return DAY_CELL_ADDED;
  }
  return DAY_CELL_DEFAULT;
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
  minDay,
  max,
}: MiniCalendarProps) {
  const cells = buildMonthGrid(year, month);
  const here = { year, month };
  const prevDisabled = min ? cmp(here, min) <= 0 : false;
  const nextDisabled = max ? cmp(here, max) >= 0 : false;
  // dayIds are zero-padded ("2026-06-06"), so lexical < is a valid date compare.
  const minDayId = minDay ? dayId(minDay.year, minDay.month, minDay.day) : null;

  const go = (delta: number) => {
    const next = addMonths(year, month, delta);
    onNavigate(next.year, next.month);
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
          if (d === null) {
            return <div key={`e${i}`} className="invisible aspect-square" />;
          }
          const id = dayId(year, month, d);
          const isPast = minDayId !== null && id < minDayId;
          const isSel = !isPast && selected.has(id);
          const isAdded = !isSel && !isPast && (added?.has(id) ?? false);
          const cellClass = dayCellClass({
            isPast,
            isSelected: isSel,
            isAdded,
          });
          return (
            <button
              key={id}
              type="button"
              disabled={isPast}
              onClick={() => onToggleDay(year, month, d)}
              className={`${DAY_CELL_BASE} ${cellClass}`}
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}
