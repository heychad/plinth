# Agent Execution Engine

## Overview
Convex Workflows for durable agent execution. The **Agent SDK is the primary execution mode** — agents are autonomous, use tools, reason with extended thinking, and make their own decisions about what to do next. The Client SDK exists as a fallback for simple request-response operations that don't need agentic behavior. All agents — including the coaching call analyzer — run on the Agent SDK by default.

## Requirements

### Must Have
- Convex Workflows Component for durable execution (replaces Inngest from Phase 1 plan)
- agentRuns documents to track execution state and results
- agentRunSteps documents to track per-tool-call and per-phase activity
- Real-time status updates: clients subscribe to agentRun status changes via useQuery()
- 10-minute action timeout handling: checkpoint-and-continue pattern for long-running agents
- **Agent SDK (`claude_agent_sdk`) as the primary execution mode** — all new agents default to this
- Client SDK (`@anthropic-ai/sdk` `messages.create()`) available as fallback for simple operations (e.g., a single formatting call)
- executionMode field on agentTemplates: "autonomous" (Agent SDK, default) or "simple" (Client SDK fallback)
- Usage tracking: input tokens, output tokens, cost per run and per tool call written to agentRuns and usageLogs
- Trigger types: manual (user-initiated), scheduled (cron), webhook (external event)

### Should Have
- Run cancellation: a consultant or client can cancel a queued or running job
- Retry on transient failure (network errors, API rate limits): up to 3 attempts with exponential backoff
- Error capture: full error context stored in agentRuns.errorDetail for debugging
- Run input stored on the agentRun record so re-runs are possible without re-submitting input

### Nice to Have
- Step-level output streaming (show partial results as each step completes)
- Run history export (CSV or JSON)
- Webhook-triggered runs can include external payload data stored as run.input

## Data Models

### Convex Document: agentRuns
| Field | Type | Required | Description |
|---|---|---|---|
| _id | Id<"agentRuns"> | yes | Convex auto-generated |
| agentConfigId | Id<"agentConfigs"> | yes | Foreign key — which agent config was run |
| tenantId | Id<"tenants"> | yes | Denormalized for efficient queries |
| status | "queued" \| "running" \| "completed" \| "failed" \| "cancelled" | yes | Current execution state |
| triggerType | "manual" \| "scheduled" \| "webhook" | yes | How the run was initiated |
| triggeredBy | Id<"users"> | no | null for scheduled/webhook triggers |
| input | object | yes | User-provided run inputs matching template inputSchema |
| output | object | no | Final output when completed; null while running |
| workflowId | string | no | Convex Workflow ID for status tracking and cancellation |
| totalTokensIn | number | yes | Default 0; accumulated across steps |
| totalTokensOut | number | yes | Default 0; accumulated across steps |
| totalCostUsd | number | yes | Default 0; accumulated across steps |
| queuedAt | number | yes | Unix timestamp when run was created |
| startedAt | number | no | Unix timestamp when first step began |
| completedAt | number | no | Unix timestamp when run reached terminal state |
| durationMs | number | no | completedAt - startedAt in milliseconds |
| errorMessage | string | no | Human-readable error for display |
| errorDetail | object | no | Full error context for debugging |
| createdAt | number | yes | Unix timestamp |
| updatedAt | number | yes | Unix timestamp |

**Index:** `by_agentConfigId` on agentConfigId; `by_tenantId_status` on (tenantId, status) for active run queries; `by_tenantId_createdAt` on (tenantId, createdAt) for history queries.

### Convex Document: agentRunSteps
| Field | Type | Required | Description |
|---|---|---|---|
| _id | Id<"agentRunSteps"> | yes | Convex auto-generated |
| runId | Id<"agentRuns"> | yes | Foreign key — parent run |
| tenantId | Id<"tenants"> | yes | Denormalized for access control checks |
| stepSlug | string | yes | e.g., "intake", "analyze", "format", "notify" |
| stepDisplayName | string | yes | e.g., "Intake", "Analysis", "Format Report" |
| stepOrder | number | yes | 0-indexed execution order |
| status | "pending" \| "running" \| "completed" \| "failed" \| "skipped" | yes | Default: "pending" |
| modelUsed | string | no | Actual model used, e.g., "claude-sonnet-4-6" |
| promptTokens | number | yes | Default 0 |
| completionTokens | number | yes | Default 0 |
| costUsd | number | yes | Default 0 |
| output | object | no | Structured output from this step |
| rawResponse | object | no | Full Anthropic API response (for debugging) |
| startedAt | number | no | Unix timestamp |
| completedAt | number | no | Unix timestamp |
| durationMs | number | no | Step-level duration |
| errorMessage | string | no | Error if step failed |
| createdAt | number | yes | Unix timestamp |

**Index:** `by_runId` on runId for step list queries.

## API Contracts

### Mutation: triggerAgentRun
- **Signature:** `mutation(ctx, { agentConfigId, input }) => Id<"agentRuns">`
- **Auth:** Caller must be a user in the tenant that owns agentConfigId; consultant can trigger for any of their tenants
- **Validation:** Validates input against template inputSchema — required fields must be present; throws ValidationError if missing
- **Behavior:** Creates agentRun with status "queued"; schedules the Convex Workflow via ctx.scheduler; returns run ID immediately
- **Errors:** Throws if agentConfig status is not "deployed"; throws ValidationError if input schema validation fails

### Query: getAgentRun
- **Signature:** `query(ctx, { runId }) => AgentRun | null`
- **Auth:** Tenant user who owns this run, consultant who owns the tenant, or platform_admin
- **Real-time:** useQuery() on this query updates automatically when run status changes

### Query: listAgentRunSteps
- **Signature:** `query(ctx, { runId }) => AgentRunStep[]`
- **Auth:** Same as getAgentRun
- **Returns:** Steps ordered by stepOrder ascending; includes real-time status updates

### Query: listAgentRunsForTenant
- **Signature:** `query(ctx, { tenantId, agentConfigId?, status?, cursor?, limit? }) => { runs: AgentRun[], nextCursor: string | null }`
- **Auth:** Tenant user sees their own tenant; consultant sees any of their tenants
- **Behavior:** Ordered by queuedAt descending (newest first); default limit 50

### Mutation: cancelAgentRun
- **Signature:** `mutation(ctx, { runId }) => void`
- **Auth:** Tenant user who owns the run, or consultant
- **Behavior:** Sets run status to "cancelled"; cancels the Convex Workflow via workflow.cancel(workflowId); only valid for status "queued" or "running"
- **Errors:** Throws if run is already in a terminal state (completed, failed, cancelled)

### Internal Mutation: updateRunStatus
- **Signature:** `internalMutation(ctx, { runId, status, output?, errorMessage?, errorDetail? }) => void`
- **Behavior:** Updates agentRun status and optional fields; sets completedAt and computes durationMs when transitioning to terminal state; accumulates token/cost totals from child steps

## Primary Execution Mode: Agent SDK (Autonomous)

**All agents default to Agent SDK execution.** The agent receives a system prompt, tools, and context — then reasons about what to do, calls tools, and produces output. This is the primary mode for every agent on the platform, including the coaching call analyzer.

### Why Agent SDK First
- Agents can **think** — extended thinking lets Claude reason through complex scoring, pattern recognition, and nuanced feedback
- Agents can **use tools** — look up coach history, retrieve memories, query curriculum, create docs, send emails
- Agents can **adapt** — if the transcript is ambiguous, the agent can decide to flag for manual review instead of guessing
- Agents can **coordinate** — spawn sub-agents for parallel work (e.g., one analyzes technique while another checks curriculum)
- **Future-proof** — every new Anthropic capability (multi-agent, computer use, etc.) is available immediately

### Template Field
`executionMode` on agentTemplates: `"autonomous"` (default) or `"simple"` (Client SDK fallback). Determines which workflow handler is invoked.

### Agent SDK Workflow (Primary)

```typescript
import { Agent } from "claude_agent_sdk";

// Primary agent workflow — defined in convex/workflows/agentWorkflow.ts
export const agentWorkflow = workflow.define({
  args: { runId: v.id("agentRuns") },
  handler: async (ctx, { runId }) => {
    const run = await ctx.runQuery(internal.agentRuns.getById, { runId })
    const config = await ctx.runQuery(internal.agentConfigs.getResolved, { agentConfigId: run.agentConfigId })

    await ctx.runMutation(internal.agentRuns.updateStatus, { runId, status: "running" })

    const result = await ctx.runAction(internal.execution.executeAgent, {
      runId,
      systemPrompt: config.mergedSystemPrompt,
      mergedConfig: config.mergedConfig,
      model: config.model ?? "claude-sonnet-4-6",
      tools: config.resolvedTools,
      integrationCredentials: config.resolvedCredentials,
      maxTurns: config.mergedConfig.maxTurns ?? 25,
      enableThinking: config.mergedConfig.enableThinking ?? true,
    })

    await ctx.runMutation(internal.agentRuns.updateStatus, {
      runId,
      status: "completed",
      output: result,
    })
  },
})
```

### Internal Action: executeAgent
- **Signature:** `internalAction(ctx, { runId, systemPrompt, mergedConfig, model, tools, integrationCredentials, maxTurns, enableThinking }) => AgentOutput`
- **Behavior:**
  1. Instantiates an `Agent` with the system prompt, model, tool definitions, and thinking configuration
  2. Injects the run input (transcript, call metadata, etc.) as the initial user message
  3. Agent runs in an agentic loop — reasoning, calling tools, making decisions
  4. On each tool call, writes a status update to agentRunSteps (tool name, input, output) so the UI shows real-time progress
  5. Agent uses extended thinking to reason through complex decisions (scoring, pattern recognition, feedback nuance)
  6. Loop continues until the agent signals completion or maxTurns is reached
  7. Returns structured final output + accumulated token usage
- **Extended thinking:** When enableThinking is true, the agent uses Claude's extended thinking to reason through complex analysis before producing output. This is critical for scoring accuracy and nuanced feedback generation.
- **Safety:** maxTurns prevents runaway agents; each turn writes usage to DB so cost is tracked even if the action times out
- **10-minute timeout:** The action checkpoints its state to the DB after each turn. If approaching the 10-minute Convex action limit, it saves current progress and schedules a continuation action that picks up with the full conversation history.

### Agent Tool Registration
Tools available to agents come from four sources:

1. **Platform tools** (always available):
   - `retrieve_memory` — semantic search of tenant's memory store
   - `capture_memory` — store observations for future runs
   - `read_file` — read from Convex file storage (transcripts, documents)
   - `store_file` — write to Convex file storage
   - `query_reports` — look up past reports for a coach/client
   - `get_config` — read agent config values (curriculum, rubric, etc.)

2. **Integration tools** (resolved from integration slots via Composio):
   - Google Docs (create/update documents)
   - Gmail / Resend (send emails)
   - Slack (send messages)
   - GHL (read contacts, pipelines)
   - Zoom (read recordings, meetings)

3. **Custom tools** — defined in the agent template's toolDefinitions array (JSON schema + handler reference)

4. **Sub-agent spawning** (Phase 2+) — the agent can spawn sub-agents for parallel work, each with their own tool set and instructions

Each tool execution is logged to agentRunSteps with tool name, input args, output, and token cost for full auditability.

## Fallback Execution Mode: Client SDK (Simple)

For operations that don't need agentic behavior — a single Claude call with structured output, no tool use, no looping. Examples: reformatting text, translating content, simple classification.

### Simple Workflow

```typescript
// Fallback for simple operations — defined in convex/workflows/simpleWorkflow.ts
export const simpleWorkflow = workflow.define({
  args: { runId: v.id("agentRuns") },
  handler: async (ctx, { runId }) => {
    const run = await ctx.runQuery(internal.agentRuns.getById, { runId })
    const config = await ctx.runQuery(internal.agentConfigs.getResolved, { agentConfigId: run.agentConfigId })

    await ctx.runMutation(internal.agentRuns.updateStatus, { runId, status: "running" })

    const result = await ctx.runAction(internal.execution.executeSimpleCall, {
      runId,
      systemPrompt: config.mergedSystemPrompt,
      mergedConfig: config.mergedConfig,
      model: config.model ?? "claude-haiku-4-5",
      input: run.input,
    })

    await ctx.runMutation(internal.agentRuns.updateStatus, {
      runId,
      status: "completed",
      output: result,
    })
  },
})
```

### Internal Action: executeSimpleCall
- **Signature:** `internalAction(ctx, { runId, systemPrompt, mergedConfig, model, input }) => object`
- **Behavior:** Single `messages.create()` call with Zod structured output. No tool use, no looping. Returns structured JSON.
- **Use case:** Cheap, fast operations where agentic behavior is unnecessary overhead

## Behavioral Constraints
- A run may only be triggered on an agentConfig with status "deployed" — runs against "building" or "testing" configs throw an error
- The 10-minute Convex action timeout: individual actions must complete within 10 minutes. Steps that may take longer must be split into sub-steps or use the mutation→scheduler→action pattern where each step schedules the next
- Actions are stateless — all state (step outputs, run status) is written to Convex documents inside mutations, not held in action memory
- Token accumulation: each step records its own tokens; the run totals are the sum of all step totals; this is computed and written by updateRunStatus when the run completes
- Retry behavior: the Convex Workflow Component handles retries. On transient errors (network, rate limit), retry up to 3 times with 2s/4s/8s backoff. On non-transient errors (invalid input, auth failure), fail immediately without retry
- usageLogs are written at run completion — one log entry per run, not per step (to minimize write volume)
- Credentials are resolved before the workflow starts and passed as encrypted references — raw tokens never enter action arguments or step outputs

## Edge Cases
- **Workflow orphaned (Convex restart during execution):** Convex Workflows are durable — they resume from the last completed step on restart. No manual recovery needed.
- **Step produces output exceeding 1 MiB:** The Convex document limit applies. For large outputs (e.g., a full transcript analysis), store the large blob in Convex file storage and write only the storage ID + a summary to agentRunSteps.output.
- **Anthropic rate limit (429):** The executeAgentStep action throws; the Workflow retries with backoff. After 3 retries, the step fails and the run transitions to "failed" with errorMessage "Rate limit exceeded; retry the run."
- **User cancels while step is mid-execution:** The workflow is cancelled after the current action completes — Convex Workflows do not interrupt running actions mid-flight. The run transitions to "cancelled" at the next mutation checkpoint.
- **Scheduled run for paused agentConfig:** The scheduler checks agentConfig.status before triggering. If status is not "deployed" at scheduled time, the run is skipped and a log entry is written with status "skipped".

## Dependencies
- `agent-config-system.md` — agentConfigs, agentTemplates documents
- `platform-foundation.md` — tenants, users for access control
- `agent-memory-system.md` — memory retrieval called within executeAgentStep for context enrichment
- `zoom-integration.md` — webhook-triggered runs for coaching call analyzer
- Convex Workflows Component
- Anthropic Client SDK (`@anthropic-ai/sdk`) for pipeline agent steps
- Anthropic Agent SDK (`claude_agent_sdk`) for autonomous agent execution — agent loops, tool use, multi-agent coordination
- Composio for integration credential resolution and tool execution
