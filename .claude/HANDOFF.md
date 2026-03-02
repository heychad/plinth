# Plinth — Session Handoff

**Updated:** 2026-03-02 (third handoff — PRD reviewed and finalized)
**Phase:** Pre-build. Specs written + reviewed. PRD.json reviewed through 3 cycles and finalized. **Ready for `/kickoff-sprint`.**

## Current State
Plinth is a white-label AI agent platform. 10 spec files written and approved. PRD.json has been through 3 review/fix cycles (sprint-reviewer → sprint-planner → reviewer → planner → reviewer → direct fixes). **40 items, 0 blockers, all findings resolved.** No code exists yet.

## What Exists

```
plinth/
├── CLAUDE.md                                  # Project conventions + stack docs
├── PRD.json                                   # 40 build items, reviewed & finalized
├── PROGRESS.md                                # Sprint log with 3 review cycles documented
├── scripts/ralph/backpressure.sh              # Verification gate script
├── docs/
│   ├── BRIEF.md                              # Complete business + tech vision
│   └── research/
│       └── platform-research-2026-02-18.md
├── specs/                                     # 10 spec files — ground truth for the build
│   ├── platform-foundation.md                # Convex schema, Clerk auth, multi-tenancy, roles
│   ├── white-label-theming.md                # Per-consultant branding, CSS variables, theme from DB
│   ├── agent-config-system.md                # Template→instance, locked fields, git-backed templates
│   ├── agent-execution-engine.md             # Agent SDK primary, Convex Workflows
│   ├── agent-memory-system.md                # Convex RAG + Agent components
│   ├── coaching-call-analyzer.md             # Templatized agent, configurable curriculum/rubric
│   ├── zoom-integration.md                   # Webhook, VTT parsing, transcript storage
│   ├── output-integrations.md                # Google Docs via Composio, email via Resend
│   ├── consultant-dashboard.md               # Maeve's UI — clients, agents, reports
│   └── client-portal.md                      # End client UI — agents, runs, integrations
├── .claude/
│   ├── HANDOFF.md                            # This file
│   ├── research/maeve-agents-2026-02-19.md
│   ├── plans/phase-1-2026-02-19.md           # OUTDATED — Supabase-based, replaced by specs
│   └── insights/{thinking,workflow}.md       # Empty templates
```

**Git:** 1 commit (`3712add`). PRD.json, CLAUDE.md, PROGRESS.md, scripts/ are untracked — need to be committed before build.

## What Was Decided

### Stack
| Layer | Technology |
|---|---|
| Backend + DB | **Convex** (not Supabase) — real-time, Agent/RAG components |
| Auth | **Clerk** — JWT with tenant metadata |
| Frontend | **Next.js 15 App Router** on **Vercel** |
| AI (primary) | **Anthropic Agent SDK** (`claude_agent_sdk`) — all agents default to this |
| AI (fallback) | **Anthropic Client SDK** — simple single-call operations only |
| AI (embeddings) | **OpenAI text-embedding-3-small** via Convex RAG component |
| Integrations | **Composio** (OAuth proxy) + **Resend** (email) |

### Key Decisions
- **Agent SDK is primary** for ALL agents including coaching call analyzer — not Client SDK
- **Convex RAG + Agent components** for memory — don't roll your own
- **Git-backed templates** — templates in GitHub repo, synced to Convex via webhook
- **Multi-tenancy is app-layer** — no DB-level RLS, every function checks tenant_id
- **Coaching call analyzer is templatized** — curriculum/rubric as config data, not hardcoded

## What Was Done This Session

### Planning (prior session)
- Ran `/plan-sprint` — full interactive planning with 3 parallel researchers + specifier + planner
- Wrote 10 spec files, reviewed all with user one-by-one
- Updated 3 specs during review (agent-config-system, agent-execution-engine, agent-memory-system)
- PRD.json generated (33 items) by sprint-planner agent

### PRD Review (this session)
- **Round 1:** sprint-reviewer found 5 blockers, 6 omissions, 3 sizing issues, 9 warnings. Sprint-planner fixed all → 33 items became 39.
- **Round 2:** sprint-reviewer found 1 new blocker, 1 omission, 6 warnings. Sprint-planner fixed all → 39 items in-place.
- **Round 3:** sprint-reviewer found 0 blockers, 1 omission, 4 warnings. Applied directly → 39 items became 40.
- All findings resolved. PRD is clean.

## What To Do Next

1. **Commit sprint artifacts** — PRD.json, CLAUDE.md, PROGRESS.md, scripts/ralph/backpressure.sh, HANDOFF.md
2. **Run `/kickoff-sprint`** — PRD is approved, kick off the build
3. **Verify Zoom org structure** — pending confirmation from Daniela (single org account vs separate coach accounts)

## Key Numbers
- **PRD.json:** 40 items across 5 categories (foundation 8, core-system 8, first-agent 8, ui 14, integration 2)
- **Item 39** is a QA verification scenario, NOT a build item
- **Business model:** ~$1K/month per consultant, ~$3.5K/month per end client
- **Target:** 10 consultants × 10 clients = $100K/month platform revenue
- **Convex limits:** 10-min action timeout, 1 MiB doc size, 32K doc scan per query
- **Domain:** onplinth.ai

## Gotchas
- **`.claude/plans/phase-1-2026-02-19.md` is OUTDATED** — uses Supabase + Inngest. Specs in `specs/` are the source of truth.
- **Agent SDK is primary** — user explicitly wants Agent SDK for all agents. Don't default to Client SDK.
- **Memory uses Convex components** — `@convex-dev/rag` and `@convex-dev/agent`. Don't roll your own.
- **Templates are git-backed** — GitHub repo is source of truth, Convex DB is runtime cache.
- **No DB-level RLS** — every query/mutation must check tenant_id. Missing a check = data leak.
- **Item 40 (template propagation)** was added last and is in the first-agent category despite having id 40. Build after Item 20.
- **Item 33 depends on Item 35** — integration slot status section needs `listIntegrationsForTenant`. Stub if building in parallel.
- **Item 26 modifies Item 25's query** — adds sortBy/sortDir to `listClientsForConsultant`. Build sequentially.
