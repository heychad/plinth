#!/usr/bin/env bash
set -uo pipefail

FAILURES=0

echo "=== Back Pressure ==="

# Type checking — TypeScript compilation
echo "--- Type Check ---"
if ! npx tsc --noEmit 2>&1 | tail -20; then
  FAILURES=$((FAILURES + 1))
fi

# Linting — ESLint with zero warnings tolerance
echo "--- Lint ---"
if ! npx eslint . --max-warnings 0 2>&1 | tail -20; then
  FAILURES=$((FAILURES + 1))
fi

# Convex schema validation — ensure schema compiles
echo "--- Convex Schema ---"
if ! npx convex typecheck 2>&1 | tail -20; then
  FAILURES=$((FAILURES + 1))
fi

# Tests — run full suite
echo "--- Tests ---"
if ! npm test 2>&1 | tail -50; then
  FAILURES=$((FAILURES + 1))
fi

# Build — Next.js production build
echo "--- Build ---"
if ! npm run build 2>&1 | tail -20; then
  FAILURES=$((FAILURES + 1))
fi

echo "=== End Back Pressure ==="

if [ "$FAILURES" -gt 0 ]; then
  echo "FAILED: $FAILURES check(s) did not pass."
  exit 1
fi

echo "ALL CHECKS PASSED."
exit 0
