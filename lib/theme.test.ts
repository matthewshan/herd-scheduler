import { afterEach, describe, expect, it, vi } from "vitest";
import {
  NO_FLASH_SCRIPT,
  THEME_STORAGE_KEY,
  currentTheme,
  resolveTheme,
  toggleTheme,
} from "./theme";

interface FakeEnv {
  /** Stored value, or "throw" to simulate blocked storage. */
  stored: string | null | "throw";
  prefersDark: boolean;
  /** Pre-existing data-theme attribute on <html>. */
  attr?: string;
}

// Minimal browser globals for the theme helpers + the inline script.
function installEnv({ stored, prefersDark, attr }: FakeEnv) {
  const dataset: Record<string, string | undefined> = { theme: attr };
  const writes: Record<string, string> = {};
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => {
      if (stored === "throw") {
        throw new Error("SecurityError");
      }
      return key === THEME_STORAGE_KEY ? stored : null;
    },
    setItem: (key: string, value: string) => {
      if (stored === "throw") {
        throw new Error("SecurityError");
      }
      writes[key] = value;
    },
  });
  vi.stubGlobal("window", {
    matchMedia: (query: string) => ({
      matches: query === "(prefers-color-scheme: dark)" && prefersDark,
    }),
  });
  vi.stubGlobal("document", { documentElement: { dataset } });
  return { dataset, writes };
}

function runNoFlashScript() {
  new Function(NO_FLASH_SCRIPT)();
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("resolveTheme", () => {
  it("prefers a valid stored choice over the OS preference", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("falls back to the OS preference for missing or junk values", () => {
    expect(resolveTheme(null, true)).toBe("dark");
    expect(resolveTheme(undefined, false)).toBe("light");
    expect(resolveTheme("purple", true)).toBe("dark");
  });
});

describe("NO_FLASH_SCRIPT", () => {
  it("applies the stored choice", () => {
    const { dataset } = installEnv({ stored: "light", prefersDark: true });
    runNoFlashScript();
    expect(dataset.theme).toBe("light");
  });

  it("falls back to the OS preference when nothing is stored", () => {
    const { dataset } = installEnv({ stored: null, prefersDark: true });
    runNoFlashScript();
    expect(dataset.theme).toBe("dark");
  });

  it("still sets data-theme from the OS preference when storage throws", () => {
    const { dataset } = installEnv({ stored: "throw", prefersDark: true });
    runNoFlashScript();
    expect(dataset.theme).toBe("dark");
  });
});

describe("toggle with blocked storage", () => {
  it("flips on the first click after the no-flash script ran", () => {
    const { dataset } = installEnv({ stored: "throw", prefersDark: true });
    runNoFlashScript();
    expect(currentTheme()).toBe("dark");
    expect(toggleTheme()).toBe("light");
    expect(dataset.theme).toBe("light");
  });

  it("resolves from the OS preference when the attribute is unset", () => {
    installEnv({ stored: "throw", prefersDark: true });
    expect(currentTheme()).toBe("dark");
    expect(toggleTheme()).toBe("light");
  });

  it("persists the choice when storage works", () => {
    const { writes } = installEnv({ stored: null, prefersDark: false });
    runNoFlashScript();
    expect(toggleTheme()).toBe("dark");
    expect(writes[THEME_STORAGE_KEY]).toBe("dark");
  });
});
