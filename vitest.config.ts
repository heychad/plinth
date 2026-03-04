import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [
      "node_modules/**",
      "tests/**", // Playwright E2E tests — run via `npm run test:e2e`
      "convex/**",
    ],
    passWithNoTests: true,
  },
});
