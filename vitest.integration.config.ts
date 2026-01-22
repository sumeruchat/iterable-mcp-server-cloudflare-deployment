import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/integration/**/*.integration.test.ts"],
    testTimeout: 60000, // 60 seconds for integration tests (Iterable API can be slow)
    hookTimeout: 60000,
  },
});
