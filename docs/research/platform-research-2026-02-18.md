# Research: Plinth Platform
Date: 2026-02-18
Topics: White-Label Agent SaaS · Proprietary Agent Platform · OAuth Credential Management

---

## Part 1: White-Label AI Agent SaaS

### Meta-Agent Architecture (Agents that configure other agents)

A meta-agent reads the current agent config, interprets the user's natural language request, and writes the updated config back to storage. On next invocation, the target agent loads the updated config.

**The practical pattern:**
```
User: "Make my appointment reminder more friendly and add emojis"
     ↓
Configurator Agent reads: agents/{tenant_id}/appointment-reminder.json
     ↓
Identifies: tone="formal" → tone="friendly, casual", emoji_enabled=false → true
     ↓
Writes updated JSON back to storage
     ↓
Next run: loads updated config
```

**Claude Agent SDK support:**
- Dynamic system prompts: `systemPrompt` accepts a string constructed at runtime from DB values
- Sessions: resumable via `resume: sessionId` for persistent configurator chat threads
- Hooks: `PreToolUse` / `PostToolUse` enforce tenant-level guardrails
- Subagents: configurator can spawn a subagent to test a proposed config before committing

**Config storage (maps to Supabase tables):**
```json
{
  "id": "uuid",
  "tenant_id": "tenant_uuid",
  "agent_name": "appointment-reminder",
  "system_prompt": "You are a friendly spa assistant...",
  "tone": "friendly",
  "emoji_enabled": true,
  "allowed_tools": ["Email", "Calendar"],
  "locked_fields": ["allowed_tools"],
  "template_id": "base-reminder-v2",
  "version": 3,
  "updated_by": "user_chat",
  "updated_at": "2026-02-18T..."
}
```

**The gap is real:** No clean "end user talks to a chat UI and changes how their AI behaves" product exists. This is the differentiated UX to build.

### Security Risks for User-Configurable Agents

- **Prompt injection via config** — #1 OWASP LLM risk, present in 73% of production AI deployments
- **Cross-agent escalation** — agents can conspire to grant each other elevated permissions
- **System prompt exfiltration** — crafted configs can cause agents to reveal other tenants' data

**Mitigation:**
1. Locked fields enforced at DB layer, not just in prompts
2. Config validation layer — checks for injection patterns before writing
3. Diff review — show user exactly what changed before applying
4. Sandboxed test run — run updated config on test prompt before committing
5. Audit log — every change logged with who, what, when

### What's Already in the Market

| Platform | Pricing | Key Features | Limitation |
|----------|---------|--------------|-----------|
| **Stammer.ai** | $97-$497/mo | Chat + voice, social channels, white-label | Chatbot-focused, not general agents |
| **Lety.ai** | $97-$497/mo | Import n8n/Make flows, white-label billing | Workflow automation focus |
| **Insighto.ai** | Varies | Multi-tenant dashboard, isolated data | Chat/voice only |
| **CustomGPT** | Varies | GDPR/SOC2, white-label, no-code | Document Q&A focus |

**Key insight:** None are "consultants build custom AI workflows for specific client verticals." They all offer template libraries. The Maeve model — deeply understanding spa businesses, building purpose-specific agents — is a differentiated position. These platforms charge $97-497/month AND take a margin on AI usage.

### Multi-Tenant Architecture

**Two-layer isolation model:**
```
Layer 1: Auth — Supabase RLS, tenant_id on every row
Layer 2: Agent isolation — configs scoped to tenant_id, usage tracked per tenant
Layer 3: Consultant super-admin — sees all tenants, pushes template updates, locks fields
```

**Supabase RLS pattern:**
```sql
CREATE POLICY "tenant_isolation" ON agent_configs
  USING (tenant_id = auth.jwt() -> 'tenant_id');
```

**Recommended tables (MVP):**
```
tenants              - client businesses (spa name, owner, plan)
users                - people who log in (linked to tenant)
agent_configs        - one row per agent per tenant
agent_templates      - master templates (cloned to tenants)
config_history       - audit log of config changes
chat_sessions        - meta-agent conversations
usage_logs           - API calls, tokens, cost per tenant
```

**API layer pattern:**
```
/api/chat/[tenantId]         → runs the agent for that tenant
/api/configure/[agentId]     → meta-agent chat (reads/writes agent_configs)
/api/admin/templates         → template management
/api/admin/tenants           → onboard new clients
```

### Phased Build Recommendation

**Phase 1 (MVP):** Supabase + Next.js + Claude API (standard client SDK). No meta-agent yet — Maeve configures all agents directly via admin panel.

**Phase 2 (Self-Service Config):** Add meta-agent configurator chat UI, locked fields enforcement, config diff + confirmation UX, version history + rollback.

**Phase 3 (Scale):** Template propagation system, usage dashboard + billing, multi-channel triggers.

### Anthropic Branding Note

Anthropic allows building on Claude API and white-labeling. The Agent SDK branding guidelines: don't call it "Claude Code" or mimic Claude Code's branding. "Powered by Claude" is allowed. Custom domain + logo = full white-label possible.

---

## Part 2: Proprietary Agent Platform Options

### Anthropic Claude Agent SDK

**What it is:** Programmatic wrapper giving code access to the autonomous agent loop that powers Claude Code. Python + TypeScript.

**Core primitives:**
- Agent loop (Thought → Tool Use → Observation) — SDK handles this, you stream messages
- Built-in tools: Read/Write/Edit, Bash, Glob/Grep, WebSearch, WebFetch, AskUserQuestion
- Subagents via `Task` tool — each runs in isolated context window
- Sessions: persistent context, resumable, forkable
- Hooks: PreToolUse, PostToolUse, Stop, SessionStart
- MCP: connect to external systems (Composio has 500+ integrations as MCP servers)

**Browser automation:**
```python
options=ClaudeAgentOptions(
    mcp_servers={"playwright": {"command": "npx", "args": ["@playwright/mcp@latest"]}}
)
```

**Computer Use (Beta):** Claude controls actual browser via screenshot + click. Still beta as of early 2026. Not recommended for unattended production automation.

**Key limitations:**
- Claude models only — no model flexibility
- Local/single-user by default — no native multi-tenancy, concurrent users, or persistent state
- Not a platform — you build the web app, auth, multi-tenancy, UI, deployment

**Best for:** Autonomous context-heavy single-task agents. CI/CD pipelines, research agents, nightly automation.

### Google Agent Development Kit (ADK)

**What it is:** Open-source Python/TypeScript framework for multi-agent systems. v0.5.0 — pre-1.0 as of research date.

**Key differentiator:** Model-agnostic — supports Claude, Llama, Mistral via Vertex AI or LiteLLM.

**Built-in:** Sequential, parallel, loop, and LLM-driven routing patterns. Visual web UI for inspecting execution. Evaluation framework.

**Key limitations:** Pre-1.0 API instability. Google/Vertex ecosystem bias. Less mature MCP ecosystem.

### Framework Comparison

| Dimension | Claude Agent SDK | Google ADK | LangGraph | CrewAI |
|-----------|-----------------|------------|-----------|--------|
| Best for | Autonomous single tasks | Multi-agent orchestration | Complex branching workflows | Role-based teams |
| Model support | Claude only | Model-agnostic | Model-agnostic | Model-agnostic |
| Production maturity | GA | Pre-1.0 | GA (most battle-tested) | GA |
| Multi-tenancy | None native | None native | None native | None native |
| MCP/integrations | Excellent | Developing | Via LangChain | Custom |
| Learning curve | Low | Medium | Steep | Low |
| Lock-in | Anthropic | Google/Vertex | LangChain | CrewAI platform |

**Verdict on all frameworks:** None is a complete platform. All require building substantial infrastructure on top.

### "Batteries Included" Platforms

| Platform | Multi-Tenancy | White-Label | Browser Auto | Best For |
|----------|--------------|-------------|-------------|---------|
| **n8n** | Manual/bolted-on | Community request (enterprise pricing) | Poor (requires Browserless) | API-based workflows |
| **Dify** | Workspaces (basic), Enterprise (paid) | AWS Marketplace only | Via plugins | Visual builder foundation |
| **Flowise** | Cloud-only for advanced features | No | Via LangChain tools | Prototyping |
| **Relevance AI** | Single-tenant/private cloud | Limited | Via integrations | Non-technical builders |

### Build Options Compared

| Approach | Time to MVP | Control | Browser Auto | Client Self-Service |
|----------|-------------|---------|-------------|-------------------|
| n8n + Claude API | 2-4 weeks | Medium | Poor | No |
| Dify self-hosted | 4-6 weeks | Medium | Limited | Possible |
| Claude SDK + LangGraph | 8-16 weeks | Full | Excellent (Playwright MCP) | Yes (custom) |
| CrewAI + custom portal | 6-10 weeks | High | Good (MCP) | Yes (custom) |

**Recommended approach (from research):** The brief's chosen stack (Next.js + Supabase + Anthropic Client SDK + Composio) is the right call. Standard client SDK (`messages.create()`) for request-response patterns; Agent SDK only for autonomous multi-step agents like LinkedIn Scout.

### Key Constraints

1. **Computer Use is beta** — Use Playwright MCP for browser automation instead, not computer use API
2. **MCP ecosystem is the integration story** — Don't build custom integrations for Google/Slack/etc.
3. **Multi-tenancy is the hardest part** — Tenant isolation in credential store is the critical engineering challenge
4. **Agent prompts ARE the product** — Keep agent configs as data (DB rows), not baked into code

---

## Part 3: OAuth Credential Management

### The Core Pattern

All major platforms converge on the "token vault + integration slot" pattern:

```
Agent Template (DB)
  integration_slots: ["google_sheets", "slack", "ghl"]  ← named slots, no credentials

Tenant Credential Store (separate table/service)
  tenant_id: "spa_001"
  slots:
    google_sheets: composio_entity_id: "abc123", status: "active"
    slack:         composio_entity_id: "def456", status: "active"
    ghl:           encrypted_token: "...", status: "active"

Agent Runtime
  1. Load template (no credentials)
  2. Look up tenant credential store
  3. For each slot, fetch live token from Composio/vault
  4. Inject tokens into tool context (NOT the system prompt)
  5. Execute — credentials never logged, never in agent state
```

**Key design principles:**
- Integration slots are named, not credentialed — agent template never knows what token it is
- Template updates don't touch credentials — no re-authentication needed after template update
- Credentials never enter the agent's context window
- Token refresh is background, not blocking
- Connect UI is completely decoupled from agent UI

### Composio

**What it is:** Managed SaaS purpose-built for AI agent OAuth. Handles full "auth → tool execution" loop.

**Multi-tenant:** Each client = one entity. Agent calls Composio with (tool_name + entity_id). Tokens never touch your app code. Auto token refresh included.

**Integrations:** 250+ including Google Workspace, Slack, Notion, HubSpot. **GoHighLevel is NOT listed.**

**Claude/Anthropic support:** Yes — provides MCP servers for all 250+ integrations.

**Pricing:**
- Free: 100 actions/month
- Starter: ~$49/month (5,000 actions/month)
- Growth: ~$149/month (25,000 actions/month)
- $25K startup credits available

**Tradeoffs:**
- Pro: Zero credential management code, fastest path to multi-tenant agent auth, SOC 2
- Con: Closed source, vendor dependency, action-based pricing scales with usage
- Con: GoHighLevel not supported

### Nango

**What it is:** Open-source OAuth management (600+ APIs), self-hostable. Handles auth + credential lifecycle. You write your own tool execution code on top.

**Multi-tenant:** Each client = connection keyed by (integration_name + connection_id). Fetch token: `nango.getToken('google-sheets', connectionId)`.

**Tradeoffs:**
- Pro: Open source (5k+ GitHub stars), self-hostable, 600+ APIs, full control over tool execution
- Pro: Better observability (OpenTelemetry)
- Con: More engineering — Nango gives you tokens, you write the tool code
- Con: No native MCP server ecosystem

### Auth0 Token Vault

**What it is:** Auth0's "Auth0 for AI Agents" (GA 2025). User completes OAuth through Auth0, token stored in Token Vault, agent requests token for current user.

**Best for:** If you're already using Auth0 for user auth — natural extension. Implements RFC 8693 "token exchange" pattern.

**Tradeoffs:**
- Pro: Unified auth story — user login + third-party OAuth in one platform
- Con: Narrower integration library (30+), not cheap at scale, no MCP ecosystem

### GoHighLevel OAuth Specifics

- Full OAuth 2.0 via Developer Marketplace (Authorization Code Grant)
- Access tokens expire in ~24 hours; refresh tokens valid up to 1 year (rotate on use)
- Two access levels: Location-level (sub-account) and Agency-level
- Rate limits: 200,000 API requests/day per marketplace app per resource
- Neither Composio nor Nango prominently lists GHL as a pre-built integration

**GHL options:**
- Option A: Custom OAuth integration within Nango (supports custom OAuth configs)
- Option B: Handle GHL OAuth manually, store tokens in Supabase + pgcrypto
- Option C: API key auth instead of OAuth (simpler, no refresh, less secure)

### Engineering Effort Comparison

| Approach | Effort | What You Build | What They Handle |
|----------|--------|---------------|-----------------|
| Composio | 1-2 days | Connect UI, pass entity_id at runtime | Everything else |
| Nango | ~1 week | Connect UI, fetch token, write tool functions | OAuth dance, storage, refresh |
| Custom (Supabase) | 2-4 weeks | OAuth handlers, storage, refresh job, connect UI | Nothing |

**Recommended middle path:** Composio for Google/Slack/Notion (90% of the surface, zero integration code) + custom GHL OAuth in Supabase (~3-5 days). Total: ~1-2 weeks vs. 4-8 weeks fully custom.

### Schema

```sql
-- Agent template (no credentials)
CREATE TABLE agent_templates (
  id UUID PRIMARY KEY,
  slug TEXT UNIQUE,
  integration_slots TEXT[],   -- ['google_sheets', 'slack', 'ghl']
  system_prompt TEXT,
  version INT,
  updated_at TIMESTAMPTZ
);

-- Per-tenant credential connections
CREATE TABLE tenant_integrations (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  slot_name TEXT,             -- 'google_sheets'
  provider TEXT,              -- 'google'
  composio_entity_id TEXT,    -- if Composio
  encrypted_token TEXT,       -- if custom (GHL)
  token_expires_at TIMESTAMPTZ,
  refresh_token_encrypted TEXT,
  status TEXT DEFAULT 'pending',  -- pending | active | expired | revoked
  connected_at TIMESTAMPTZ,
  UNIQUE(tenant_id, slot_name)
);
```

---

## Sources

### White-Label SaaS
- [Stammer.ai](https://stammer.ai/) — Closest structural analog
- [Lety.ai White-Label Platform](https://www.lety.ai/white-label-ai-agent-platform)
- [Supabase RLS for Multi-Tenancy](https://www.antstack.com/blog/multi-tenant-applications-with-rls-on-supabase-postgress/)
- [OWASP LLM Top 10: Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)
- [CustomGPT White-Label Comparison](https://customgpt.ai/white-label-ai-platform/)

### Agent Platforms
- [Claude Agent SDK Overview](https://platform.claude.com/docs/en/agent-sdk/overview)
- [Building Agents with the Claude Agent SDK](https://claude.com/blog/building-agents-with-the-claude-agent-sdk)
- [Google ADK Documentation](https://google.github.io/adk-docs/)
- [LangGraph Platform GA](https://blog.langchain.com/langgraph-platform-ga/)
- [CrewAI Pricing](https://www.crewai.com/pricing)
- [Dify GitHub](https://github.com/langgenius/dify)
- [Composio MCP](https://composio.dev/)
- [Multi-Tenant AI SaaS Architecture](https://digitaloneagency.com.au/multi%E2%80%91tenant-ai-saas-architecture-in-2025-isolation-residency-billing-guardrails-the-complete-guide/)

### OAuth / Credentials
- [Composio AgentAuth](https://composio.dev/agentauth)
- [Composio Pricing](https://composio.dev/pricing)
- [Nango GitHub](https://github.com/NangoHQ/nango)
- [Nango Auth Overview](https://nango.dev/auth)
- [Auth0 Token Vault for AI Agents](https://auth0.com/blog/auth0-token-vault-secure-token-exchange-for-ai-agents/)
- [GoHighLevel OAuth 2.0 Docs](https://marketplace.gohighlevel.com/docs/Authorization/OAuth2.0/index.html)
- [What is a Token Vault](https://www.scalekit.com/blog/token-vault-ai-agent-workflows)
