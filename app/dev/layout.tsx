import { notFound } from "next/navigation";
import type { ReactNode } from "react";

// Gate for the /dev/* scratch pages (token specimen, component gallery): they
// exist for local design work and must not ship publicly. This server-side
// chokepoint covers every page under /dev — including the client-component
// gallery, whose (prop-less) client reference is all that reaches the 404.
// Server-component pages must ALSO call notFound() themselves: Next renders a
// layout and its page in parallel, so a server page's markup would otherwise
// still be serialized into the prerendered RSC payload (see dev/tokens).
//
// `next build` always runs with NODE_ENV=production, so these routes prerender
// as the 404 page in a production build (no request-time path can bypass it);
// `pnpm dev` renders them normally.

interface DevLayoutProps {
  children: ReactNode;
}

export default function DevLayout({ children }: DevLayoutProps) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return children;
}
