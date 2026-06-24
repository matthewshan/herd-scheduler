"use client";

import { useState } from "react";
import { colorForName, initialFor } from "@/lib/avatar";

export interface AvatarProps {
  name: string;
  /**
   * Photo URL (e.g. a Google profile picture). When set and it loads, it
   * replaces the initial circle; on a missing/failed load we fall back to the
   * derived initial-on-color circle.
   */
  src?: string | null;
  /** Override the derived palette color (e.g. a stored per-user color). */
  color?: string;
  /** Diameter in px. */
  size?: number;
  /** Extra classes (used by AvatarStack for the overlap ring + offset). */
  className?: string;
}

// Initial-on-color circle, or a photo when `src` is provided. Font sizes with
// the avatar (0.4× diameter) so the initial stays proportional from the 28px
// stack avatar up to larger sizes.
export function Avatar({
  name,
  src,
  color,
  size = 36,
  className = "",
}: AvatarProps) {
  // Fall back to the initial if the photo URL 404s / is blocked (e.g. an
  // expired Google CDN link), so the avatar never renders broken.
  const [photoFailed, setPhotoFailed] = useState(false);
  const showPhoto = Boolean(src) && !photoFailed;
  const bg = color ?? colorForName(name);
  return (
    <div
      className={`flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full font-display font-bold text-white ${className}`}
      style={{
        width: size,
        height: size,
        background: showPhoto ? undefined : bg,
        fontSize: size * 0.4,
      }}
      role="img"
      aria-label={name}
    >
      {showPhoto ? (
        // Plain <img> (not next/image) keeps the portable standalone build free
        // of the image optimizer / remotePatterns config. referrerPolicy keeps
        // Google's CDN from 403-ing the request.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src ?? undefined}
          alt=""
          width={size}
          height={size}
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setPhotoFailed(true)}
        />
      ) : (
        // The lone initial is decorative; the name lives in aria-label above.
        <span aria-hidden="true">{initialFor(name)}</span>
      )}
    </div>
  );
}
