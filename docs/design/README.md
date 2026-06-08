# Herd Scheduler — Design System

A private, Doodle-style scheduling app for a small group of friends. A **host** creates a poll with proposed time slots; **friends** open a shared link and mark **Yes / If-need-be / No** for each slot; the host sees which slots fit best and manually picks the winner.

**Mobile-first** — most people vote on a phone (~390px frame). The personality is *friendly, fresh, confident, modern* — crisp and contemporary, not corporate, and explicitly **not** a warm "AI clay" editorial look.

> ⚠️ **This system deliberately overrides any inherited org/Claude theme.** No warm clay / coral / peach / terracotta / cream tones, and no serif display typeface. The palette is a cool off-white canvas with a cerulean brand accent; the display face is the geometric **Space Grotesk**.

---

## Sources

This system was built from a written design brief only — there was **no codebase, Figma file, or slide deck** attached. All tokens, copy, sample data, and screen specs are derived from:

- **Brief:** *"Claude Design Brief — Herd Scheduler"* (pasted by the user, June 2026).

Because there was no source repo or Figma, the UI kit is an original realization of the brief's spec rather than a recreation of existing production code. If a real codebase or Figma exists, re-attach it and the kit can be tightened to match pixel-for-pixel.

---

## Color tokens

| Role | Token | Hex |
|---|---|---|
| App canvas | `--bg` | `#F7F8FA` |
| Surface / card | `--surface` | `#FFFFFF` |
| Hairline / border | `--border` | `#E6E8EC` |
| Text primary | `--fg1` | `#14181F` |
| Text secondary | `--fg2` | `#5B6472` |
| Brand / primary action | `--brand` | `#0077B6` (cerulean) |
| Brand hover/pressed | `--brand-hover` | `#005E9E` |
| Yes / available | `--yes` on `--yes-tint` | `#16A34A` on `#DCFCE7` |
| If-need-be / maybe | `--maybe` on `--maybe-tint` | `#D97706` on `#FEF3C7` |
| No / unavailable | `--no` on `--no-tint` | `#DC2626` on `#FEE2E2` |
| Best-fit emphasis | `--brand` | `#0077B6` (cerulean ring + pill — distinct from green "yes") |

Full token set (spacing, radii, shadows, type scale) lives in **`colors_and_type.css`**.

---

## CONTENT FUNDAMENTALS

How copy is written across the product.

- **Voice:** warm, casual, peer-to-peer — like texting a group chat, not a calendar enterprise tool. Confident and low-friction.
- **Person:** addresses the user as **"you"** ("Submit availability", "Saved — you can update anytime"). Refers to the host by **first name** ("Hosted by Alex"), never "the organizer."
- **Casing:** **Sentence case everywhere** — buttons, headers, labels, chips. Never Title Case or ALL CAPS in body copy. The only uppercase is the tiny `--t-micro` eyebrow/overline style (tracked, 11px).
- **Tone of status:** plain and human. "Works for everyone", "Best fit", "If-need-be", "Saved — you can update anytime", "Share this with your friends." No jargon, no "optimize", no "stakeholders."
- **Punctuation:** middot `·` separates inline metadata ("Times shown in Eastern Time · ET", "Finalized: Fri, Jun 6 · 7 PM ET"). En-dash for time ranges ("7:00–10:00 PM"). Em-dash for soft asides ("Saved — you can update anytime").
- **Emoji:** used **sparingly and only where it's genuinely social** — primarily inside user-authored content like a poll title ("Game Night 🎲"). UI chrome, labels, and system messages stay emoji-free. Never decorate buttons or status chips with emoji.
- **Numbers & progress:** concrete and reassuring — "3 of 5 marked", "6 responded", "5 Yes · 1 if-need-be · 0 No". Always show counts rather than vague states.
- **Timezone:** *always* surfaced near any list of times as a chip — "Times shown in Eastern Time · ET". Default is US Eastern.
- **Labels for the three votes** (use verbatim, lowercase except sentence start): **Yes**, **If-need-be**, **No**.

Examples pulled from the product:
- Header host line → `Hosted by Alex`
- Sticky CTA → `Submit availability` + hint `3 of 5 marked`
- Confirmation → `Saved — you can update anytime`
- Results pill → `★ Best fit` / `Works for everyone`
- Finalized banner → `Finalized: Fri, Jun 6 · 7 PM ET`
- Share line → `Share this with your friends`

---

## VISUAL FOUNDATIONS

The visual motifs and low-level foundations of the brand.

**Color vibe.** Cool and clean. A near-white-but-tinted canvas (`#F7F8FA`) with pure-white cards floating on it. One saturated accent — cerulean `#0077B6` — carries all brand weight (primary buttons, links, active states, the "best fit" emphasis). The three vote semantics (green / amber / red) are the only other saturated colors, always paired with a pale tint background for chips and tracks. No purples, no gradients-as-decoration, no warm tones anywhere.

**Typography.** Two families. **Space Grotesk** (500/700) for display and headings — geometric, slightly quirky, gives the friendly-but-modern character. **Inter** (400/500/600) for all body and UI. **Tabular figures are mandatory on every clock time** so vertical time columns align perfectly. Headings use a tight `-0.01em` letter-spacing; body is default tracking; the only tracked-out, uppercased style is the 11px micro/eyebrow.

**Spacing.** Strict **8px grid** (with a 4px half-step). Airy and generous — cards get 16px internal padding, screen gutters are 16px, vertical rhythm between cards is 12px. Whitespace is a feature; the layouts breathe.

**Backgrounds.** Flat color only. The canvas is `--bg`; cards are `--surface`. **No images, no gradients, no patterns, no textures, no hand-drawn illustration.** Depth comes entirely from soft shadows + hairline borders, never from background fills.

**Corner radii.** Cards **12px**, buttons **10px**, inputs **10px**, status chips / pills / segmented-control thumbs **fully rounded (999px)**. Avatars are circles.

**Cards.** White surface, 12px radius, 1px `--border` hairline, plus a *soft* shadow (`--sh-1`). They are clean and flat — never heavy. The "best fit" card swaps its hairline for a 2px cerulean ring (and a faint cerulean wash is acceptable but optional).

**Shadows / elevation.** Subtle only. Three steps: `--sh-1` resting cards, `--sh-2` raised elements (sticky bottom bar, popovers), `--sh-3` modals/sheets. Brand buttons may carry a tinted `--sh-brand`. No long, dark, dramatic drop shadows.

**Borders.** 1px hairlines in `--border` (`#E6E8EC`) define most separation; `--border-strong` for input outlines and focus-adjacent emphasis. Focus rings use the brand color at reduced alpha (a 3px `--brand` glow / outline).

**Segmented control (the signature component).** Full-width 3-way Yes / If-need-be / No selector. A pill-shaped track (`--surface-2`), three equal segments, and a rounded thumb that fills with the *semantic tint* and shows the semantic color text + a check when selected. Unselected state is neutral slate. This is the core interaction of the whole app — it should feel tactile and satisfying.

**Animation.** Quick and functional. `160ms` with a standard `cubic-bezier(0.4,0,0.2,1)` ease. Segmented-control thumb slides; chips/pills cross-fade tint; the bottom-bar CTA gently lifts on press. **No bounces, no spring overshoot, no infinite decorative loops.** Respect `prefers-reduced-motion`.

**Hover states.** Buttons darken (`--brand` → `--brand-hover`). Ghost/secondary surfaces shift to `--surface-2`. Links darken. No scale-up on hover (this is a touch-first product).

**Press states.** Primary CTA darkens to `--brand-hover` and dips ~1px (subtle translate, not a shrink). Segmented options fill their tint immediately.

**Transparency & blur.** Used minimally. The sticky bottom bar sits on a near-opaque white with a hairline top border (a light backdrop-blur is acceptable behind it). Otherwise surfaces are opaque. No frosted-glass-everywhere.

**Layout rules.** Mobile-first inside a ~390px frame. Sticky header (poll title + timezone chip) and a sticky bottom action bar where a primary action exists; the slot list scrolls between them. Touch targets **≥ 44px**. Primary action is full-width in the bottom bar.

---

## ICONOGRAPHY

- **Icon set:** **[Lucide](https://lucide.dev)** — clean, consistent **stroke** icons (2px stroke, rounded caps/joins) that match the crisp, modern, slightly-geometric mood. Loaded from CDN (`lucide@latest`), no local sprite. This was selected as the closest match to the brief's aesthetic since no icon assets were provided — **flagged as a substitution**; swap if a real set exists.
- **Stroke style:** outline only, `currentColor`, 2px stroke, ~20–24px in chrome and ~16–18px inline. Never mix filled and outline icon families.
- **Common icons in use:** `map-pin` (location), `clock` (times / timezone), `globe` (timezone), `copy` (copy link), `check` (selected / finalized / "works for everyone"), `star` (best fit), `plus` (add time slot), `x` / `trash-2` (remove a slot), `chevron-down` (timezone select), `user` / `users` (voters), `share-2` (share).
- **Status glyphs:** the **★ "Best fit"** pill and **✓ "Finalized"** marker use the same Lucide `star` / `check` shapes (or the literal `★` / `✓` unicode at small sizes) — kept consistent with the stroke set.
- **Avatars:** circular, generated from initials on a tinted background (no uploaded photos in the sample data). One color per person, drawn from a muted, cool-leaning palette.
- **Brand mark:** the app icon is a cerulean squircle holding the **🐱 cat emoji** ("herding cats" — the whole point of the app). This is the one deliberate exception to the no-emoji-in-chrome rule: the cat is the *logo*, used on the sign-in screen and as the app tile. Everywhere else, emoji stays out of UI chrome.
- **Emoji as icons:** **no** (outside the brand mark above). Emoji otherwise only appears inside user-authored content (poll titles like "Game Night 🎲"). UI never uses emoji as functional iconography.
- **No hand-drawn SVG.** All icons come from Lucide; if a needed glyph is missing, pick the nearest Lucide shape rather than drawing one.

See `assets/README.md` for how the avatar + brand mark are produced.

---

## Index / manifest

Root files:
- **`README.md`** — this file. Start here.
- **`colors_and_type.css`** — all design tokens (color, type scale, spacing, radii, shadow, motion) + semantic helper classes.
- **`SKILL.md`** — Agent-Skill front-matter so this system can be used inside Claude Code.
- **`fonts/`** — font documentation + substitution note (`fonts/README.md`).
- **`assets/`** — brand mark + iconography notes (`assets/README.md`).
- **`preview/`** — individual Design System cards (type specimens, color palettes, spacing/radii/shadow tokens, components). These populate the Design System tab.
- **`ui_kits/herd-scheduler/`** — the interactive, mobile-first prototype: My polls (creator home), Vote, Results, Create-poll, plus Sign-in & Admin. See its own `README.md`.

## Sample data (use verbatim in mocks)

- **Poll:** "Game Night 🎲" — hosted by **Alex**, location "Alex's place", note "Bringing snacks, just need a night that works."
- **Slots (Eastern):** Fri Jun 6, 7:00–10:00 PM · Sat Jun 7, 6:00–9:00 PM · Sat Jun 7, 8:00–11:00 PM · Sun Jun 8, 5:00–8:00 PM.
- **Voters:** Alex, Priya, Marcus, Dana, Sam, Jordan.
- **Example result:** Sat Jun 7 6–9 PM = best fit (5 Yes, 1 if-need-be, 0 No → "Best fit" + "Works for everyone"). Fri Jun 6 = 3 Yes, 1 if-need-be, 2 No.
