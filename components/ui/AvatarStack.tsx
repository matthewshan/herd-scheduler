"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Avatar } from "./Avatar";

/** One person in the stack — a photo when available, else the initial circle. */
export interface AvatarStackPerson {
  name: string;
  image?: string | null;
}

export interface AvatarStackProps {
  people: AvatarStackPerson[];
  /** Diameter of each avatar in px. */
  size?: number;
  /** Max avatars shown before collapsing the rest into a "+N" chip. */
  max?: number;
}

interface NameRevealProps {
  /** Name(s) shown in the bubble and announced as the control's label. */
  label: string;
  /** Bubble pinned open by a tap (hover/focus reveal is CSS-only). */
  open: boolean;
  onToggle: () => void;
  /** Let the bubble wrap (used by the "+N" chip's comma-separated list). */
  wrap?: boolean;
  className?: string;
  children: ReactNode;
}

// Wraps one avatar (or the "+N" chip) in a focusable control that reveals a name
// bubble above it: on hover/focus (pointer + keyboard) and, on touch, pinned by
// a tap until you tap away.
function NameReveal({
  label,
  open,
  onToggle,
  wrap = false,
  className = "",
  children,
}: NameRevealProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      className={`group relative flex-shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-brand ${className}`}
    >
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 -translate-x-1/2 rounded-pill border border-border bg-surface px-2 py-1 text-center text-[11px] font-medium leading-snug text-fg1 shadow-sh-2 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 ${
          wrap ? "max-w-[180px]" : "whitespace-nowrap"
        } ${open ? "opacity-100" : "opacity-0"}`}
      >
        {label}
      </span>
    </button>
  );
}

// Overlapping row of avatars. Each avatar after the first overlaps by 8px and
// carries a 2px surface-colored ring so the stack reads as distinct circles.
// Hovering/tapping an avatar reveals whose it is.
export function AvatarStack({ people, size = 28, max = 4 }: AvatarStackProps) {
  const shown = people.slice(0, max);
  const extra = people.slice(max);
  // The bubble pinned open by a tap; hover/focus reveal is handled in CSS.
  const [openKey, setOpenKey] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Touch: dismiss a pinned bubble on an outside tap or Escape.
  useEffect(() => {
    if (openKey === null) {
      return;
    }
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpenKey(null);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenKey(null);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openKey]);

  const toggle = (key: string) =>
    setOpenKey((cur) => (cur === key ? null : key));

  return (
    <div ref={rootRef} className="flex items-center">
      {shown.map((p, i) => {
        const key = `${p.name}-${i}`;
        return (
          <NameReveal
            key={key}
            label={p.name}
            open={openKey === key}
            onToggle={() => toggle(key)}
            className={i === 0 ? "" : "-ml-2"}
          >
            <Avatar
              name={p.name}
              src={p.image}
              size={size}
              className="ring-2 ring-surface"
            />
          </NameReveal>
        );
      })}
      {extra.length > 0 && (
        <NameReveal
          label={extra.map((p) => p.name).join(", ")}
          open={openKey === "__extra"}
          onToggle={() => toggle("__extra")}
          wrap
          className="-ml-2"
        >
          <div
            className="flex flex-shrink-0 items-center justify-center rounded-full bg-surface-2 font-body text-[12px] font-semibold text-fg2 ring-2 ring-surface"
            style={{ width: size, height: size }}
          >
            <span aria-hidden="true">+{extra.length}</span>
          </div>
        </NameReveal>
      )}
    </div>
  );
}
