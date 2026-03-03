# Ralph Loop

Automated build loop for the Plinth UI sprint. Each cycle picks the next unfinished PRD item and builds it.

## How It Works

1. Read `PRD.json` — find the first item where `passes: false`
2. Read the referenced spec file for full context
3. Build the item (create/modify files as described in spec + PRD steps)
4. Run `scripts/ralph/backpressure.sh` to verify
5. If all checks pass, mark item as `passes: true` in PRD.json
6. Append a cycle entry to `PROGRESS.md`
7. Commit changes
8. Loop back to step 1

## Key Files

- `PRD.json` — Source of truth. Items ordered by dependency. Build in order.
- `PROGRESS.md` — Sprint log. Append-only.
- `CLAUDE.md` — Stack info, conventions, constraints. Read before building.
- `scripts/ralph/backpressure.sh` — Verification gate (tsc, eslint, convex typecheck, test, build).
- `specs/` — Read-only feature specifications. Never modify.

## Rules

- Build items in order (lowest ID first that has `passes: false`)
- Do NOT skip items — later items depend on earlier ones
- Do NOT modify spec files
- Run backpressure after every item
- Commit after every passing item
- If backpressure fails, fix the issue before moving on
- Multi-tenancy enforcement in every Convex query/mutation is non-negotiable
