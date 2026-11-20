// Theme mechanism — mirrors the design prototype (docs/design/ui_kits).
// `data-theme` on <html> is the source of truth; the user's choice persists in
// localStorage under `herd-theme`. The inline no-flash script in app/layout.tsx
// sets the attribute before first paint using the same precedence as initTheme.

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "herd-theme";

/** Inline no-flash script body — runs in <head> before first paint. Keep this
 *  in sync with resolveTheme()'s precedence: stored choice, else OS preference.
 *  Storage and matchMedia are each guarded separately and the attribute is
 *  assigned *outside* both, so a throwing localStorage (blocked storage,
 *  sandboxed iframe) still yields a resolved `data-theme` — otherwise the CSS
 *  @media fallback would paint dark while currentTheme() reported "light". */
export const NO_FLASH_SCRIPT = `(function(){var t=null;try{t=localStorage.getItem('${THEME_STORAGE_KEY}');}catch(e){}if(t!=='light'&&t!=='dark'){var d=false;try{d=!!(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);}catch(e){}t=d?'dark':'light';}document.documentElement.dataset.theme=t;})();`;

/** Pure precedence rule: a valid stored choice wins, else the OS preference. */
export function resolveTheme(
  stored: string | null | undefined,
  prefersDark: boolean,
): Theme {
  if (stored === "light" || stored === "dark") {
    return stored;
  }
  return prefersDark ? "dark" : "light";
}

function readStoredTheme(): string | null {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    // localStorage unavailable (private mode, blocked storage) — no choice.
    return null;
  }
}

function osPrefersDark(): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      !!window.matchMedia?.("(prefers-color-scheme: dark)").matches
    );
  } catch {
    return false;
  }
}

/** Read the persisted choice, falling back to the OS preference. */
export function initTheme(): Theme {
  return resolveTheme(readStoredTheme(), osPrefersDark());
}

/** The theme currently applied to <html> (the live attribute). If the
 *  attribute was never set (e.g. the no-flash script didn't run), resolve it
 *  the same way the CSS @media fallback does, so the toggle flips on the first
 *  click instead of needing two. */
export function currentTheme(): Theme {
  const attr = document.documentElement.dataset.theme;
  if (attr === "light" || attr === "dark") {
    return attr;
  }
  return initTheme();
}

/** Apply a theme to <html> and persist the choice. */
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Persisting failed — the attribute is still set for this session.
  }
}

/** Flip between light and dark, persist, and return the new theme. */
export function toggleTheme(): Theme {
  const next: Theme = currentTheme() === "dark" ? "light" : "dark";
  applyTheme(next);
  return next;
}
