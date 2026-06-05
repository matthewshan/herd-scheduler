import { colorForName, initialFor } from "@/lib/avatar";

export interface AvatarProps {
  name: string;
  /** Override the derived palette color (e.g. a stored per-user color). */
  color?: string;
  /** Diameter in px. */
  size?: number;
  /** Extra classes (used by AvatarStack for the overlap ring + offset). */
  className?: string;
}

// Initial-on-color circle. Font sizes with the avatar (0.4× diameter) so the
// initial stays proportional from the 28px stack avatar up to larger sizes.
export function Avatar({
  name,
  color,
  size = 36,
  className = "",
}: AvatarProps) {
  const bg = color ?? colorForName(name);
  return (
    <div
      className={`flex flex-shrink-0 items-center justify-center rounded-full font-display font-bold text-white ${className}`}
      style={{
        width: size,
        height: size,
        background: bg,
        fontSize: size * 0.4,
      }}
      role="img"
      aria-label={name}
    >
      {/* The lone initial is decorative; the name lives in aria-label above. */}
      <span aria-hidden="true">{initialFor(name)}</span>
    </div>
  );
}
