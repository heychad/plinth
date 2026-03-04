# Plinth — Session Handoff

**Updated:** 2026-03-03
**Sprint/Phase:** UI sprint in progress. Kessel Run loop active. 2/65 items passing.

## Current State
Backend sprint complete (40/40). UI sprint is underway via kessel-run autonomous loop — 2/65 items passing (design system foundation). Loop is running unattended. Kessel-run tooling was installed this session and backpressure.sh customized for Plinth's stack (tsc + eslint + convex typecheck + next build + Playwright E2E).

## What Exists

```
plinth/
├── .claude/
│   ├── CLAUDE.md              # Project instructions (updated with backpressure ref)
│   ├── insights/              # RPI workflow insights
│   ├── plans/                 # RPI workflow plans
│   └── research/              # RPI workflow research
├── convex/                    # Full backend — 13 tables, auth, CRUD, Agent SDK, Zoom, pipeline
├── src/                       # Frontend — consultant + client portals (being redesigned by UI sprint)
├── tests/
│   ├── coaching-pipeline.spec.ts  # 15 Playwright E2E tests (backend sprint)
│   ├── global-setup.ts
│   └── helpers/auth.ts
├── scripts/
│   └── kessel-run/
│       ├── loop.sh            # Autonomous loop (runs claude -p per parsec)
│       ├── backpressure.sh    # tsc + eslint + convex typecheck + next build + playwright
│       └── PROMPT.md          # One-item-per-parsec agent instructions
├── docs/
│   ├── HANDOFF.md             # This file
│   ├── PROGRESS.md            # Sprint log (cycles 1-8 backend + UI sprint)
│   ├── specs/                 # 10 backend specs + 8 UI specs + PRD.json (65 items)
│   ├── design-system/         # Design system docs + page overrides
│   └── research/              # Platform research notes
├── playwright.config.ts       # Test output → tests/results/
└── .gitignore                 # Includes .claude/worktrees/
```

## What Was Decided

- **Kessel-run replaces ralph** — `scripts/kessel-run/` installed from `~/vibes/tools/kessel-run`, ralph removed
- **Backpressure includes Playwright E2E** — runs if test files exist in `tests/*.spec.ts`; needs `convex dev` + `next dev` running
- **"Work on the agent, not on the app"** — guiding principle from Stripe Minions. Improving kessel-run is higher leverage than manual sprint work. See `~/.claude/insights/agent-leverage.md`
- **convex/seedUser.ts deleted** — one-time seed file, superseded by `convex/seed.ts`
- **5 directory-restructure commits pushed** to origin/main

## What Was Done This Session

- Pushed 5 pending commits (directory restructure + UI sprint planning) to origin/main
- Deleted `convex/seedUser.ts` (untracked one-time seed, not needed)
- Installed kessel-run from `~/vibes/tools/kessel-run` via `init.sh`
- Customized `scripts/kessel-run/backpressure.sh` for Plinth stack (explicit checks, Playwright E2E)
- Added backpressure command reference to `.claude/CLAUDE.md`
- Added `.claude/worktrees/` to `.gitignore`
- Updated kessel-run tool repo (`~/vibes/tools/kessel-run`):
  - Added Playwright + Cypress auto-detection to `templates/backpressure.sh`
  - Updated README and HANDOFF docs
- Saved "Work on the agent, not on the app" learning to `~/.claude/insights/agent-leverage.md` and global CLAUDE.md learnings table
- Started kessel-run loop (`./scripts/kessel-run/loop.sh`)

## What's In Progress

- **Kessel-run loop is actively running** — building UI sprint items autonomously
- **2/65 UI items passing** — Items 1 (shadcn/ui + Tailwind v4 init) and 2 (CSS variable palette)
- **2 commits ahead of origin** — the loop's Item 1 and Item 2 commits (not yet pushed)
- **Uncommitted changes:** `.claude/CLAUDE.md` (backpressure ref), `.gitignore` (worktrees entry), `scripts/kessel-run/` (new)

## What To Do Next

1. **Check loop progress** — read `docs/PROGRESS.md` and `docs/specs/PRD.json` to see how many items the loop completed
2. **Review loop output** — user will paste kessel-run output for review. Look for patterns: did it get stuck, skip items, break backpressure?
3. **Course-correct if needed** — adjust `PROMPT.md`, `backpressure.sh`, or PRD item ordering based on results
4. **Push completed work** — commits accumulate locally during the loop
5. **Feed improvements back to kessel-run** — apply learnings to `~/vibes/tools/kessel-run`

## Key Numbers

- **Backend PRD:** 40/40 items passing (complete)
- **UI PRD:** 2/65 items passing (loop running)
- **UI Specs:** 8 files in `docs/specs/`
- **Convex deployment:** `graceful-otter-634` (deploy key configured)
- **Clerk:** `renewed-escargot-45.clerk.accounts.dev`
- **First users:** Chad + Maeve + ~4 coaches

## Gotchas

- **PRD.json is at `docs/specs/PRD.json`** — not project root. specRef paths point to `docs/specs/`.
- **CLAUDE.md is at `.claude/CLAUDE.md`** — not project root.
- **PRD.json was REPLACED** — 65 UI items, not the original 40 backend items. IDs restart at 1.
- **Kessel-run loop is first real test** — may need prompt/backpressure tuning based on results.
- **Playwright needs running servers** — `convex dev` + `next dev` must be up for E2E tests in backpressure.
- **npm install needs `--legacy-peer-deps`** — eslint version conflict.
- **Mutation name drift** — use `deployAgentConfig` (NOT createAgentConfig), `upsertTheme` (NOT updateTheme).
- **Existing frontend files need REPLACING, not appending** — layouts already exist from backend sprint.
- **`(internal as any)` everywhere** — Convex codegen stale without live deployment.
- **TEST_MODE still set on Convex deployment** — auth bypass active. Unset before production.
- **GitHub account:** `heychad` (personal) for this project, not `chad-careatlas`.

## Human Context

- **Key context:** The kessel-run loop is running the 65-item UI sprint autonomously. Check PROGRESS.md and PRD.json for what it completed. Review output before steering next parsecs.
- **Uncertainty:** This is the first time kessel-run runs against a real 65-item PRD. May need prompt tuning, backpressure adjustments, or PROGRESS.md format changes based on results.
- **Unwritten:** "Work on the agent, not on the app" — from Stripe Minions blog. Improving kessel-run tooling is higher leverage than manual sprint work. Every improvement to the loop compounds into every future project.
