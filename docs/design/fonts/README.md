# Fonts

Herd Scheduler uses two Google Fonts, loaded via CDN inside `colors_and_type.css`:

| Role | Family | Weights | Notes |
|---|---|---|---|
| Display / headings | **Space Grotesk** | 500, 700 | Geometric, characterful. Deliberately NOT a serif. |
| Body / UI | **Inter** | 400, 500, 600 | Use **tabular figures** (`font-feature-settings: 'tnum'`) for all clock times so columns align. |

## Loading

Both are pulled as follows in `colors_and_type.css`:

- **Space Grotesk** is **self-hosted** from the uploaded `SpaceGrotesk-VariableFont_wght.ttf` (variable font, weight axis 300–700) via an `@font-face` rule.
- **Inter** is still loaded from the Google Fonts CDN (no binary was uploaded for it):

```css
@font-face {
  font-family: 'Space Grotesk';
  src: url('fonts/SpaceGrotesk-VariableFont_wght.ttf') format('truetype-variations');
  font-weight: 300 700;
}
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
```

> ✅ **Space Grotesk now self-hosts** from the uploaded brand file — no CDN dependency for the display face. **Inter** still loads from the Google Fonts CDN; upload an Inter `.woff2`/`.ttf` if you need it fully offline too. Both families are free and open-source.

## Tabular figures

Times are everywhere in this product and live in vertical columns (slot lists, tallies). Always apply tabular figures so digits don't jitter:

```css
.tnum { font-feature-settings: 'tnum' 1, 'lnum' 1; }
```
