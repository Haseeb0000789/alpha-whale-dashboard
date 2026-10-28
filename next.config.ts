import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  
  allowedDevOrigins: ['10.2.0.2'],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
