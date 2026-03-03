import { test as base, expect } from "@playwright/test";

/**
 * Extended Playwright test fixture for Plinth E2E tests.
 * Auth is handled by TEST_MODE env var — no Clerk login needed.
 */
export const test = base;
export { expect };
