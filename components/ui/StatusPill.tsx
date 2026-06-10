import { Check } from "lucide-react";

// A poll's display status. `finalized` is derived (a final pick is set), not a
// distinct PollStatus enum value — see lib/polls / effectiveStatus.
export type PollDisplayStatus = "open" | "closed" | "finalized";

interface StatusMeta {
  label: string;
  pill: string;
  dot?: string;
}

const STATUS: Record<PollDisplayStatus, StatusMeta> = {
  open: {
    label: "Open",
    pill: "bg-yes-tint text-yes-ink",
    dot: "var(--yes)",
  },
  closed: {
    label: "Closed",
    pill: "bg-surface-2 text-fg2",
    dot: "var(--fg3)",
  },
  finalized: {
    label: "Finalized",
    pill: "bg-brand-tint text-brand shadow-[inset_0_0_0_1px_rgba(0,119,182,0.25)]",
  },
};

export interface StatusPillProps {
  status: PollDisplayStatus;
}

// Small status badge for a poll: a colored dot for open/closed, a check for
// finalized. Used on the creator-home poll cards.
export function StatusPill({ status }: StatusPillProps) {
  const s = STATUS[status];
  return (
    <span
      className={`inline-flex h-[26px] flex-shrink-0 items-center gap-[6px] whitespace-nowrap rounded-pill px-[10px] font-body text-[12px] font-semibold ${s.pill}`}
    >
      {status === "finalized" ? (
        <Check size={13} />
      ) : (
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: s.dot }}
        />
      )}
      {s.label}
    </span>
  );
}
