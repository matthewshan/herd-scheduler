import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Herd Scheduler",
  description: "Find a time that works for the whole herd.",
  // Fallback to the X-Robots-Tag header set in next.config.ts (spec §9).
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <meta name="robots" content="noindex,nofollow" />
      </head>
      <body>{children}</body>
    </html>
  );
}
