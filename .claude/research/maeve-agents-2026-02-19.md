# Research: Maeve Agent Library — Plinth Platform Seed
Date: 2026-02-19

## Objective

Catalog all existing Maeve agents, understand their structure and integrations, extract data model patterns from addo-001 and platform research, and identify the best 3 agents to seed the Plinth demo.

---

## 1. Agent Inventory

| ID | Agent Name | Purpose | Integrations | Steps | Trigger | Complexity | Sync/Async |
|----|-----------|---------|-------------|-------|---------|------------|-----------|
| mkting-005 | Content Repurposing Machine | Newsletter PDF → 25+ content pieces (5 platforms, 5 days each) → Google Docs + Slack | Google Drive (create/write 5 docs), Slack | 5 sequential creative steps + 1 Slack notify | Manual / scheduled (weekly after newsletter) | Medium — 5 parallel content modes | Async (takes time) |
| essetino-002 | YouTube SEO Optimizer | Video transcript → 2 metadata packages (search + browse) → Google Doc | Google Docs (create + update), Perplexity (2-3 searches) | 8 agent steps + 5 action nodes = 13 nodes total | Manual (chat trigger) | High — 8-agent pipeline, team-of-specialists | Async (multi-agent pipeline) |
| essetino-003 | YouTube Intelligence | Strategy doc + perf sheet → 20 video topics with full metadata → Google Doc + tracker sheet | Google Docs, Google Sheets (read + append), Perplexity (search) | 8 agent steps + 7 action nodes = 15 nodes total | Manual (chat trigger) | High — 8-agent pipeline, data-to-topics | Async (multi-agent pipeline) |
| mkting-006 | LinkedIn Scout & Connector | Computer use: finds ideal prospects on LinkedIn, logs to tracking sheet | LinkedIn (browser), Google Sheets (API) | 5 phases (verify → load → search → evaluate/log → exit) | Manual or scheduled | High — computer use/browser automation | Async (browser) |
| mkting-003 | Speaking Engagement Scout | Finds + evaluates speaking opportunities, scores, logs to sheet, Slack summary | Perplexity (5 searches max), Google Sheets (find row + append), Slack | 2 search → loop (find/is-new/is-relevant/append) → Slack | Daily 9am timer | Medium — search + loop + classify | Async (scheduled) |
| mkting-002 | Social Intelligence Monitor | Weekly browser collection of metrics from 6 social platforms → analyst → Slack report | 6x browser (computer use), Google Sheets (write + read), Slack | 7 separate agents: 6 collectors + 1 analyst | Monday 8am staggered timers | High — 7 agents, computer use | Async (scheduled, 1hr window) |
| sales-001 | Lead Scorer | Reads inbound assessment leads from spreadsheet, scores 0-100 against Golden Profile, tiers, generates report | Google Sheets (read), Google Docs (create), Slack | 5 steps: Timer → Read Sheet → Scorer Agent → Create Doc → Slack | Weekly timer (Monday 8am) | Low-medium — math/classification + report | Async (scheduled) |
| addo-001 | Coaching Call Monitor | Zoom transcript → Claude rubric analysis → dashboard for admin → coach feedback | Zoom (webhook, transcript download), GHL (read contact), Anthropic Claude, Supabase, Resend email, Slack DM | 4 agent steps: Intake → Analyzer → Formatter → Notification | Zoom webhook (`recording.transcript_completed`) | High — webhook pipeline, multi-system | Async (webhook-driven) |

---

## 2. Common Integration Patterns

### Pattern 1: Strategy Doc as Runtime Config
Used by: mkting-003, mkting-006, sales-001, essetino-002, essetino-003

Every agent reads a Google Doc at runtime that contains all client-specific configuration — ICA criteria, scoring rubrics, spreadsheet IDs, Slack channels, brand voice. The agent prompts are generic; the Google Doc is what makes them client-specific. This is the direct analog to Plinth's `agent_configs` table — the Strategy Doc pattern is the field-tested version of "configs as data."

### Pattern 2: Create-Then-Update Doc
Used by: essetino-002, essetino-003

Agent creates a blank Google Doc immediately (gives user a link), pipeline runs, then final step populates the doc. The doc ID is threaded through the pipeline. This is what makes long-running multi-step pipelines feel responsive.

### Pattern 3: Team-of-Specialists (not monolithic agent)
Used by: essetino-002 (8 steps), essetino-003 (8 steps), mkting-002 (7 agents)

Each agent step has ONE role: analyze, research, optimize for search, optimize for browse, review, format. System instructions live at the top-level (shared context). Per-step prompts are short and focused. LLMs follow focused short prompts more reliably than long multi-phase prompts.

### Pattern 4: Dedup Loop with Google Sheets
Used by: mkting-003 (speaking scout), mkting-006 (LinkedIn scout)

Before appending a new row: Find Row to check for duplicates → condition branch (new vs. exists) → if new, evaluate/score → append. The sheet IS the memory/database. This works for Lindy but is the main reason to move to Supabase: replace Find Row + condition with a simple `INSERT ... ON CONFLICT DO NOTHING`.

### Pattern 5: Staggered Timer + Shared Output
Used by: mkting-002 (social intelligence)

Multiple independent agents run at staggered times (every 2 minutes), all writing to the same Google Sheet. An analyst agent runs after all collectors complete. This is a Lindy workaround for what Plinth handles natively with async job queues.

### Pattern 6: Computer Use for Social Platforms
Used by: mkting-002 (6 collectors), mkting-006 (LinkedIn scout)

Both use Claude Opus with browser automation (computer use) to navigate platforms without APIs. mkting-006 explicitly separates: LinkedIn via browser, Google Sheets via API. This is the current production approach, but computer use is beta and fragile — Playwright MCP is the recommended replacement.

### Integration Frequency Summary

| Integration | Agents Using It | Notes |
|------------|----------------|-------|
| Google Docs (create + write) | mkting-005, essetino-002, essetino-003, sales-001, addo-001 | Most common output medium |
| Google Sheets (read + append) | mkting-002, mkting-003, mkting-006, sales-001, essetino-003 | Used as both database and output |
| Slack | mkting-002, mkting-003, mkting-005, sales-001, addo-001 | Always as notification, never primary output |
| Perplexity (search) | mkting-003, essetino-002, essetino-003, mkting-006 (indirect) | Research/competitive intelligence |
| Google (browser/computer use) | mkting-002, mkting-006 | Computer use (beta) |
| Zoom | addo-001 | Webhook trigger + transcript download |
| GHL | addo-001 | Read contact data |
| Email (Resend) | addo-001 | Transactional notifications |

---

## 3. Data Model Insights

### From addo-001 PRD (fully validated schema)

The most relevant data model for Plinth because addo-001 already made the multi-user, role-based access, webhook-triggered, AI-analysis decisions.

**Key tables (carry forward to Plinth):**
```sql
-- addo-001 calls it "coaches" and "students"; Plinth calls it "tenants" and "users"
coaches     -- id, user_id (auth), name, email, zoom_user_id, ghl_user_id
students    -- id, name, email, ghl_contact_id, coach_id (FK)
calls       -- id, coach_id, student_id, call_number, zoom_meeting_id, recorded_at, transcript_url, processed_at
analyses    -- id, call_id, overall_score, [dimension scores], highlights[], concerns[], ai_narrative, raw_json
reports     -- id, analysis_id, status (draft|sent), edited_narrative, sent_at
settings    -- id, user_id, score_threshold, slack_webhook_url
```

**Supabase RLS pattern (exact policy to reuse):**
```sql
-- Coaches see only their own data
CREATE POLICY "coach_isolation" ON calls
  USING (coach_id = (SELECT id FROM coaches WHERE user_id = auth.uid()));
-- Admin sees everything (role check via JWT claim)
```

**AI analysis output schema (Zod, structured output):**
```typescript
{
  callNumber: number,
  overallScore: number,          // 0-100
  dimensions: {
    curriculumAdherence: { score: number, notes: string, topicsCovered: string[], topicsMissed: string[] },
    homeworkFollowThrough: { score: number, notes: string, homeworkReviewed: boolean },
    coachingTechnique: { score: number, notes: string, flags: string[] },
    clientProgressTracking: { score: number, notes: string, milestonesDiscussed: boolean }
  },
  narrative: string,             // AI-generated, editable by Daniela before sending
  highlights: string[],
  concerns: string[],
  coachTalkPercent: number
}
```

**Webhook pattern:**
- Zoom fires `recording.transcript_completed` → Next.js API route receives it → validates signature → downloads VTT → parses to text → Claude analysis → writes to Supabase → sends notification if score < threshold
- Async: Vercel Function or Inngest for transcript processing (can take 5-10+ minutes)

### From Platform Research (platform-research-2026-02-18.md)

**Core Plinth tables (confirmed MVP):**
```
tenants              - client businesses (spa name, owner, plan, consultant_id)
users                - people who log in (linked to tenant, role: admin|member)
agent_configs        - one row per agent per tenant (template_id, system_prompt, tone, locked_fields[], customizable_fields[])
agent_templates      - Chad's master templates (slug, integration_slots[], system_prompt, version)
config_history       - audit log: who changed what, when, what changed
chat_sessions        - meta-agent conversations (Phase 3)
usage_logs           - API calls, tokens, cost per tenant per agent per run
tenant_integrations  - per-tenant OAuth connections (slot_name, composio_entity_id OR encrypted_token)
```

**Integration slot pattern:**
```json
{
  "agent_templates.integration_slots": ["google_sheets", "slack", "ghl"],
  "tenant_integrations": {
    "tenant_id": "spa_001",
    "slot_name": "google_sheets",
    "composio_entity_id": "abc123",
    "status": "active"
  }
}
```

**Locked fields pattern:**
```json
{
  "locked_fields": ["allowed_tools", "core_behavior", "output_format"],
  "client_customizable": ["tone", "business_name", "audience_description", "posting_schedule"]
}
```

**Security decisions confirmed:**
- Locked fields enforced at DB layer (not just prompt)
- Config validation layer checks for injection patterns before writing
- Credentials NEVER enter agent context window
- Composio for Google/Slack/Notion; custom GHL OAuth in Supabase (~3-5 days)

---

## 4. lindy-builder Architecture

`/Users/heychad/vibes/work/stimulus/maeve/lindy-builder/` contains two tools:

### lindy_builder.py
Python library that generates Lindy workflow JSON from Python configuration. Key insight: Lindy's internal `lindyStateGraph` format is:
- `type: "EntryPoint"` for triggers
- `type: "AgentState"` for LLM steps (prompt goes in `guidelines` field)
- `type: "Action"` for integrations (Google Docs, Sheets, Slack)
- Exit conditions are plain text strings on edges (not in nodes)
- Model selection is NOT in JSON — must be set in Lindy UI after import
- System instructions are NOT in JSON — must be pasted in Lindy UI

This tool is the seed of Plinth's programmatic agent builder. The pattern maps to: agent configs in DB → code generates agent execution → outputs to integrations.

### lindy-optimizer/sdk-agent/optimize.py
Multi-agent pipeline using Claude Agent SDK that parses Lindy JSON, evaluates agent output against gold standards, and rewrites node instructions. Architecture:
- Orchestrator agent (Opus) manages 3 subagents via `AgentDefinition`
- Parser subagent: reads Lindy JSON, extracts node inventory
- Evaluator subagent: compares agent output vs. human gold standard
- Rewriter subagent: generates replacement instructions

This is a direct proof-of-concept for the Plinth agent quality layer — an agent that improves other agents. Carry this pattern into the platform.

---

## 5. Recommended First 3 Agents for Plinth Demo (Maeve's "Wow" Moment)

### Tier 1 Recommendation: The Three

**Agent 1: Content Repurposing Machine (mkting-005)**
- Why first: Maeve uses this weekly. Every consultant and their clients can use it. Single-input (newsletter PDF) → massive output (25 pieces across 4 platforms). Visible, tangible wow.
- Complexity to port: Medium. 5 steps, Google Docs + Slack. No browser automation.
- Customizable fields for demo: `tone`, `business_name`, `target_audience`, `platforms_to_include`, `weekly_cta`
- Integration slots: `google_drive`, `slack`
- Demo story: "Upload your newsletter. 30 minutes later, a week of content is ready in your Google Drive and you get a Slack notification."

**Agent 2: Lead Scorer (sales-001)**
- Why second: Every client with a sales funnel needs this. Simple in/out (spreadsheet → scored report). No browser. Runs on a schedule. Easy to show ROI (pipeline value projection).
- Complexity to port: Low-medium. Timer → Read Sheet → Score → Create Doc → Slack. No browser automation.
- Customizable fields for demo: `ideal_client_criteria`, `score_thresholds`, `offer_tiers`, `slack_channel`
- Integration slots: `google_sheets`, `google_drive`, `slack`
- Demo story: "Every Monday, you get a ranked list of your hottest leads with a pipeline value projection."

**Agent 3: YouTube SEO Optimizer (essetino-002)**
- Why third: Demonstrates multi-step intelligence pipeline. High perceived value — "AI that researches and optimizes YouTube metadata" is a clear differentiator. Maeve's clients are all content creators.
- Complexity to port: High but worth it for demo. 8 agents, Perplexity search, Google Docs. Shows platform depth.
- Customizable fields for demo: `client_name`, `brand_name`, `target_avatar`, `primary_cta`, `strategy_doc_link`
- Integration slots: `google_drive`, `perplexity`
- Demo story: "Paste your transcript. Get two metadata packages — one for search, one for browse — with competitive research, in a Google Doc."

### Rationale for This Order

1. Content Machine: Highest frequency (weekly), immediately obvious value, easiest to relate to
2. Lead Scorer: Revenue-focused, clear ROI, low complexity to build and demonstrate
3. YouTube SEO: Shows platform sophistication, impresses technical buyers

The fourth agent (Speaking Engagement Scout, mkting-003) is a strong Phase 2 add — it's already timer-triggered and fully autonomous.

---

## 6. Gotchas and Constraints

### Lindy-Specific Gotchas (Don't Carry Forward)

1. **100-step limit per agent** — Some mkting-002 collectors were at risk of hitting this with retry logic. On Plinth: no limit.
2. **Model selection not in JSON** — Lindy's workflow JSON doesn't store the model. Has to be set in UI after import. On Plinth: model is in `agent_configs.model_override`.
3. **System instructions not in JSON** — Same issue. Must be pasted in Lindy UI. On Plinth: system prompt is a DB field.
4. **Computer use for social metrics (mkting-002)** — Fragile, session expiry issues, 2FA blocks. On Plinth: use official platform APIs or accept this as a known-fragile agent.
5. **Time-staggered multi-agent workaround (mkting-002)** — 7 independent Lindy agents with staggered timers to simulate parallel execution. On Plinth: native async job queue handles this.
6. **Google Sheets as database** — Works in Lindy but doesn't scale. Find Row + Append Row for dedup is slow and race-condition prone. On Plinth: Supabase with proper indexes.

### Platform Architecture Constraints

1. **GHL not in Composio** — GoHighLevel requires custom OAuth. 3-5 days to build. Blocker for addo-001 on Plinth, but not for the 3 seed agents.
2. **Computer Use is beta** — Don't use for unattended production. Use Playwright MCP instead for browser automation.
3. **Perplexity is not Composio-supported as an MCP** — mkting-003/006 use Perplexity. For Plinth: use Perplexity API directly or route through a tool-calling wrapper.
4. **Zoom webhooks need HTTPS** — Vercel handles this. addo-001 requires Zoom Business tier (not Pro) for auto-transcription.
5. **Long-running agents need async** — YouTube SEO pipeline (essetino-002) takes 5-10+ minutes. Plinth needs Inngest or similar for async jobs. Don't make users wait at a loading screen.
6. **Strategy Doc pattern → DB migration** — In Lindy, clients config their agents via Google Doc. On Plinth, this becomes `agent_configs` rows. The migration is the product — translate the Google Doc fields into the locked/customizable field schema.

### Data Model Gotchas

1. **`raw_json` in analyses table** — addo-001 stores Claude's full structured output as JSONB. Do the same in Plinth's execution_logs. The structured output is the source of truth; extracted columns are for querying.
2. **VTT → plain text parsing** — Zoom transcripts come as VTT (WebVTT) with timestamps and speaker labels. Must be parsed before sending to Claude. Speaker labels are how you compute `coachTalkPercent`.
3. **Webhook signature validation** — Both Zoom (`x-zm-signature`) and GHL require webhook signature verification. Don't skip this.
4. **Composio entity_id per client** — Each client gets their own Composio entity. The entity_id is what you pass at runtime. Composio handles the rest. Never store raw tokens in your app.
5. **`updated_by` on agent configs** — Track who changed an agent config: `"user_chat"`, `"admin"`, `"template_sync"`. This is the audit trail for rollback.

---

## 7. Architecture Patterns Worth Carrying Forward

### From lindy-builder (state-graph.md)

The Lindy JSON schema maps cleanly to Plinth's agent execution model:
- `EntryPoint` → trigger type (webhook, schedule, manual, form submission)
- `AgentState` → agent step (prompt from `agent_configs.system_prompt`)
- `Action` → integration execution (Composio entity call)
- `condition` on edges → routing logic between steps
- `guidelines` field → the prompt itself (maps to `agent_configs.system_prompt`)

On Plinth, this graph doesn't need to be stored as a Lindy-compatible JSON — it's just the agent's execution logic, which can be code (the Runner) reading from DB configs.

### The Runner Pattern

Every agent in the library follows this execution pattern:
```
1. Load agent_config for this tenant+agent
2. Resolve integration slots → fetch credentials from Composio/vault
3. Build system prompt (template + tenant customizations)
4. Execute step(s) via Anthropic messages.create()
5. For each tool call: execute via Composio (passing entity_id)
6. Write output to designated integration (Google Doc, Sheet, Slack)
7. Log usage (tokens, cost, execution_time) to usage_logs
```

This is the generic runner. The configs are what vary per tenant. The code never changes.

### The Strategy Doc → Config Migration

The biggest opportunity in the initial build: translate Maeve's existing Strategy Doc pattern into the Plinth config schema. Every `[CUSTOMIZE]` tag in the agent instructions is a `client_customizable` field. Every hardcoded behavior is a `locked_field`. This is mechanical — the existing agents have already mapped it out.

---

## 8. Summary Table for Planning Session

| Agent | Port Effort | Demo Value | Integrations Needed | Async? | Blocker? |
|-------|------------|-----------|---------------------|--------|----------|
| mkting-005 Content Machine | Medium | Very High | Google Drive, Slack | Yes (~15-20min) | None |
| sales-001 Lead Scorer | Low | High | Google Sheets, Google Drive, Slack | Yes (~3-5min) | None |
| essetino-002 YT SEO | High | High | Google Drive, Perplexity | Yes (~10-15min) | Perplexity API setup |
| mkting-003 Speaking Scout | Medium | Medium | Perplexity, Google Sheets, Slack | Yes (scheduled) | None |
| essetino-003 YT Intelligence | Very High | Medium | Google Drive, Google Sheets, Perplexity | Yes (~20-30min) | None |
| mkting-006 LinkedIn Scout | Very High | Medium | LinkedIn (browser), Google Sheets | Yes (browser) | Computer use / Playwright |
| mkting-002 Social Intel | Very High | Medium | 6x browser, Google Sheets, Slack | Yes (scheduled) | Computer use / Playwright |
| addo-001 Coaching Monitor | High | High (vertical) | Zoom, GHL, Supabase, Email, Slack | Yes (webhook) | GHL OAuth (~3-5 days), Zoom Business tier |

