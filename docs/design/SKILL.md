---
name: herd-scheduler-design
description: Use this skill to generate well-branded interfaces and assets for Herd Scheduler (a Doodle-style group scheduling app), either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the `README.md` file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

## Where things live
- `README.md` — product context, content & visual foundations, iconography, manifest.
- `colors_and_type.css` — all design tokens (color, type scale, spacing, radii, shadow, motion) + semantic helpers. Import this first.
- `fonts/` — font docs (Space Grotesk + Inter via Google Fonts; substitution note).
- `assets/` — placeholder app mark + iconography notes (Lucide via CDN).
- `preview/` — individual design-system specimen cards.
- `ui_kits/herd-scheduler/` — the interactive mobile prototype + reusable JSX components (`Shared.jsx`, `Icons.jsx`, screen files). Copy these as the starting point for new screens.

## Non-negotiables
- **Never** use warm clay / coral / peach / cream tones or a serif display face. This is a cool, modern system: cerulean `#0077B6` brand on a `#F7F8FA` canvas, Space Grotesk display + Inter body.
- Yes/If-need-be/No always use the semantic green/amber/red with their tints.
- Always show the timezone chip near any list of times.
- Tabular figures on every clock time. Sentence case everywhere. Touch targets ≥ 44px.
