import type { NextConfig } from "next";
import { config } from "dotenv";
import path from "path";

// Single shared .env at the repo root (used by both scraper and web).
config({ path: path.join(__dirname, "..", ".env") });

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname, ".."),
  },
  images: {
    // Listing photos come from many third-party CDNs; skip optimization.
    unoptimized: true,
  },
};

export default nextConfig;
