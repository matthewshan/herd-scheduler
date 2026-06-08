import Link from "next/link";
import { Cat, House } from "lucide-react";

export const metadata = {
  title: "Not found — Herd Scheduler",
};

// Global 404 — the main trigger is a poll slug that doesn't resolve (a wrong
// link, or a poll the host deleted). Next's default 404 has no navigation, so
// this gives a way home. "/" routes a signed-in host to their dashboard and a
// guest to sign-in.
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-[390px] flex-col items-center justify-center gap-2 px-7 text-center">
      <div
        className="mb-2 flex h-16 w-16 items-center justify-center rounded-[20px] bg-brand-tint text-brand"
        role="img"
        aria-label="Herd Scheduler"
      >
        <Cat size={34} />
      </div>
      <h1 className="ds-display text-[24px]">We couldn&apos;t find that</h1>
      <p className="ds-body mt-1 text-[15px] text-fg2">
        This poll may have been deleted, or the link isn&apos;t quite right.
        Double-check it with whoever shared it.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-btn bg-brand px-[18px] font-body text-[15px] font-semibold text-white shadow-sh-brand transition-colors duration-ds ease-ds hover:bg-brand-hover"
      >
        <House size={18} />
        Go home
      </Link>
    </main>
  );
}
