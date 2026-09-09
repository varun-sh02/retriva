import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // An unrelated package-lock.json in the parent directory
  // (/Users/varunshah/projects/) otherwise confuses Turbopack's workspace-root
  // auto-detection.
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },
};

export default nextConfig;
