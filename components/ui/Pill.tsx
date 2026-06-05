import type { ReactNode } from "react";

export type PillVariant = "best" | "all" | "finalized";

export interface PillProps {
  variant: PillVariant;
  /** Optional leading icon (e.g. a 14px lucide glyph). */
  icon?: ReactNode;
  children: ReactNode;
}

const VARIANTS: Record<PillVariant, string> = {
  // ★ Best fit — solid brand
  best: "bg-brand text-white",
  // Works for everyone — yes wash
  all: "bg-yes-tint text-yes",
  // Finalized — brand wash with an inset hairline ring
  finalized:
    "bg-brand-tint text-brand shadow-[inset_0_0_0_1px_rgba(0,119,182,0.25)]",
};

// Status badge: "★ Best fit", "Works for everyone", "Finalized".
export function Pill({ variant, icon, children }: PillProps) {
  return (
    <span
      className={`inline-flex h-[27px] items-center gap-[5px] whitespace-nowrap rounded-pill px-[11px] font-body text-[12.5px] font-semibold ${VARIANTS[variant]}`}
    >
      {icon}
      {children}
    </span>
  );
}
