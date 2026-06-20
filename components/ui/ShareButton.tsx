"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";

export interface ShareButtonProps {
  /** Poll slug — the shared URL is `${origin}/p/${slug}`. */
  slug: string;
  /** Poll title — shown in the native share sheet when available. */
  title?: string;
}

// How long the "Copied" confirmation stays up after a copy.
const COPIED_MS = 1600;

// Last-ditch copy for contexts where the async Clipboard API is unavailable
// (older mobile browsers, insecure origins): a hidden textarea + execCommand.
function legacyCopy(text: string): boolean {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-9999px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

// Copy with graceful degradation: the async Clipboard API first, then the
// legacy textarea path when it's missing or blocked. Returns whether anything
// actually landed on the clipboard.
async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Blocked (permission denied / insecure origin / headless) — fall back.
    }
  }
  return legacyCopy(text);
}

// App-bar share affordance: a 38px icon button. On mobile it opens the native
// share sheet (the reliable path — a bare clipboard write is often blocked
// there); everywhere else it copies the poll's public link to the clipboard.
// Always available on the vote and results screens, for guests and hosts alike
// — sharing is just a URL, no auth needed.
export function ShareButton({ slug, title }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}/p/${slug}`;

    // Prefer the native share sheet when the browser offers it (mobile, and
    // some desktops): it's the idiomatic share action and works where a direct
    // clipboard write is denied. The sheet is its own confirmation.
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: title ?? "Herd Scheduler", url });
        return;
      } catch (err) {
        // The user dismissing the sheet rejects with AbortError — that's a
        // deliberate cancel, so do nothing. Any other failure falls through to
        // a clipboard copy so the button still does something useful.
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
      }
    }

    const ok = await copyToClipboard(url);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), COPIED_MS);
    }
  }

  return (
    <div className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => void share()}
        aria-label={copied ? "Link copied" : "Share or copy link"}
        className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] text-fg1 transition-colors duration-ds ease-ds hover:bg-surface-2"
      >
        {copied ? <Check size={19} /> : <Share2 size={19} />}
      </button>
      {/* Accessible confirmation for the icon-only action. */}
      <span aria-live="polite" className="sr-only">
        {copied ? "Link copied" : ""}
      </span>
      {copied && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-0 top-full z-30 mt-1 whitespace-nowrap rounded-btn bg-fg1 px-2 py-1 font-body text-[12px] font-medium text-surface shadow-sh-1"
        >
          Link copied
        </span>
      )}
    </div>
  );
}
