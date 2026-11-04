import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // GitHub Pages serves this repository as a project site under /food-calendar.
  // Keep local development at the root URL.
  output: "export",
  basePath: process.env.GITHUB_ACTIONS ? "/food-calendar" : "",
  trailingSlash: true,
  images: { unoptimized: true },
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
