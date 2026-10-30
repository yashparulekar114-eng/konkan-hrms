import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite (local Postgres) ships a WebAssembly build, so let Node load it directly.
  serverExternalPackages: ["@electric-sql/pglite"],
  experimental: { serverActions: { bodySizeLimit: "5mb" } }, // medical certificate uploads
  // The SQL migrations are read at runtime (first request sets up the database), so ship them with every route.
  outputFileTracingIncludes: { "/**": ["./supabase/migrations/**"] },
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
