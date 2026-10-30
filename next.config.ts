import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite (local Postgres) ships a WebAssembly build, so let Node load it directly.
  serverExternalPackages: ["@electric-sql/pglite"],
  experimental: { serverActions: { bodySizeLimit: "5mb" } }, // medical certificate uploads
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
