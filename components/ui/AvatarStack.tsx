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

// Overlapping row of avatars. Each avatar after the first overlaps by 8px and
// carries a 2px surface-colored ring so the stack reads as distinct circles.
export function AvatarStack({ people, size = 28, max = 4 }: AvatarStackProps) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <div className="flex items-center">
      {shown.map((p, i) => (
        <Avatar
          key={`${p.name}-${i}`}
          name={p.name}
          src={p.image}
          size={size}
          className={`ring-2 ring-surface ${i === 0 ? "" : "-ml-2"}`}
        />
      ))}
      {extra > 0 && (
        <div
          className="-ml-2 flex flex-shrink-0 items-center justify-center rounded-full bg-surface-2 font-body text-[12px] font-semibold text-fg2 ring-2 ring-surface"
          style={{ width: size, height: size }}
          role="img"
          aria-label={`${extra} more`}
        >
          <span aria-hidden="true">+{extra}</span>
        </div>
      )}
    </div>
  );
}
