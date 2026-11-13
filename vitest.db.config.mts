import { defineConfig } from "vitest/config";
import path from "node:path";

// DB tests run separately (they need TEST_DATABASE_URL and a disposable Postgres).
export default defineConfig({
  test: { include: ["tests/db/**/*.test.ts"], environment: "node", testTimeout: 60_000, hookTimeout: 180_000, fileParallelism: false },
  resolve: { alias: { "@": path.resolve(import.meta.dirname, ".") } },
});
