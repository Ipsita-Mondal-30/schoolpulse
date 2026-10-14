import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // Newsletter PDFs live in Neon (ImportedNewsletterMonth), not in the deploy bundle.
      { source: "/newsletters/:file", destination: "/api/newsletters/:file" },
    ];
  },
};

export default nextConfig;
