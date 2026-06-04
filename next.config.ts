import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server image for any container runtime (spec §4).
  output: "standalone",

  // Keep the whole app out of search engines (spec §9). The meta tag in the
  // root layout is the fallback; this header is the authoritative signal.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
