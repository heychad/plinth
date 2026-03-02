# Plinth — Session Handoff

**Updated:** 2026-03-02
**Sprint/Phase:** Cycle 1 complete. 6/40 items passing. Ready for Cycle 2.

## Current State
Plinth is a white-label AI agent platform. Foundation layer is built: Convex schema (10 tables), auth helpers, base CRUD for consultants/tenants/users, theming, and agent run tracking. Convex deployment is live (`hallowed-snail-756`). All checks pass (tsc, eslint, convex typecheck, next build). **Run `/kickoff-sprint` to continue with Cycle 2.**

## What Exists

```
plinth/
├── CLAUDE.md                                  # Project conventions + stack docs
├── PRD.json                                   # 40 items — 6 passing, 34 remaining
├── PROGRESS.md                                # Sprint log with cycle 1 results
├── package.json                               # convex, next@16, react@19, @clerk/nextjs
├── tsconfig.json                              # Excludes convex/ (Convex has own tsconfig)
├── next.config.ts                             # Minimal
├── eslint.config.mjs                          # @eslint/js + @typescript-eslint/parser
├── .gitignore                                 # node_modules, .next, convex/_generated, .env*
├── .env.local                                 # CONVEX_DEPLOYMENT, NEXT_PUBLIC_CONVEX_URL
├── convex/
│   ├── schema.ts                             # 10 tables, all fields/validators/indexes
│   ├── convex.config.ts                      # Minimal (no components yet)
│   ├── auth.ts                               # requireAuth, requireRole, getCurrentUser
│   ├── consultants.ts                        # getConsultant
│   ├── tenants.ts                            # listTenants, createTenant
│   ├── users.ts                              # createUser
│   ├── themes.ts                             # get/upsert theme, logo upload
│   ├── agentRuns.ts                          # triggerAgentRun, getAgentRun, listRuns, cancelRun, updateRunStatus
│   ├── agentRunSteps.ts                      # listAgentRunSteps
│   ├── tsconfig.json                         # Convex-specific TS config
│   └── _generated/                           # Auto-generated types from deployment
├── src/app/
│   ├── layout.tsx                            # Minimal root layout
│   └── page.tsx                              # Minimal home page
├── scripts/ralph/backpressure.sh             # Verification gate script
├── specs/                                     # 10 spec files — read-only ground truth
└── docs/                                      # BRIEF.md + research
```

## What Was Decided

### Stack
| Layer | Technology |
|---|---|
| Backend + DB | **Convex** — real-time, Agent/RAG components |
| Auth | **Clerk** — JWT with tenant metadata |
| Frontend | **Next.js 16 App Router** on **Vercel** |
| AI (primary) | **Anthropic Agent SDK** (`claude_agent_sdk`) |
| AI (fallback) | **Anthropic Client SDK** — simple single-call only |
| AI (embeddings) | **OpenAI text-embedding-3-small** via Convex RAG |
| Integrations | **Composio** (OAuth) + **Resend** (email) |

### Key Architecture Decisions
- Root tsconfig excludes `convex/` — Convex type-checked via `convex/tsconfig.json`
- ESLint flat config with `@eslint/js` + `@typescript-eslint/parser` (not eslint-config-next compat)
- Multi-tenancy pattern: `requireAuth()` → check role → scope by consultantId/tenantId
- All tables in single `convex/schema.ts`; CRUD in separate files per domain area
- `uploadThemeLogo` uses Convex `generateUploadUrl` pattern
- `triggerAgentRun` has TODO stubs for workflow scheduling (depends on Item 9)

## What Was Done This Session
- Ran `/kickoff-sprint` Cycle 1 targeting Items 1, 2, 3, 4, 5, 8
- Initialized project from scratch: npm, Convex, Next.js, TypeScript, ESLint
- Built all foundation schema (10 tables with validators + 22 indexes)
- Built auth helpers (requireAuth, requireRole, getCurrentUser)
- Built core CRUD (consultants, tenants, users, themes, agentRuns, agentRunSteps)
- Created and connected Convex deployment (`hallowed-snail-756`)
- All 4 checks green: tsc, eslint, convex typecheck, next build
- Updated PRD.json (6 items passing) and PROGRESS.md with cycle 1 results
- Updated global CLAUDE.md to allow auto-commits

## What's In Progress
All cycle 1 work is **uncommitted** — needs `git add` + `git commit`. Files:
- Modified: `.claude/HANDOFF.md`, `PRD.json`, `PROGRESS.md`
- New: `.gitignore`, `convex/` (8 files), `eslint.config.mjs`, `next.config.ts`, `package.json`, `package-lock.json`, `src/`, `tsconfig.json`, `next-env.d.ts`, `.env.local`

## What To Do Next
1. **Commit cycle 1 work** — all files are ready, all checks pass
2. **Run `/kickoff-sprint`** for Cycle 2 — next batch: Items 6 (agent config CRUD), 7 (client-restricted config view), 9 (Workflows setup), 10 (executeAgent action)
3. **Set up Clerk** — `CLERK_ISSUER_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` not yet configured. Auth helpers won't work at runtime until Clerk is connected.
4. **Verify Zoom org structure** — pending confirmation from Daniela (single shared account vs separate coach accounts). Affects Items 17-18.

## Key Numbers
- **PRD:** 6/40 items passing (foundation category nearly complete — Items 6, 7 remain)
- **Convex deployment:** `hallowed-snail-756` (team: `chad-owen-40028`, project: `plinth`)
- **Tables provisioned:** 10 with 22 indexes
- **Convex limits:** 10-min action timeout, 1 MiB doc size, 32K doc scan per query
- **Domain:** onplinth.ai

## Gotchas
- **`.claude/plans/phase-1-2026-02-19.md` is OUTDATED** — uses Supabase. Specs in `specs/` are source of truth.
- **Agent SDK is primary** — all agents use Agent SDK. Don't default to Client SDK.
- **No DB-level RLS** — every query/mutation must call `requireAuth()` and check tenant_id.
- **sprint-builder agents may idle without producing files** — monitor and re-engage via SendMessage. Lead may need to write code directly for stuck builders.
- **convex/_generated/ is gitignored** — regenerated on `npx convex dev`. Don't commit it.
- **`.env.local` has Convex secrets** — gitignored, don't commit. Contains `CONVEX_DEPLOYMENT` and `NEXT_PUBLIC_CONVEX_URL`.
- **Item 40 (template propagation)** — in first-agent category despite id 40. Build after Item 20.
- **Item 33 depends on Item 35** — stub `listIntegrationsForTenant` if building in parallel.

## Human Context
- Convex deployment is live and connected. Just run `/kickoff-sprint` to continue building.
- Zoom org structure still pending from Daniela — don't build Items 17-18 until confirmed.
- User trusts auto-commits. Global CLAUDE.md updated to allow commits after tasks.
- GitHub account for this project: `heychad` (personal), not `chad-careatlas` (work).
