# Plinth — Session Handoff

**Updated:** 2026-03-02
**Phase:** Pre-build. Sprint planning complete (specs written, reviewed, approved). PRD.json generation is next.

## Current State
Plinth is a white-label AI agent platform — consultants license it, brand as their own, resell to clients. No code exists yet. 10 detailed spec files have been written and reviewed with the user during a `/plan-sprint` session. The next step is generating PRD.json and sprint artifacts, then running `/kickoff-sprint` to start building.

## What Exists

```
plinth/
├── docs/
│   ├── BRIEF.md                              # Complete business + tech vision (the source document)
│   └── research/
│       └── platform-research-2026-02-18.md   # White-label SaaS, agent platforms, OAuth research
├── specs/                                     # 10 spec files — ground truth for the build
│   ├── platform-foundation.md                # Convex schema, Clerk auth, multi-tenancy, roles
│   ├── white-label-theming.md                # Per-consultant branding, CSS variables, theme from DB
│   ├── agent-config-system.md                # Template→instance model, locked fields, git-backed templates
│   ├── agent-execution-engine.md             # Agent SDK primary, Convex Workflows, real-time status
│   ├── agent-memory-system.md                # Convex RAG + Agent components, per-tenant memory
│   ├── coaching-call-analyzer.md             # Templatized agent, configurable curriculum/rubric
│   ├── zoom-integration.md                   # Webhook, VTT parsing, transcript storage
│   ├── output-integrations.md                # Google Docs via Composio, email via Resend
│   ├── consultant-dashboard.md               # Maeve's UI — clients, agents, reports
│   └── client-portal.md                      # End client UI — agents, runs, integrations
├── .claude/
│   ├── research/
│   │   └── maeve-agents-2026-02-19.md        # Agent inventory from Maeve's existing Lindy library
│   ├── plans/
│   │   └── phase-1-2026-02-19.md             # Original Phase 1 plan (Supabase-based — OUTDATED, replaced by specs)
│   └── insights/
│       ├── thinking.md                       # Decision log template (empty)
│       └── workflow.md                       # Workflow patterns template (empty)
```

**No code. No package.json. No git repo initialized.** Everything is documentation and specs.

## What Was Decided

### Stack (changed from original BRIEF)
| Layer | Technology | Notes |
|---|---|---|
| Backend + DB | **Convex** (not Supabase) | Real-time subscriptions, native vector search, Agent/RAG components |
| Auth | **Clerk** | First-class Convex integration, tenant metadata in JWT claims |
| Frontend | **Next.js 15 App Router** | Unchanged from BRIEF |
| Hosting | **Vercel** (frontend) + **Convex Cloud** (backend) | |
| AI (primary) | **Anthropic Agent SDK** | All agents default to Agent SDK. Client SDK is fallback only. |
| AI (embeddings) | **OpenAI text-embedding-3-small** | Used by Convex RAG + Agent components |
| Integrations | **Composio** | OAuth proxy for Google, Slack, etc. GHL is custom. |
| Email | **Resend** | Transactional notifications |

### Key Architectural Decisions
- **Agent SDK is primary execution mode** — not Client SDK. All agents (including coaching call analyzer) use agentic loops, tool use, and extended thinking. Client SDK is a fallback for simple single-call operations.
- **Convex RAG + Agent components** for memory — not rolling our own embedding pipeline. `@convex-dev/rag` for long-term knowledge, `@convex-dev/agent` for conversation memory.
- **Git-backed templates** — agent templates authored as JSON in a GitHub repo, synced to Convex via webhook on push. PRs for template changes. Tenant configs managed in DB via platform UI.
- **Multi-tenancy via app-layer auth checks** — Convex has no DB-level RLS. Every query/mutation must check tenant_id. Requires disciplined code + test coverage.
- **Coaching call analyzer is templatized** — curriculum, rubric dimensions, scoring anchors are all config data. Growth Factor is the first deployment, not the only one.
- **Usage-based pricing model** — consultant subscription + per-client fee based on agent count.

### First Agent
**Coaching Call Quality Analyzer** — not one of the original 7 Lindy agents. It's a new agent based on the Lindy "Coaching Call Monitor" with addo-001 PRD assets. The agent analyzes coaching call transcripts against a configurable rubric and curriculum, generates scored reports, and notifies the program admin.

Related assets in the Maeve folder:
- `/Users/heychad/vibes/work/stimulus/maeve/addo/addo-001/PRD.md` — full PRD
- `/Users/heychad/vibes/work/stimulus/maeve/addo/addo-001/PRD-LOVABLE.md` — frontend spec
- `/Users/heychad/vibes/work/stimulus/maeve/addo/addo-001/agents/` — 4 agent step definitions
- `/Users/heychad/vibes/work/stimulus/maeve/addo/addo-001/.claude/research/` — Zoom/GHL research

## What Was Done This Session
- Ran `/plan-sprint` — full interactive sprint planning session
- Researched Convex (3 parallel researchers): multi-tenancy patterns, AI/agent components, Next.js integration
- Researched Convex RAG component capabilities
- Fetched and analyzed the Open Brain memory system reference
- Received and analyzed the full Lindy JSON export for the Coaching Call Monitor
- Explored existing addo-001 assets (PRD, frontend spec, agent definitions, research)
- Wrote all 10 spec files via sprint-specifier agent
- Reviewed all 10 specs with the user one-by-one
- Updated agent-config-system.md: added git-backed template version control
- Rewrote agent-execution-engine.md: Agent SDK primary, Client SDK fallback, extended thinking, tool use
- Rewrote agent-memory-system.md: replaced custom embedding pipeline with Convex RAG + Agent components

## What To Do Next

1. **Generate PRD.json** — spawn sprint-planner agent to read all 10 specs and produce:
   - `PRD.json` — prioritized build items with verification steps
   - `CLAUDE.md` — project-level operational knowledge
   - `scripts/ralph/backpressure.sh` — verification gate
   - `PROGRESS.md` — sprint log
   This is Phase 5 of the `/plan-sprint` skill. The team (`plan-sprint-plinth`) still exists but all agents except the lead have been shut down — spawn a new `sprint-planner` agent.

2. **Initialize git repo** — no git repo exists yet. Should be done before or during PRD generation.

3. **Run `/kickoff-sprint`** — once PRD.json exists and user approves, this kicks off the build with scout→builder→QA agents.

4. **Verify Zoom org structure** — user needs to confirm with Daniela whether coaches are individual users under one org Zoom account (current spec assumption) or separate accounts. This affects credential model in zoom-integration spec.

## Key Numbers
- **Business model:** Platform license ~$1K/month per consultant, end-client fee ~$3.5K/month
- **Target:** 10 consultants x 10 clients each = $100K/month in platform licenses
- **Infrastructure cost:** ~$100-250/month for 10 active clients
- **Claude API cost per client:** ~$20-50/month actual usage
- **Convex action timeout:** 10 minutes (checkpoint-and-continue for longer agents)
- **Convex doc size limit:** 1 MiB
- **Convex query scan limit:** 32K documents
- **Domain:** onplinth.ai (secured)

## Gotchas
- **`.claude/plans/phase-1-2026-02-19.md` is OUTDATED** — it's the original Phase 1 plan using Supabase + Inngest. The 10 specs in `specs/` are the current source of truth (Convex + Agent SDK).
- **No git repo** — project directory exists but has no `.git`. Need to initialize before building.
- **Convex has no DB-level RLS** — every query/mutation must explicitly check tenant_id. Missing a check = data leak between tenants. Need comprehensive auth tests.
- **Agent SDK is the primary mode** — the user explicitly wants to lean into Agent SDK for all agents, including the coaching call analyzer. Don't default to Client SDK pipelines.
- **Memory uses Convex components** — `@convex-dev/rag` and `@convex-dev/agent`, not custom embedding pipeline. Don't roll your own.
- **Templates are git-backed** — agent templates live in a separate GitHub repo and sync to Convex via webhook. The Convex DB is a runtime cache, not the source of truth for templates.
- **Plan-sprint team still exists** — `~/.claude/teams/plan-sprint-plinth/` — should be cleaned up (TeamDelete) after PRD generation.
