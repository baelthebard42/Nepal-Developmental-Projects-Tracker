import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // deck.gl's interleaved overlay can't re-attach to the same WebGL context after StrictMode's
  // dev-only double mount. Production never double-mounts, so this only affects `next dev`.
  reactStrictMode: false,
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
