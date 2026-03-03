import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  globalSetup: "./tests/global-setup.ts",
  outputDir: "./tests/results",
  workers: 1,
  retries: 2,
  timeout: 30000,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev",
    port: 3000,
    reuseExistingServer: true,
    env: {
      NEXT_PUBLIC_TEST_MODE: "true",
    },
  },
});
