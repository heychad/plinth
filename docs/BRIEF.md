# Plinth — Platform Brief
**Status:** Named. Pre-Build.
**Date:** February 18, 2026
**Domain:** onplinth.ai ✓
**Trademark:** USPTO TESS search clean in Class 42 ✓
**Author:** Chad (builder) + Claude Code research session

---

## The One-Sentence Vision

A white-label AI agent platform that consultants license, brand as their own, and resell to their clients — with a central agent repository, per-client credential management, and a chat interface for clients to self-customize their agents.

---

## The Business Model

### Three Tiers

```
Chad (Platform Owner)
  ├── Builds and maintains the platform
  ├── Maintains master agent template library
  └── Licenses to consultants at ~$1,000/month
        ↓
  Maeve Ferguson (Consultant — Tier 1 Customer)
  ├── Brands the platform as "Smart Scale"
  ├── Manages her client roster from one dashboard
  ├── Assigns/unassigns agent bundles per client
  └── Charges clients $3,500/month (5 agents + consulting)
        ↓
  Spa Owner / Course Creator / Speaker (End Client)
  ├── Uses their branded agent suite
  ├── Connects their own accounts (Google, Slack, GHL, etc.)
  └── Eventually: customizes agents via chat interface
```

### Economics

| Item | Amount |
|------|--------|
| Platform license (Chad → Maeve) | ~$1,000/month |
| End client fee (Maeve → client) | ~$3,500/month (5 agents + consulting) |
| Claude API cost per client | ~$20–50/month actual usage |
| Composio (OAuth integrations) | ~$49–149/month flat for all clients |
| Gross margin at 10 clients | ~85–90% |

**At scale:** 10 consultants like Maeve × 10 clients each = $100K/month in platform licenses alone — before touching any end-client revenue.

**Why this is high-leverage:** Chad stops billing hourly. Revenue becomes recurring and scales with the consultant's client base, not Chad's time.

### Custom Agent Economics

- Standard package (5 agents): bundled in monthly fee
- Custom/bespoke agents: one-off build fee + ongoing hosting/management per month
- Maeve retains consulting margin on top of platform fee

---

## Why This Exists (The Problem with Lindy)

1. **Cost at scale** — Lindy credits run $2–5K/month across Maeve's client accounts. At $20–50/month in actual Claude API costs, the platform markup is 50–100x.

2. **No white-labeling** — Clients see Lindy's brand, not Maeve's. No ability to build "Smart Scale" as Maeve's own product.

3. **No central repository** — Every agent update requires manual copy-paste across every client account. 20 clients = 20 manual updates. One change cannot propagate.

4. **No end-user control** — Clients cannot self-service. No customization without Maeve or Chad intervening.

5. **GUI-based = AI can't help build it** — Claude Code cannot read, write, or improve Lindy agents. Every agent is manual clicks. Moving to code-based agents means Claude Code can generate, clone, and improve agents programmatically.

---

## Existing Agent Library (Ready to Port)

These agents already exist as markdown/JSON files in the Maeve folder and represent the first product suite for the platform:

### Thought Leader / Consultant Suite

| Agent | What It Does | Folder |
|-------|-------------|--------|
| Content Repurposing Machine | Newsletter → 10 content formats (posts, threads, email, etc.) | mkting-005 |
| YouTube SEO Optimizer | 7-agent pipeline: analysis → optimization → Google Doc output | essetino-002 |
| YouTube Intelligence | 8-agent pipeline: competitor scouting → topic synthesis → formatted brief | essetino-003 |
| LinkedIn Scout & Connector | Computer use: finds and connects with ideal prospects on LinkedIn | mkting-006 |
| Speaking Engagement Scout | Finds and evaluates speaking opportunities, generates strategy | mkting-003 |
| Social Intelligence Monitor | Collects + analyzes content across LinkedIn, Instagram, YouTube, Facebook | mkting-002 |
| Lead Scorer | Scores inbound leads against ICA criteria | sales-001 |

**This is a ready-made product suite for thought leaders, consultants, and speakers — exactly Maeve's client base.**

### Coaching / Course Operations

| Agent / App | What It Does | Notes |
|-------------|-------------|-------|
| Coaching Call Monitor | Zoom transcript → Claude rubric analysis → coach feedback dashboard | addo-001, fully PRD'd |

The Coaching Call Monitor (addo-001) is a template for any coaching/course business. Fully spec'd with a Supabase schema, Lovable-ready frontend PRD, and backend architecture doc.

---

## Core Architectural Decisions

### 1. Agent Configs Are Data, Not Code

Every agent is a row in a database. The code that runs agents is generic. The config — system prompt, tone, tools, locked fields, template linkage — is what makes each client's agent unique.

```json
{
  "tenant_id": "spa_001",
  "agent_name": "content-machine",
  "template_id": "content-machine-v3",    ← points to Chad's master
  "system_prompt": "You are a content strategist for [business_name]...",
  "tone": "professional",
  "locked_fields": ["allowed_tools", "core_behavior"],
  "client_customizable": ["tone", "business_name", "target_audience"]
}
```

This enables:
- Clone agent to new client = one DB operation
- Client updates config via chat = written to DB, immediate effect
- Chad/Maeve pushes template update = propagates to all linked clients
- Full version history, zero code deploys

### 2. The Integration Slot Pattern (Solves the Auth Problem)

Agent templates reference integration slots by name — never hold credentials. Each client connects their own accounts once. Updating an agent template never forces clients to re-authenticate.

```
Agent Template:          integration_slots: ["google_sheets", "slack", "ghl"]
                                              ↓
Tenant Credential Store: spa_001 → google_sheets → Composio entity abc123
                         spa_001 → slack        → Composio entity def456
                         spa_001 → ghl          → custom OAuth token (Supabase vault)
```

At runtime: agent loads template → looks up credentials by slot name → Composio/Supabase returns live token → agent executes with client's credentials.

### 3. The Locked Fields Pattern (Consultant Control)

Maeve controls which parts of each agent clients can and cannot change. Enforced at the database layer, not just in prompts.

```json
"locked_fields": ["allowed_tools", "core_behavior", "output_format"]
"client_customizable": ["tone", "business_name", "audience_description", "posting_schedule"]
```

Clients can make it their own. They can't break it.

### 4. Meta-Agent: Chat to Configure

Phase 3 feature — clients talk to a configurator agent to change how their other agents behave:

> *"Make my content more formal and focus more on LinkedIn than email"*

The configurator reads the current config → interprets the natural language request → validates the change against locked_fields → writes back to DB → the agent uses the new config on next run.

**This UX does not exist as a product anywhere.** It's the moat.

---

## Recommended Technical Stack

Research across 4 separate threads converged on this stack:

| Layer | Technology | Why |
|-------|-----------|-----|
| Web App + API | Next.js 15 (App Router) | Full-stack, one deployment, webhook endpoints |
| Auth + Database | Supabase (Postgres + RLS) | Multi-tenant isolation via Row-Level Security, auth built-in |
| AI Intelligence | Anthropic Client SDK | `messages.create()` — control the loop, track per-tenant costs |
| OAuth / Integrations | Composio | 250+ integrations, MCP support, multi-tenant entities, $49/month |
| GoHighLevel | Custom OAuth in Supabase | GHL not in Composio; ~3-5 days custom build |
| Browser Automation | Playwright MCP | LinkedIn Scout, web research, computer use tasks |
| Email | Resend | Transactional notifications |
| Hosting | Vercel (early) → Railway/Fly.io (scale) | Free tier works to start |

**Total infrastructure cost:** ~$100–250/month for 10 active clients.

### Why Anthropic Client SDK (Not Agent SDK)

Two different products:
- **Anthropic Client SDK** (`messages.create()`) — for request-response SaaS patterns. You control the loop. Per-request billing and logging. ✓ Use this.
- **Claude Agent SDK** — autonomous long-running tasks (what powers Claude Code). Not designed for multi-tenant SaaS request patterns.

For autonomous multi-step agents (LinkedIn Scout, web research), the Agent SDK's loop handling IS valuable. The right answer is: client SDK for simple agents, Agent SDK for autonomous ones — your choice per agent type.

---

## Phased Roadmap

### Phase 1 — Foundation (4–8 weeks)
**Goal:** One consultant (Maeve), all current agents migrated, all current clients onboarded

- Next.js + Supabase setup with multi-tenant RLS
- Agent config database with template → client linking
- Composio integration for Google/Slack/Notion
- Custom GHL OAuth flow
- Maeve admin dashboard: manage clients, assign agents, view usage
- Client portal: view active agents, connect integrations
- Migrate existing 7 agents from Lindy

**Outcome:** Maeve's book is fully off Lindy. Monthly cost drops from $2–5K to ~$150.

### Phase 2 — Polish + First External Consultant (8–16 weeks)
**Goal:** Prove the platform works for a second "Maeve"

- White-label theming per consultant (logo, colors, domain)
- Consultant onboarding flow (self-serve signup)
- Usage tracking and reporting per tenant
- Agent template marketplace (Chad's library, consultants browse and assign)
- Improve agent quality based on real production usage

**Outcome:** First external consultant paying license fee. Proof of repeatable model.

### Phase 3 — Client Self-Service (16+ weeks)
**Goal:** End clients can customize their own agents via chat

- Meta-agent chat interface
- Config diff/preview before applying changes
- One-click rollback to template defaults
- "Reset to Maeve's version" button
- Version history per agent per client

**Outcome:** Differentiated product. Clients actively engaged with their agents. High retention.

### Phase 4 — Platform Business (ongoing)
**Goal:** Agent marketplace, consultant network, vertical expansion

- Agent marketplace: consultants can publish their own templates
- Multi-vertical: beyond Maeve's thought leaders (e.g., real estate, fitness, law)
- In-platform billing (Stripe, usage invoicing)
- Analytics: which agents drive most value per vertical

---

## Naming Status

### Ruled Out

| Name | Reason |
|------|--------|
| **Lattice** | $3B HR SaaS (lattice.com) launched AI Agent product March 2025. Class 42 trademark. All domains taken. |
| **Weave** | NYSE-listed Weave Communications (WEAV, $237M ARR) holds Class 42 trademark. W&B Weave is a direct AI agent product in the same namespace. Weaviate ambient confusion. All domains taken. |
| **Relay** | relay.app is a funded, active AI agent automation platform. Direct competitor. |
| **Conduit** | conduit.ai is a YC-backed AI agent platform. Direct competitor. |
| **Scaffold** | scaffoldai.com is active. "Agent scaffolding" is an established technical term — SEO gravity problem. |
| **Forge** | forge.com is Forge Global (fintech). forge.ai is active. |
| **Loom** | Owned by Atlassian (acquired from Loom). |
| **Frame** | frame.io owned by Adobe. |

### The One Clear Name

**Plinth** — CLEAR across all checks.

Zero active tech companies. No Class 42 trademark conflicts found. No domain squatting on .io or .ai. Out of 20+ names researched, this is the only one that came back clean.

**The metaphor:** A plinth is the architectural base/pedestal that a statue or column stands on. It's invisible infrastructure — you see what's on top of it, not the plinth itself. Consultants put their brand (Smart Scale, etc.) on top. The platform disappears underneath.

> *"Smart Scale, built on Plinth"*
> *"Your agents, running on Plinth"*

**Next steps to confirm:**
1. Check WHOIS directly on `plinth.io` and `plinth.ai`
2. Run USPTO TESS search for PLINTH in Class 42
3. If both clean → register domain + file trademark intent-to-use

### Ruled Out (Full List)

| Name | Reason |
|------|--------|
| **Lattice** | $3B HR SaaS. AI Agent product. Class 42 trademark. |
| **Weave** | NYSE-listed Weave Communications (WEAV). W&B Weave (AI agents). All domains taken. |
| **Relay** | relay.app — funded AI agent automation platform. Direct competitor. |
| **Conduit** | conduit.ai — YC-backed AI agent platform. Direct competitor. |
| **Scaffold** | scaffoldai.com active. "Agent scaffolding" is an established tech term. |
| **Forge** | forge.com is Forge Global (fintech). forge.ai active. |
| **Loom** | Owned by Atlassian. |
| **Frame** | frame.io owned by Adobe. |
| **Truss** | Baseten ML framework. TrussWorks SaaS. All domains taken. |
| **Gantry** | $28M-funded MLOps startup at gantry.io. |
| **Fulcrum** | YC-backed agentic AI debugger + 5 other active SaaS companies. |
| **Tether** | World's largest stablecoin ($100B+ USDT) + launching Tether AI. |
| **Helm** | CNCF graduated Kubernetes package manager. Linux Foundation trademark. |
| **Keystone** | $100M-funded global tech firm. KeystoneJS framework. YC startup. |
| **Cadence** | Cadence Design Systems (Nasdaq: CDNS, ~$50B, 91 registered trademarks). |
| **Motif** | $46M-funded AEC design platform (ex-Autodesk founders). |
| **Flux** | CNCF graduated GitOps tool + multiple funded startups. |
| **Mortar** | mortar.ai active. mortar.io active. |
| **Pylon** | YC-backed, ~$50M raised AI-native B2B support platform. |
| **Trellis** | YC 2023 AI startup (runtrellis.com). trellis.co ecom AI. |
| **Mesh** | mesh.ai active HR SaaS. mesh-ai.com active. |
| **Arbor** | $6.3M-funded enterprise AI research (NYC). Arbor AI Studio in same category. |
| **Stratum** | GE Healthcare holds Class 42 USPTO registration. |
| **Keel** | $13M-funded backend/ops SaaS at keel.so — adjacent space. |

### Maeve's Brand

Maeve is calling her version **"Smart Scale"** — this is her white-label name for her clients. The underlying platform (Chad's product) needs a separate name that consultants license.

### Naming Principles (From Research)
- Short structural/architectural words that *locate* rather than *explain*
- Infrastructure register (like Vercel, Railway, Linear)
- Own the .com or .ai — no "get" or "use" prefixes on a $3B incumbent
- Trademark in Class 42 must be clear

---

## Key Open Questions

| Question | Impact |
|----------|--------|
| What's the platform name? | Everything else follows |
| First agent to migrate off Lindy? | Determines Phase 1 scope |
| Does Maeve want to co-invest / co-own? | Changes the business relationship |
| What do we charge consultants — flat, per-agent, per-client? | Pricing model design |
| Self-serve consultant signup or invite-only at first? | Determines Phase 1 build scope |
| Which agent to migrate off Lindy first? | Scopes Phase 1 build |

---

## Research Files in This Folder

| File | Contents |
|------|---------|
| `research/platform-research-2026-02-18.md` | White-label SaaS architecture · Agent platform comparison (Claude SDK vs ADK vs LangGraph vs n8n vs Dify) · OAuth credential management (Composio vs Nango vs Auth0 Token Vault, GoHighLevel OAuth specifics) |

---

## Related Work

- **Maeve's agent library:** `/Users/heychad/vibes/work/stimulus/maeve/` — all existing agents
- **lindy-builder:** `/Users/heychad/vibes/work/stimulus/maeve/lindy-builder/` — existing programmatic agent builder (Python + Claude SDK) — the seed of the platform engine
- **addo-001 Coaching Call Monitor:** `/Users/heychad/vibes/work/stimulus/maeve/addo/addo-001/` — fully PRD'd app, template for coaching/course vertical
