import type { NextConfig } from "next";

/**
 * F-L3: Security and optimization config.
 */
const nextConfig: NextConfig = {
  // Standalone output for optimized Docker deployment
  output: 'standalone',

  // Image optimization
  images: {
    unoptimized: false,
  },

  // Security headers
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      ],
    },
  ],
};

export default nextConfig;
