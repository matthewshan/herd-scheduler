# Phase 2 — Design tokens, theming, fonts & icons

> Part of the [phased implementation plan](README.md). Read the shared rules in that README before starting.

## Goal

Make every design token from the bundle available to the app — through Tailwind and as CSS custom
properties — and ship a working light/dark theme mechanism, self-hosted fonts, and Lucide icons. After this
phase the visual foundation is in place so Phase 3 can build components against real tokens.

## Depends on

Phase 1 (Next.js + Tailwind installed).

## Scope

- **Plumb all tokens from `docs/design/Herd Scheduler/colors_and_type.css` 1:1** into both:
  - Tailwind `theme.extend` (colors, fontFamily, fontSize/line-height, spacing, borderRadius, boxShadow,
    transitionTimingFunction/duration), and
  - CSS custom properties on `:root` and `:root[data-theme="dark"]`, so components can reference either.
  - Categories to cover: brand + neutrals (`--bg`, `--surface`, `--surface-2`, `--border`,
    `--border-strong`, `--fg1/2/3`), primary action (`--brand`, `--brand-hover`, `--brand-tint`), semantic
    vote colors (`--yes/-tint/-ink`, `--maybe/...`, `--no/...`), UI helpers (`--appbar-bg`, `--bottombar-bg`,
    `--input-bg`, `--scrim`, `--frame-canvas`), type scale (display/h1/h2/body/label/meta/micro), spacing
    (`--s-1`…`--s-8`), radii (`--r-card/btn/input/pill`), shadows (`--sh-1/2/3/brand`), motion
    (`--ease`, `--dur`).
- **Theming mechanism** (must match the prototype exactly):
  - `data-theme` attribute on `<html>`.
  - Initial value from `prefers-color-scheme`, overridden by a persisted user choice in `localStorage`
    under key `herd-theme`.
  - An **inline no-flash script** in the document head that sets `data-theme` before first paint (avoids a
    light→dark flash on reload). Dark mode is MVP, not Phase 2.
- **Self-host fonts via `next/font`:** Space Grotesk (500/700) for display/headings, Inter (400/500/600) for
  body. Bundle into the image — no runtime CDN. Use the bundled
  `docs/design/Herd Scheduler/fonts/SpaceGrotesk-VariableFont_wght.ttf` (or the equivalent npm font package
  if cleaner) and Inter via `next/font/google` self-hosted at build time.
- **Icons:** install and wire `lucide-react`. Confirm the icon set used by the prototype (`Icons.jsx`) maps
  to Lucide names.
- **Tabular figures:** a `.tnum` utility (font-feature-settings) for all clock times.
- **Semantic type classes:** `.ds-display`, `.ds-h1`, `.ds-h2`, `.ds-body`, `.ds-label`, `.ds-meta`,
  `.ds-micro` (size + weight + family + color), mirroring the bundle.
- A **theme toggle component** can be stubbed here, but the polished app-bar version belongs to Phase 3.

## Files to create / touch

- `tailwind.config.*` (`theme.extend`), `app/globals.css` (CSS variables for both themes, `.ds-*`, `.tnum`)
- `app/layout.tsx` (font wiring, `data-theme` on `<html>`, inline no-flash script, robots meta from P1)
- `lib/theme.ts` (or similar) — read/write `herd-theme`, toggle helper
- `app/fonts/**` if self-hosting font files directly

## Reuse from design bundle

- `docs/design/Herd Scheduler/colors_and_type.css` — **the** source of truth, port verbatim.
- `docs/design/Herd Scheduler/fonts/` (Space Grotesk TTF) + its `README.md` for font sourcing notes.
- `docs/design/Herd Scheduler/assets/logo.svg` and `assets/README.md` (brand mark).
- `docs/design/Herd Scheduler/ui_kits/herd-scheduler/Icons.jsx` — Lucide icon set reference.
- `docs/design/Herd Scheduler/preview/colors-*.html`, `type-*.html`, `spacing-*.html` — token specimens to
  diff against.

## Acceptance criteria

- A scratch/dev page renders every `.ds-*` type style and a swatch of every color token, in both themes.
- Toggling `data-theme` flips light↔dark; the choice persists to `localStorage` and survives reload with
  **no flash**.
- `prefers-color-scheme` is respected when no stored choice exists.
- Fonts and icons load with **zero network/CDN requests** (verify in the network panel).
- Clock-time samples render with tabular figures (digits align in a column).
- Token values visually match the `preview/*.html` specimens.

## Out of scope

- Building the actual kit components (Segmented, slot card, etc.) — Phase 3.
- Any data or screens.

## Spec references

§3 (styling, theming, icons, fonts), §8 (UI implementation notes), §10 milestone 1.
