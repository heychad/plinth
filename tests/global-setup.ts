import { execSync } from "child_process";

export default async function globalSetup() {
  // Set TEST_MODE on Convex deployment so requireAuth falls back to test user
  execSync("npx convex env set TEST_MODE true", { stdio: "inherit" });

  // Seed database with test data (idempotent — safe to re-run)
  execSync("npx convex run --no-push seed:seedAll", { stdio: "inherit" });
}
