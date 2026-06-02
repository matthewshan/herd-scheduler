# Assets

No logo, icon set, or imagery was provided in the brief, so this folder is intentionally light. Everything here is **flagged as a placeholder / substitution** — replace with real brand assets if they exist.

## `logo.svg` — app mark (placeholder)

A minimal app-icon mark: a cerulean (`#0077B6`) rounded square holding a small calendar with a green (`#16A34A`) check — echoing the product's core idea (a date that works → "yes"). It uses only the system's own tokens (brand cerulean, yes-green, brand tint). It is deliberately simple and not a finished brand identity.

> ⚠️ **Placeholder.** This was created because no logo was supplied. If a real mark/wordmark exists, drop it in and update `README.md`.

## Iconography (linked, not stored)

The product uses **[Lucide](https://lucide.dev)** icons via CDN rather than a local sprite, so there are no icon files to store here:

```html
<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>
<script>lucide.createIcons();</script>
```

Use `<i data-lucide="check"></i>` markup, 2px stroke, `currentColor`. See the **ICONOGRAPHY** section of the root `README.md` for the full list of icons in use and the substitution rationale.

## Avatars

Avatars in the prototype are **generated from initials** on a per-person tinted background (cool/muted palette) — there are no photo assets. The generator logic lives in the UI kit (`ui_kits/herd-scheduler/`).
