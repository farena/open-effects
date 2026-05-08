import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup-env.ts"],
    include: [
      "tests/**/*.test.ts",
      "tests/**/*.test.tsx",
      "tests/**/*.bench.ts",
    ],
    // Tests share a single MariaDB; serialize file execution to avoid
    // cross-file contention (foreign-key violations from concurrent
    // deleteMany / create on the same Project rows).
    fileParallelism: false,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
