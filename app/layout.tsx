import type { Metadata } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import { NO_FLASH_SCRIPT } from "@/lib/theme";
import "./globals.css";

// Self-hosted, bundled into the image — no runtime CDN (spec §3).
// Space Grotesk (display) ships as the bundled variable TTF; Inter (body) is
// fetched by next/font at build time and self-hosted thereafter.
const spaceGrotesk = localFont({
  src: "./fonts/SpaceGrotesk-VariableFont_wght.ttf",
  weight: "300 700",
  display: "swap",
  variable: "--font-space-grotesk",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-inter",
});

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
    <html
      lang="en"
      // suppressHydrationWarning: the no-flash script mutates data-theme before
      // React hydrates, so the server-rendered attribute won't match.
      suppressHydrationWarning
      className={`${spaceGrotesk.variable} ${inter.variable}`}
    >
      <head>
        <meta name="robots" content="noindex,nofollow" />
        {/* Set data-theme before first paint to avoid a light→dark flash. */}
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
