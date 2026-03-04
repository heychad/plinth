#!/usr/bin/env bash
# Deflector shields — quality gate. Exit 0 = green, non-zero = red.
set -euo pipefail
FAILURES="" ; EXIT_CODE=0

check() {
  local name="$1"; shift; local output
  if output=$("$@" 2>&1); then return 0; fi
  FAILURES+=$'\n'"--- FAIL: $name ---"$'\n'"$(echo "$output" | head -30)"$'\n'
  EXIT_CODE=1
}

# ── Static checks ─────────────────────────────────────────────
[ -f tsconfig.json ]     && check "tsc" npx tsc --noEmit
[ -f eslint.config.mjs ] || [ -f .eslintrc.json ] && check "eslint" npx eslint . --max-warnings 0
[ -d convex ]            && check "convex" npx convex typecheck
[ -f next.config.ts ]    || [ -f next.config.mjs ] && check "next-build" npx next build

# ── Unit tests (vitest via npm test script) ───────────────────
grep -q '"test"' package.json 2>/dev/null && check "test" npm test

# ── E2E tests (Playwright) ───────────────────────────────────
[ -f playwright.config.ts ] && check "playwright" npx playwright test

if [ $EXIT_CODE -eq 0 ]; then echo "ALL GREEN"
else echo "$FAILURES" | head -100; fi
exit $EXIT_CODE
