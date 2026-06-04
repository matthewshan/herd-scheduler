// Avatar identity helpers. Each person gets a stable color + initial. The
// prototype hard-codes a PEOPLE map; production derives both from the name so
// any voter renders consistently, while callers may still pass an explicit
// color (e.g. a stored per-user color).

// Palette mirrors the prototype's sample people colors (Shared.jsx PEOPLE).
export const AVATAR_PALETTE = [
  "#0077b6",
  "#7c3aed",
  "#0891b2",
  "#db2777",
  "#059669",
  "#d97706",
];

/** First letter of a name, uppercased; "?" when empty. */
export function initialFor(name: string): string {
  return name?.trim()?.[0]?.toUpperCase() ?? "?";
}

/** Deterministic palette color for a name (stable across renders/sessions). */
export function colorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}
