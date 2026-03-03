# Plinth — Session Handoff

**Updated:** 2026-03-03
**Sprint/Phase:** Backend sprint complete (40/40). UI sprint planned (65 items). Ready to build.

## Current State
Backend sprint is done — 40/40 PRD items passing. UI redesign sprint has been fully planned: 8 specs written + reviewed, PRD.json replaced with 65 UI items (foundation → functional → ui → integration → test-backend → test-e2e). Two rounds of comprehensive review completed with all blockers fixed. Convex deploy key configured so `npx convex dev` works without clobbering global login. **All planning outputs are uncommitted.**

## What Exists

```
plinth/
├── CLAUDE.md                        # Updated with UI sprint constraints
├── PRD.json                         # 65 UI sprint items (replaces 40 backend items)
├── PROGRESS.md                      # Sprint log (cycles 1-8 backend, UI sprint pending)
├── PROMPT.md                        # Ralph loop instructions (NEW)
├── convex/                          # Full backend — 13 tables, auth, CRUD, Agent SDK, Zoom, pipeline
├── src/                             # Existing frontend — consultant + client portals (to be redesigned)
├── tests/                           # Playwright E2E (15 coaching pipeline tests)
├── design-system/                   # NEW — design system docs + page overrides
│   └── plinth/pages/client-chat.md  # Chat interface design override
├── specs/                           # 10 backend specs (read-only) + 8 NEW UI specs
│   ├── ui-design-system-foundation.md
│   ├── ui-auth-and-routing.md
│   ├── ui-shared-polish.md
│   ├── ui-client-chat-interface.md
│   ├── ui-client-onboarding.md
│   ├── ui-document-store.md
│   ├── ui-consultant-redesign.md
│   └── ui-consultant-user-management.md
├── scripts/ralph/
│   ├── backpressure.sh              # Verification gate
│   └── loop.sh                      # NEW — Bash loop for unattended building
└── playwright.config.ts
```

## What Was Decided

- **65 UI items** consolidated from 118 raw items (8 specs × parallel PRD writers → merge)
- **Mutation name corrections**: `deployAgentConfig` (not createAgentConfig), `upsertTheme` (not updateTheme), `sendReportToCoach` (not releaseReportToCoach)
- **4 missing backend mutations** consolidated in PRD Item 20: markReviewed, updateTenant, expanded updateConsultant (businessName/supportEmail), Plus Jakarta Sans in VALID_FONT_FAMILIES, `v.literal("general")` in schema
- **Client detail page**: 4 tabs initially (Overview, Agents, Runs, Reports), Users tab added later (Item 48)
- **Onboarding sidebar suppression**: needs sub-layout or route group to avoid inheriting client sidebar
- **Existing consultant nav bar** (from Cycle 6) needs replacement — Item 34 has WARNING
- **`NEXT_PUBLIC_TEST_MODE`** (Next.js Edge Runtime) vs **`TEST_MODE`** (Convex backend) — different env vars
- **Convex deploy key** configured: `CONVEX_DEPLOY_KEY` in .env.local for multi-project auth
- **npm install needs `--legacy-peer-deps`** — eslint version conflict

## What Was Done This Session

- UI sprint planning via `/plan-sprint` (Phases 4-6): 8 specs → 8 PRD writers → merge → 2 review rounds
- 118 raw items consolidated to 65 final items with dependency ordering
- Two comprehensive review rounds: fixed mutation names, missing backends, tab counts, sidebar issues
- Fixed specs: middleware path (`src/middleware.ts`), `user.reload()` → `router.refresh()`, breadcrumb Fragment keys
- Replaced `client-chat.md` design override (was wrong marketing template)
- Added UI sprint constraints to CLAUDE.md
- Configured Convex deploy key in .env.local (tested with `npx convex dev --once`)

## What's In Progress

- **All planning outputs uncommitted** — PRD.json, 8 UI specs, CLAUDE.md, PROGRESS.md, PROMPT.md, loop.sh, design-system/
- `convex/seedUser.ts` untracked (unknown origin — investigate before committing)
- `.DS_Store` files scattered (gitignore candidates)
- `test-results/` untracked (gitignore candidate)

## What To Do Next

1. **Commit planning outputs** — stage specs, PRD.json, CLAUDE.md, PROGRESS.md, PROMPT.md, loop.sh, design-system/
2. **Add `.DS_Store` and `test-results/` to .gitignore**
3. **Run `/kickoff-sprint`** — builds the 65-item UI sprint
4. **Or run `bash scripts/ralph/loop.sh`** — unattended building

## Key Numbers

- **Backend PRD:** 40/40 items passing (complete)
- **UI PRD:** 65 items, 0 passing (ready to build)
- **UI Specs:** 8 files
- **Convex deployment:** `graceful-otter-634` (deploy key configured)
- **Clerk:** `renewed-escargot-45.clerk.accounts.dev`
- **First users:** Chad + Maeve + ~4 coaches

## Gotchas

- **PRD.json was REPLACED** — now has 65 UI items, not the original 40 backend items. Backend items are already built.
- **Mutation name drift** — specs used intent names, codebase has implementation names. PRD items corrected. Watch for: `deployAgentConfig` (NOT createAgentConfig), `upsertTheme` (NOT updateTheme).
- **Existing frontend files need REPLACING, not appending** — consultant layout, client layout already exist from backend sprint.
- **@blocknote/mantine + Tailwind v4** — potential compatibility concern. BlockNote's Mantine dep may conflict with Tailwind v4. Monitor during build.
- **`(internal as any)` everywhere** — Convex codegen stale. Every internal ref needs the cast.
- **"use node" files can't have queries/mutations** — split into companion *Helpers/*Db files.
- **npm install needs `--legacy-peer-deps`** — eslint version conflict.
- **GitHub account:** `heychad` (personal) for this project, not `chad-careatlas`.
- **TEST_MODE still set on Convex deployment** — auth bypass active. Unset before production.

## Human Context

- **Key context:** Convex deploy key is now set up — `npx convex dev` works without clobbering global login.
- **Uncertainty:** @blocknote/mantine + Tailwind v4 compatibility is untested. May need workarounds during build.
- **Unwritten:** First users are Chad + Maeve + ~4 coaches. This informs UX priorities and what "good enough" looks like.
