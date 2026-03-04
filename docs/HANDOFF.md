# Plinth — Session Handoff

**Updated:** 2026-03-03
**Sprint/Phase:** Backend sprint complete (40/40). UI sprint planned (65 items). Directory restructure done. Ready to build.

## Current State
Backend sprint is done — 40/40 PRD items passing. UI sprint fully planned: 8 specs, 65 PRD items, design system docs. Project directory was reorganized this session — docs, specs, config all moved to cleaner locations. All planning outputs are committed. Sprint tooling (ralph) was removed and needs to be pulled fresh from its own repo before building.

## What Exists

```
plinth/
├── .claude/
│   ├── CLAUDE.md              # Project instructions (moved from root)
│   ├── HANDOFF.md             # This file
│   ├── PROGRESS.md            # Sprint log (cycles 1-8 backend, UI sprint pending)
│   ├── insights/              # RPI workflow insights
│   ├── plans/                 # RPI workflow plans
│   └── research/              # RPI workflow research
├── convex/                    # Full backend — 13 tables, auth, CRUD, Agent SDK, Zoom, pipeline
├── src/                       # Existing frontend — consultant + client portals (to be redesigned)
├── tests/
│   ├── coaching-pipeline.spec.ts  # 15 Playwright E2E tests
│   ├── global-setup.ts
│   └── helpers/auth.ts
├── docs/
│   ├── specs/                 # 10 backend specs + 8 UI specs + PRD.json
│   ├── design-system/         # Design system docs + page overrides
│   └── research/              # Platform research notes
├── playwright.config.ts       # Test output → tests/results/
└── .gitignore                 # .DS_Store, tests/results/, __pycache__ added
```

## What Was Decided

- **65 UI items** consolidated from 118 raw items (8 specs × parallel PRD writers → merge)
- **Mutation name corrections**: `deployAgentConfig` (not createAgentConfig), `upsertTheme` (not updateTheme), `sendReportToCoach` (not releaseReportToCoach)
- **4 missing backend mutations** consolidated in PRD Item 20
- **Client detail page**: 4 tabs initially, Users tab added later (Item 48)
- **Onboarding sidebar suppression**: needs sub-layout or route group
- **Existing consultant nav bar** (from Cycle 6) needs replacement — Item 34 has WARNING
- **`NEXT_PUBLIC_TEST_MODE`** (Next.js) vs **`TEST_MODE`** (Convex) — different env vars
- **Convex deploy key** configured in .env.local
- **npm install needs `--legacy-peer-deps`** — eslint version conflict
- **Directory restructure**: specs/design-system → docs/, CLAUDE.md/PROGRESS.md → .claude/, scripts removed

## What Was Done This Session

- Committed all UI sprint planning outputs (specs, PRD.json, design-system, CLAUDE.md updates)
- Added `.DS_Store`, `test-results/`, `__pycache__/` to .gitignore
- Removed `scripts/ralph/` and `PROMPT.md` (ralph tooling lives in separate repo now)
- Moved `PROGRESS.md` → `.claude/PROGRESS.md`
- Moved `specs/` → `docs/specs/` (including PRD.json)
- Moved `design-system/` → `docs/design-system/`
- Moved `CLAUDE.md` → `.claude/CLAUDE.md`
- Updated all 65 specRef paths in PRD.json (`specs/` → `docs/specs/`)
- Updated CLAUDE.md project structure and constraint references
- Configured Playwright outputDir → `tests/results/`
- Installed `ui-ux-pro-max` skill globally (`~/.claude/skills/`), removed project-local copy
- Removed stale `test-results/` and empty `scripts/` directories

## What's In Progress

- `convex/seedUser.ts` untracked (unknown origin — investigate before committing)
- 5 commits ahead of origin (not pushed)

## What To Do Next

1. **Set up sprint tooling** — pull latest ralph/backpressure from its dedicated repo
2. **Push commits** — 5 local commits ready (`git push`)
3. **Run UI sprint** — 65 items, 0 built. Use `/kickoff-sprint` or ralph loop
4. **Investigate `convex/seedUser.ts`** — unknown origin, decide whether to keep or delete

## Key Numbers

- **Backend PRD:** 40/40 items passing (complete)
- **UI PRD:** 65 items, 0 passing (ready to build)
- **UI Specs:** 8 files in `docs/specs/`
- **Convex deployment:** `graceful-otter-634` (deploy key configured)
- **Clerk:** `renewed-escargot-45.clerk.accounts.dev`
- **First users:** Chad + Maeve + ~4 coaches

## Gotchas

- **PRD.json is at `docs/specs/PRD.json`** — not project root. specRef paths point to `docs/specs/`.
- **CLAUDE.md is at `.claude/CLAUDE.md`** — not project root.
- **PRD.json was REPLACED** — 65 UI items, not the original 40 backend items.
- **Mutation name drift** — use `deployAgentConfig` (NOT createAgentConfig), `upsertTheme` (NOT updateTheme).
- **Existing frontend files need REPLACING, not appending** — layouts already exist from backend sprint.
- **@blocknote/mantine + Tailwind v4** — untested compatibility. May need workarounds.
- **`(internal as any)` everywhere** — Convex codegen stale.
- **"use node" files can't have queries/mutations** — split into companion *Helpers/*Db files.
- **npm install needs `--legacy-peer-deps`** — eslint version conflict.
- **GitHub account:** `heychad` (personal) for this project, not `chad-careatlas`.
- **TEST_MODE still set on Convex deployment** — auth bypass active. Unset before production.
- **Ralph tooling removed** — must pull fresh from dedicated repo before running sprint builds.

## Human Context

- **Key context:** Directory restructure is done — everything is committed and clean. Ready for UI sprint once sprint tooling is set up.
- **Uncertainty:** Sprint tooling (ralph/backpressure) needs to be pulled from its separate repo. The old scripts were removed this session.
- **Unwritten:** Ralph tooling now lives in a dedicated repo, not bundled in the project. Pull latest version before starting builds.
