"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { currentTheme, toggleTheme, type Theme } from "@/lib/theme";

// Stub theme toggle. The polished app-bar version lands in Phase 3; this exists
// so the mechanism (data-theme + localStorage persistence) is exercised now.
export function ThemeToggle() {
  // The no-flash script has already set data-theme before hydration. We read it
  // after mount to avoid a server/client mismatch (the server can't know it).
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
      className="inline-flex h-11 w-11 items-center justify-center rounded-pill border border-border bg-surface text-fg2 transition-colors duration-ds ease-ds hover:bg-surface-2"
    >
      {/* Render nothing icon-wise until mounted so SSR/CSR markup matches. */}
      {mounted && (isDark ? <Sun size={19} /> : <Moon size={19} />)}
    </button>
  );
}
