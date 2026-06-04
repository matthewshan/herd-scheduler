import type { Metadata } from "next";
import { Clock } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

// Phase 2 scratch page: every design token + type style, swatched so the
// values can be diffed against docs/design/preview/*.html in both themes.
// Not a product screen — real UI starts in Phase 3.

export const metadata: Metadata = {
  title: "Design tokens · Herd Scheduler",
};

type Swatch = { name: string; varName: string; ink?: string };

const NEUTRALS: Swatch[] = [
  { name: "--bg", varName: "--bg" },
  { name: "--surface", varName: "--surface" },
  { name: "--surface-2", varName: "--surface-2" },
  { name: "--border", varName: "--border" },
  { name: "--border-strong", varName: "--border-strong" },
  { name: "--fg1", varName: "--fg1" },
  { name: "--fg2", varName: "--fg2" },
  { name: "--fg3", varName: "--fg3" },
];

const BRAND: Swatch[] = [
  { name: "--brand", varName: "--brand" },
  { name: "--brand-hover", varName: "--brand-hover" },
  { name: "--brand-tint", varName: "--brand-tint" },
];

const VOTE: Swatch[] = [
  { name: "--yes", varName: "--yes" },
  { name: "--yes-tint", varName: "--yes-tint", ink: "--yes-ink" },
  { name: "--yes-ink", varName: "--yes-ink" },
  { name: "--maybe", varName: "--maybe" },
  { name: "--maybe-tint", varName: "--maybe-tint", ink: "--maybe-ink" },
  { name: "--maybe-ink", varName: "--maybe-ink" },
  { name: "--no", varName: "--no" },
  { name: "--no-tint", varName: "--no-tint", ink: "--no-ink" },
  { name: "--no-ink", varName: "--no-ink" },
];

const HELPERS: Swatch[] = [
  { name: "--frame-canvas", varName: "--frame-canvas" },
  { name: "--appbar-bg", varName: "--appbar-bg" },
  { name: "--bottombar-bg", varName: "--bottombar-bg" },
  { name: "--input-bg", varName: "--input-bg" },
  { name: "--scrim", varName: "--scrim" },
];

const TYPE = [
  { cls: "ds-display", label: "ds-display — 28/34 · 700 · Space Grotesk" },
  { cls: "ds-h1", label: "ds-h1 — 22/28 · 700 · Space Grotesk" },
  { cls: "ds-h2", label: "ds-h2 — 18/24 · 500 · Space Grotesk" },
  { cls: "ds-body", label: "ds-body — 16/24 · 400 · Inter" },
  { cls: "ds-label", label: "ds-label — 15/20 · 500 · Inter" },
  { cls: "ds-meta", label: "ds-meta — 13/18 · 500 · Inter" },
  { cls: "ds-micro", label: "ds-micro — 11/14 · 600 · Inter · tracked caps" },
];

const SPACING = ["s-1", "s-2", "s-3", "s-4", "s-5", "s-6", "s-7", "s-8"];
const RADII = [
  { name: "--r-card", varName: "--r-card" },
  { name: "--r-btn", varName: "--r-btn" },
  { name: "--r-input", varName: "--r-input" },
  { name: "--r-pill", varName: "--r-pill" },
];
const SHADOWS = ["--sh-1", "--sh-2", "--sh-3", "--sh-brand"];

const CLOCK_TIMES = [
  "7:00–10:00 PM",
  "6:00–9:00 PM",
  "11:00–11:00 PM",
  "5:00–8:00 PM",
];

function SwatchGrid({ swatches }: { swatches: Swatch[] }) {
  return (
    <div className="grid grid-cols-2 gap-s-3 sm:grid-cols-3 md:grid-cols-4">
      {swatches.map((s) => (
        <div
          key={s.name}
          className="overflow-hidden rounded-card border border-border bg-surface shadow-sh-1"
        >
          <div
            className="flex h-16 items-center justify-center"
            style={{
              background: `var(${s.varName})`,
              color: s.ink ? `var(${s.ink})` : undefined,
            }}
          >
            {s.ink && <span className="ds-label">Aa</span>}
          </div>
          <div className="px-s-3 py-s-2">
            <code className="ds-meta tnum">{s.name}</code>
          </div>
        </div>
      ))}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-s-4">
      <h2 className="ds-micro">{title}</h2>
      {children}
    </section>
  );
}

export default function TokensPage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-s-7 p-s-5">
      <header className="flex items-center justify-between gap-s-4">
        <div className="flex flex-col gap-s-1">
          <h1 className="ds-display">Design tokens</h1>
          <p className="ds-meta">
            Phase 2 specimen · toggle the theme to check both palettes
          </p>
        </div>
        <ThemeToggle />
      </header>

      <Section title="Type scale">
        <div className="flex flex-col gap-s-4 rounded-card border border-border bg-surface p-s-5 shadow-sh-1">
          {TYPE.map((t) => (
            <div key={t.cls} className="flex flex-col gap-s-1">
              <span className="ds-micro">{t.label}</span>
              <span className={t.cls}>Find a time that works · 7:30 PM</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Tabular figures (.tnum)">
        <div className="flex gap-s-7 rounded-card border border-border bg-surface p-s-5 shadow-sh-1">
          <div className="flex flex-col gap-s-1">
            <span className="ds-micro">tnum ✓</span>
            <div className="ds-body tnum flex flex-col">
              {CLOCK_TIMES.map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-s-1">
            <span className="ds-micro">proportional ✗</span>
            <div className="ds-body flex flex-col">
              {CLOCK_TIMES.map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>
          </div>
        </div>
      </Section>

      <Section title="Brand & neutrals">
        <SwatchGrid swatches={NEUTRALS} />
      </Section>

      <Section title="Primary action">
        <SwatchGrid swatches={BRAND} />
      </Section>

      <Section title="Semantic vote colors">
        <SwatchGrid swatches={VOTE} />
      </Section>

      <Section title="UI helpers">
        <SwatchGrid swatches={HELPERS} />
      </Section>

      <Section title="Spacing (8px grid)">
        <div className="flex flex-col gap-s-2 rounded-card border border-border bg-surface p-s-5 shadow-sh-1">
          {SPACING.map((s) => (
            <div key={s} className="flex items-center gap-s-3">
              <code className="ds-meta tnum w-12">{s}</code>
              <div
                className="h-s-4 rounded-sm bg-brand"
                style={{ width: `var(--${s})` }}
              />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Radii">
        <div className="flex flex-wrap gap-s-4">
          {RADII.map((r) => (
            <div key={r.name} className="flex flex-col items-center gap-s-2">
              <div
                className="h-16 w-16 border border-border-strong bg-surface-2"
                style={{ borderRadius: `var(${r.varName})` }}
              />
              <code className="ds-meta">{r.name}</code>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Elevation">
        <div className="flex flex-wrap gap-s-5 rounded-card bg-bg p-s-5">
          {SHADOWS.map((sh) => (
            <div key={sh} className="flex flex-col items-center gap-s-2">
              <div
                className="h-16 w-16 rounded-card bg-surface"
                style={{ boxShadow: `var(${sh})` }}
              />
              <code className="ds-meta">{sh}</code>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Icons (lucide-react)">
        <div className="flex items-center gap-s-3 rounded-card border border-border bg-surface p-s-5 text-fg2 shadow-sh-1">
          <Clock size={20} />
          <span className="ds-meta">
            lucide-react renders from the bundle — no CDN request
          </span>
        </div>
      </Section>
    </main>
  );
}
