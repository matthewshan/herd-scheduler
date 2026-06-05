"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { currentTheme, toggleTheme, type Theme } from "@/lib/theme";

// Polished app-bar theme toggle: 38px borderless icon button that swaps the
// `data-theme` attribute and persists the choice to localStorage (herd-theme).
export function ThemeToggle() {
  // The no-flash script sets data-theme before hydration; the server can't know
  // it, so we read after mount and gate the icon to avoid an SSR/CSR mismatch.
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(currentTheme());
    setMounted(true);
  }, []);

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(toggleTheme())}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-[10px] text-fg1 transition-colors duration-ds ease-ds hover:bg-surface-2"
    >
      {mounted && (isDark ? <Sun size={19} /> : <Moon size={19} />)}
    </button>
  );
}
