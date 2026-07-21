import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "packages/*/tests/**/*.test.ts",
      "apps/*/tests/**/*.test.ts",
      "tests/e2e/**/*.test.ts",
    ],
    // workspace packages resolve via package.json exports → src
    environment: "node",
  },
});
