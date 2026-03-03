# Plinth — Session Handoff

**Updated:** 2026-03-03
**Sprint/Phase:** Cycle 6 complete. 38/40 items passing. 2 items remaining (39, 40).

## Current State
Plinth has a full backend (13 tables, auth, CRUD, Agent SDK execution, Zoom integration, 4-step coaching pipeline with Format+Deliver, GitHub template sync) and complete frontend for both consultant and client portals. All backpressure checks pass (tsc, eslint, build). Clerk is not configured at runtime — builds work via fallback but auth fails at runtime. **29 local commits unpushed — `git push` first, then `/kickoff-sprint` for final 2 items.**

## What Exists

```
plinth/
├── CLAUDE.md                                  # Project conventions + stack docs
├── PRD.json                                   # 40 items — 38 passing, 2 remaining
├── PROGRESS.md                                # Sprint log with cycles 1-6 results + Signs
├── convex/
│   ├── schema.ts                             # 13 tables with indexes
│   ├── auth.ts                               # requireAuth, requireRole, getCurrentUser
│   ├── consultants.ts                        # getConsultant + updateConsultant (Cycle 6)
│   ├── tenants.ts, users.ts                  # Base CRUD
│   ├── themes.ts                             # get/upsert theme, logo upload
│   ├── agentTemplates.ts                     # Template library queries
│   ├── agentConfigs.ts                       # Config CRUD + getClientHome (Cycle 5)
│   ├── agentRuns.ts, agentRunSteps.ts        # Run + step tracking
│   ├── coachingCallReports.ts                # Reports + listCoachingReportsForConsultant (Cycle 6)
│   ├── credentials.ts                        # OAuth + listIntegrationsForTenant (Cycle 5)
│   ├── dashboard.ts, clientDetail.ts, runDetail.ts  # Composite queries
│   ├── execution/
│   │   ├── agentWorkflow.ts, simpleWorkflow.ts, executeAgent.ts, executeSimple.ts
│   │   ├── coachingPipeline.ts               # Intake + Analyze steps
│   │   ├── formatStep.ts                     # Google Doc creation (Cycle 6)
│   │   └── deliverStep.ts                    # Report save + flagged email (Cycle 6)
│   ├── integrations/                         # googleDocs, resend, composio, zoom
│   ├── webhooks/
│   │   ├── zoom.ts                           # Zoom webhook handler
│   │   ├── github.ts                         # GitHub template sync (Cycle 6)
│   │   └── composioCallback.ts               # OAuth callback
│   └── http.ts                               # All HTTP routes registered
├── src/
│   ├── middleware.ts                          # Clerk middleware with role-based routing
│   ├── components/                           # ThemeProvider, StatCard, StatusBadge, StepTimeline, etc.
│   └── app/
│       ├── (consultant)/
│       │   ├── layout.tsx                    # Consultant nav bar (Cycle 6)
│       │   ├── dashboard/page.tsx            # Stats + client roster
│       │   ├── clients/                      # Roster, detail (4 tabs), run detail
│       │   ├── agents/page.tsx               # Template library
│       │   ├── reports/page.tsx              # Cross-client reports list (Cycle 6)
│       │   ├── reports/[reportId]/page.tsx   # Report detail + transcript (Cycle 6)
│       │   └── settings/page.tsx             # Profile/Theme/Notifications tabs (Cycle 6)
│       └── (client)/app/
│           ├── layout.tsx                    # Client nav sidebar (Cycle 5)
│           ├── page.tsx                      # Client home — agent grid + stats (Cycle 5)
│           ├── agents/[agentConfigId]/page.tsx           # Agent detail + run trigger (Cycle 5)
│           ├── agents/[agentConfigId]/runs/[runId]/page.tsx  # Real-time run detail (Cycle 5)
│           ├── integrations/page.tsx         # OAuth connect/disconnect (Cycle 5)
│           ├── reports/page.tsx              # Coach reports list (Cycle 5)
│           └── reports/[reportId]/page.tsx   # Coach report detail (Cycle 5)
├── scripts/ralph/backpressure.sh             # Verification gate
└── specs/                                    # 10 spec files — read-only ground truth
```

## What Was Decided

- **Agent SDK is primary** — Client SDK is fallback only.
- **`(internal as any).module.fn` pattern** — Convex codegen stale; all cross-module refs use this cast (SIGN-1).
- **httpAction uses Web Crypto API** — Node `crypto` incompatible with Convex bundler (SIGN-11).
- **Builders never run git commands** — lead is sole git operator (SIGN-7). Pattern proven over 4 cycles.
- **Clerk-optional fallback** — ConvexClientProvider falls back when Clerk keys missing (SIGN-15).
- **ESLint split globals** — browser globals (incl DOM types, File API) for src/, node globals for convex/ (SIGN-13).
- **No unconfigured ESLint rule references** — react-hooks and @next/next plugins not installed; don't use eslint-disable for those rules (SIGN-16).
- **Buffer.from for base64 in Convex** — `atob` is browser-only; actions must use `Buffer.from(str, 'base64').toString()` (SIGN-17).
- **docUrl stored in rawAnalysisJson** — no dedicated schema field; acceptable for Phase 1.

## What Was Done This Session

- **Cycle 5 (Items 32-36):** Client portal UI — 5 parallel builders, zero file overlap
  - Client home page with branded header, agent grid, quick stats
  - Agent detail with config self-service, dynamic run trigger form
  - Real-time run detail with step timeline
  - Integrations page with OAuth connect/disconnect
  - Coach reports pages (read-only)
  - Added getClientHome + listIntegrationsForTenant queries
  - Fixed: DOM type ESLint globals, missing start time in run header

- **Cycle 6 (Items 20, 23, 30, 31):** Backend + consultant pages — 4 parallel builders
  - GitHub webhook validates HMAC-SHA256, syncs templates from git
  - Pipeline Format step (Google Doc) + Deliver step (report save + flagged email)
  - Consultant reports: cross-client list with filters, detail with transcript viewer + editable narrative + Send to Coach
  - Consultant settings: Profile/Theme (live preview)/Notifications tabs
  - Added updateConsultant mutation, listCoachingReportsForConsultant query
  - Fixed: atob→Buffer.from, File ESLint global, unconfigured rule comments, type annotations

## What's In Progress
- `.claude/HANDOFF.md` modified (this file) — needs commit
- **29 commits ahead of origin/main — need to `git push`**

## What To Do Next
1. **`git push`** — 29 local commits unpushed
2. **Run `/kickoff-sprint`** for Cycle 7 (final) — 2 items remaining:
   - **Item 40:** Template propagation — `syncAgentConfigWithTemplate` mutation + "Update Available" UI badge (depends on Item 20, now done)
   - **Item 39:** E2E QA verification scenario (QA-only, not a build item) — requires full pipeline working end-to-end
3. **Consider Clerk setup** — Item 39 (E2E QA scenario) may be blocked without Clerk auth working at runtime

## Key Numbers
- **PRD:** 38/40 items passing (up from 29/40 at session start)
- **This session:** +9 items across 2 cycles, ~6,000 lines added
- **Convex deployment:** `hallowed-snail-756`
- **Tables:** 13 with indexes
- **Active Signs:** 1, 7, 11, 13, 14, 15, 16, 17
- **Commits ahead of origin:** 29

## Gotchas
- **Clerk not configured** — builds pass but auth fails at runtime. Blocks E2E testing and Item 39.
- **`(internal as any)` everywhere** — Convex codegen stale. Every internal ref needs the cast.
- **Web Crypto API only in httpAction** — Node crypto and `atob` both fail.
- **`npm install` needs `--legacy-peer-deps`** — eslint version conflict.
- **Frontend API imports use `(api as any)`** — codegen doesn't include new modules until `npx convex dev` runs.
- **Don't reference react-hooks or @next/next ESLint rules** — plugins not installed, comments cause errors.
- **coachTalkPercent always null** — needs zoomUserId→coach mapping table (not yet built).

## Human Context
- Sprint is nearly complete (38/40). Item 40 is the last real build item; Item 39 is QA-only.
- 29 unpushed commits — push before starting next cycle.
- Sprint builder pattern (5 parallel builders, zero file overlap, lead-only git) has worked cleanly for 4 cycles. Don't change it.
- Item 39 (E2E QA) may need Clerk auth configured first — currently blocked.
- GitHub account for this project: `heychad` (personal), not `chad-careatlas` (work).
- User prefers maximum code output per session with minimal overhead.
