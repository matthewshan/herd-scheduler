// Theme mechanism — mirrors the design prototype (docs/design/ui_kits).
// `data-theme` on <html> is the source of truth; the user's choice persists in
// localStorage under `herd-theme`. The inline no-flash script in app/layout.tsx
// sets the attribute before first paint using the same precedence as initTheme.

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "herd-theme";

/** Inline no-flash script body — runs in <head> before first paint. Keep this
 *  in sync with initTheme()'s precedence: stored choice, else OS preference. */
export const NO_FLASH_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t!=='light'&&t!=='dark'){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.dataset.theme=t;}catch(e){}})();`;

/** Read the persisted choice, falling back to the OS preference. */
export function initTheme(): Theme {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    // localStorage unavailable (private mode, etc.) — fall through to OS pref.
  }
  if (stored === "light" || stored === "dark") return stored;
  const prefersDark =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
}

/** The theme currently applied to <html> (the live attribute). */
export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
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
