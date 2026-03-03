#!/usr/bin/env bash
set -euo pipefail

# Ralph Loop — automated build cycle for Plinth UI sprint
# Reads PRD.json, finds next unfinished item, builds it, verifies, marks done.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PRD="$PROJECT_ROOT/PRD.json"
PROGRESS="$PROJECT_ROOT/PROGRESS.md"
BACKPRESSURE="$SCRIPT_DIR/backpressure.sh"

if [ ! -f "$PRD" ]; then
  echo "ERROR: PRD.json not found at $PRD"
  exit 1
fi

# Find first item with passes: false
NEXT_ITEM=$(python3 -c "
import json, sys
with open('$PRD') as f:
    data = json.load(f)
for item in data['items']:
    if not item.get('passes', False):
        print(item['id'])
        sys.exit(0)
print('DONE')
")

if [ "$NEXT_ITEM" = "DONE" ]; then
  echo "All PRD items are passing. Sprint complete."
  exit 0
fi

echo "=== Ralph Loop ==="
echo "Next item: $NEXT_ITEM"
echo "PRD: $PRD"
echo "Project: $PROJECT_ROOT"
echo ""
echo "To build this item, run Claude Code with:"
echo ""
echo "  Build PRD item $NEXT_ITEM. Read PRD.json for the item details,"
echo "  read the referenced spec file, implement the item, then run"
echo "  scripts/ralph/backpressure.sh to verify."
echo ""
echo "=== End Ralph Loop ==="
