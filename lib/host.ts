// Host display name for the public poll screens (vote + results). The voice
// refers to the host by first name (design guide: "Hosted by Alex").
//
// PRIVACY: these screens are visible to anyone with the link, so this never
// falls back to the host's email (not even the local-part) — when the account
// has no usable name it returns `null` and the caller renders neutral copy.

/** The host's first name, or `null` when their account has no usable name. */
export function hostFirstName(name: string | null | undefined): string | null {
  const trimmed = name?.trim();
  return trimmed ? trimmed.split(/\s+/)[0] : null;
}
