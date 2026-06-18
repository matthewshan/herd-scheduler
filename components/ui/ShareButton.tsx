"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";

export interface ShareButtonProps {
  /** Poll slug — the shared URL is `${origin}/p/${slug}`. */
  slug: string;
}

// How long the "Copied" confirmation stays up after a copy.
const COPIED_MS = 1600;

// App-bar share affordance: a 38px icon button that copies the poll's public
// link to the clipboard. Always available on the vote and results screens, for
// guests and hosts alike — sharing is just a URL, no auth needed.
export function ShareButton({ slug }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  function copy() {
    const url = `${window.location.origin}/p/${slug}`;
    // writeText rejects when the clipboard is blocked (insecure origin, denied
    // permission, headless) — swallow it so it isn't an unhandled rejection.
    void navigator.clipboard?.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), COPIED_MS);
  }

  return (
    <div className="relative flex-shrink-0">
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Link copied" : "Copy link to share"}
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
