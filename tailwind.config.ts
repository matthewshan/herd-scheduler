import type { Config } from "tailwindcss";

// Design tokens from docs/design/colors_and_type.css, plumbed 1:1.
// The actual values live as CSS custom properties in app/globals.css (so the
// light/dark themes can swap them); Tailwind utilities reference those vars.
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand & neutrals
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        border: "var(--border)",
        "border-strong": "var(--border-strong)",
        fg1: "var(--fg1)",
        fg2: "var(--fg2)",
        fg3: "var(--fg3)",
        // Primary action
        brand: "var(--brand)",
        "brand-hover": "var(--brand-hover)",
        "brand-tint": "var(--brand-tint)",
        // Semantic vote colors
        yes: "var(--yes)",
        "yes-tint": "var(--yes-tint)",
        "yes-ink": "var(--yes-ink)",
        maybe: "var(--maybe)",
        "maybe-tint": "var(--maybe-tint)",
        "maybe-ink": "var(--maybe-ink)",
        no: "var(--no)",
        "no-tint": "var(--no-tint)",
        "no-ink": "var(--no-ink)",
        // UI helpers
        "frame-canvas": "var(--frame-canvas)",
        "appbar-bg": "var(--appbar-bg)",
        "bottombar-bg": "var(--bottombar-bg)",
        "input-bg": "var(--input-bg)",
        scrim: "var(--scrim)",
      },
      fontFamily: {
        display: "var(--font-display)",
        body: "var(--font-body)",
      },
      fontSize: {
        display: ["var(--t-display)", { lineHeight: "var(--t-display-lh)" }],
        h1: ["var(--t-h1)", { lineHeight: "var(--t-h1-lh)" }],
        h2: ["var(--t-h2)", { lineHeight: "var(--t-h2-lh)" }],
        body: ["var(--t-body)", { lineHeight: "var(--t-body-lh)" }],
        label: ["var(--t-label)", { lineHeight: "var(--t-label-lh)" }],
        meta: ["var(--t-meta)", { lineHeight: "var(--t-meta-lh)" }],
        micro: ["var(--t-micro)", { lineHeight: "var(--t-micro-lh)" }],
      },
      spacing: {
        "s-1": "var(--s-1)",
        "s-2": "var(--s-2)",
        "s-3": "var(--s-3)",
        "s-4": "var(--s-4)",
        "s-5": "var(--s-5)",
        "s-6": "var(--s-6)",
        "s-7": "var(--s-7)",
        "s-8": "var(--s-8)",
      },
      borderRadius: {
        card: "var(--r-card)",
        btn: "var(--r-btn)",
        input: "var(--r-input)",
        pill: "var(--r-pill)",
      },
      boxShadow: {
        "sh-1": "var(--sh-1)",
        "sh-2": "var(--sh-2)",
        "sh-3": "var(--sh-3)",
        "sh-brand": "var(--sh-brand)",
      },
      transitionTimingFunction: {
        ds: "var(--ease)",
      },
      transitionDuration: {
        ds: "var(--dur)",
      },
    },
  },
  plugins: [],
};

export default config;
