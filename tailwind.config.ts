import type { Config } from "tailwindcss";

// Plain default Tailwind for Phase 1. The design tokens from
// docs/design/Herd Scheduler/colors_and_type.css are plumbed into
// theme.extend + CSS variables in Phase 2 — not here.
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
