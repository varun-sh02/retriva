import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // An unrelated package-lock.json in the parent directory
  // (/Users/varunshah/projects/) otherwise confuses Turbopack's workspace-root
  // auto-detection.
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },
  async headers() {
    return [
      {
        // The widget is meant to be framed by whatever site embeds it, so
        // this page opts in explicitly rather than relying on the absence of
        // a global X-Frame-Options. Stated here so that adding site-wide
        // framing protection later cannot silently break every widget.
        source: "/embed/:token*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors *" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
      {
        source: "/widget.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=300" },
          { key: "Access-Control-Allow-Origin", value: "*" },
        ],
      },
    ];
  },
};

export default nextConfig;
