# Agent Memory System

## Overview
Per-tenant memory layer built on **Convex's official RAG and Agent components** (`@convex-dev/rag` and `@convex-dev/agent`). Two tiers of memory: short-term conversation threads (Agent component) and long-term knowledge (RAG component). Both use Convex's native vector search with automatic embedding generation. No custom embedding pipeline — we lean entirely on what Convex ships.

## Components Used

| Component | Package | Purpose |
|---|---|---|
| **Convex Agent** | `@convex-dev/agent` | Thread-based conversation memory, hybrid text+vector search on message history, automatic context injection |
| **Convex RAG** | `@convex-dev/rag` | Long-term knowledge store, automatic chunking + embedding, namespace isolation per tenant, importance weighting |

Both are official Convex components with built-in embedding generation, search, and retrieval. We configure them — we don't rebuild them.

## Requirements

### Must Have
- RAG component configured with per-tenant namespaces for long-term memory isolation
- Agent component for thread-based conversation memory (message history per agent run)
- Automatic embedding generation via configured embedding model (handled by components)
- Memory capture: agents can store observations, summaries, and key facts to the RAG namespace during runs
- Memory retrieval: semantic search via RAG component returns relevant context given a query
- Per-tenant isolation: RAG namespaces scoped to tenantId — no memory crosses tenant boundaries
- Metadata filtering: filter memories by agentTemplateSlug, type, or custom tags alongside vector similarity

### Should Have
- Memory types via RAG filter: "observation", "summary", "preference" — used as filter values on search
- Importance weighting: memories stored with importance score (0.0–1.0) that influences ranking
- Cross-agent memory sharing: search across all agent types within a tenant namespace
- Source tracking: RAG entries tagged with agentRunId and stepSlug for provenance
- Deduplication: before inserting, search for near-identical content (vectorScoreThreshold > 0.97) and skip

### Nice to Have
- Memory compaction: scheduled action that synthesizes old observations into summaries
- Memory export: list all RAG entries for a tenant namespace as plain text for consultant review
- Conversation thread search: hybrid search across a coach's past run threads for context

## Architecture

### Two-Tier Memory Model

**Tier 1: Conversation Memory (Agent Component)**
- Each agent run creates a thread in the Agent component
- All messages (system prompt, user input, tool calls, agent responses) are persisted automatically
- Hybrid search (text + vector) across the thread's message history
- Surrounding message context included automatically (configurable window)
- Searchable across threads for the same tenant via `searchOtherThreads: true`

**Tier 2: Long-Term Knowledge (RAG Component)**
- Persistent observations, summaries, and preferences stored in RAG namespaces
- Namespace pattern: `tenant_{tenantId}` for tenant-wide memory, `tenant_{tenantId}_agent_{templateSlug}` for agent-specific memory
- Automatic chunking and embedding — just pass text, RAG handles the rest
- Filtered search by type, agent, and custom metadata tags
- Importance weighting influences result ranking

### How Memory Flows at Runtime

```
Agent Run Starts
  │
  ├─ RAG search: "What do we know about Coach Sarah?"
  │   → Returns: past observations, score patterns, preferences
  │   → Injected into agent context
  │
  ├─ Thread search: find relevant past conversation turns
  │   → Returns: relevant messages from prior runs
  │   → Injected into agent context
  │
  ├─ Agent does its work (analyzes call, scores, generates report)
  │
  └─ RAG capture: store new observations
      → "Coach Sarah scored 15/25 on curriculum — missed YNAB topics third time"
      → "Client showed resistance to pricing changes — recurring pattern"
```

## Configuration

### RAG Component Setup

```typescript
// convex/convex.config.ts
import { defineApp } from "convex/server";
import rag from "@convex-dev/rag/convex.config.js";
import agent from "@convex-dev/agent/convex.config.js";

const app = defineApp();
app.use(rag);
app.use(agent);
export default app;
```

```typescript
// convex/memory.ts
import { RAG } from "@convex-dev/rag";
import { openai } from "@ai-sdk/openai";
import { components } from "./_generated/api";

export const memory = new RAG(components.rag, {
  textEmbeddingModel: openai.embedding("text-embedding-3-small"),
  embeddingDimension: 1536,
  filterNames: ["type", "agentTemplateSlug", "agentRunId"],
});
```

### Agent Component Setup

```typescript
// convex/agentSetup.ts
import { Agent } from "@convex-dev/agent";
import { openai } from "@ai-sdk/openai";
import { components } from "./_generated/api";

export const agentComponent = new Agent(components.agent, {
  textEmbeddingModel: openai.embedding("text-embedding-3-small"),
  searchOptions: {
    textSearch: true,
    vectorSearch: true,
  },
  messageRange: {
    before: 2,
    after: 1,
  },
});
```

### Embedding Model
OpenAI `text-embedding-3-small` (1536 dimensions) — configured once, used by both components automatically. This is a separate API dependency from Anthropic.

Environment variables:
- `OPENAI_API_KEY` — for embedding generation (used by both RAG and Agent components)

## API Contracts

### Memory Capture (RAG)

#### Tool: capture_memory (available to agents at runtime)
- **Behavior:** Wraps `memory.add()` from the RAG component
- **Parameters:** `{ content: string, type: "observation" | "summary" | "preference", metadata?: object, importance?: number }`
- **Internal behavior:**
  1. Deduplication check: search with vectorScoreThreshold > 0.97 in same namespace; skip if near-duplicate exists
  2. Call `memory.add()` with namespace = `tenant_{tenantId}`, content, importance, and filter values for type and agentTemplateSlug
  3. RAG component automatically chunks, embeds, and stores
- **Non-fatal:** If embedding service fails, log error and continue. Memory failure never blocks a run.

### Memory Retrieval (RAG)

#### Tool: retrieve_memory (available to agents at runtime)
- **Behavior:** Wraps `memory.search()` from the RAG component
- **Parameters:** `{ query: string, type?: string, includeAllAgents?: boolean, limit?: number }`
- **Internal behavior:**
  1. Call `memory.search()` with namespace = `tenant_{tenantId}`, query text, limit (default 5)
  2. Apply filters: type (if provided), agentTemplateSlug (current agent's slug unless includeAllAgents is true)
  3. RAG component handles embedding the query and vector search automatically
  4. Return formatted results with content, type, importance, and similarity score
- **Non-fatal:** Returns empty array on failure.
- **Returns:** `{ results: MemoryResult[], text: string }` — `text` is a pre-formatted string ready for prompt injection

### Thread Memory (Agent Component)

Thread memory is handled automatically by the Agent component:
- Messages are persisted to threads during agent execution
- Hybrid search (text + vector) is available via the agent's built-in search
- Past thread context can be retrieved with `searchOtherThreads: true` to pull relevant messages from the coach's prior run threads

### Mutation: deleteMemory
- **Signature:** `mutation(ctx, { namespace, entryId }) => void`
- **Auth:** Consultant who owns the tenant, or platform_admin
- **Behavior:** Calls `memory.delete()` on the RAG component

### Query: listMemoriesForTenant
- **Signature:** `query(ctx, { tenantId, type?, cursor?, limit? }) => { memories: MemoryEntry[], nextCursor: string | null }`
- **Auth:** Consultant who owns the tenant, or platform_admin; client users cannot list raw memories
- **Behavior:** Lists RAG entries in the tenant namespace, ordered by creation time

### Action: compactMemories
- **Signature:** `action(ctx, { tenantId, agentTemplateSlug, olderThanDays }) => { summaryCreated: boolean }`
- **Auth:** Internal action — called by scheduled cron job
- **Behavior:**
  1. Search RAG namespace for "observation" type entries older than olderThanDays
  2. If fewer than 10, skip
  3. Call Claude to synthesize observations into a 2-3 paragraph summary
  4. Store summary as new "summary" entry with high importance (0.9)
  5. Delete the source observation entries from RAG
- **Schedule:** Weekly per tenant per agent template

## Behavioral Constraints
- All RAG namespaces include tenantId — no memory crosses tenant boundaries under any circumstances
- Memory capture and retrieval are exposed as **agent tools** — the Agent SDK agent decides when to read and write memories (not hardcoded into a pipeline)
- Memory operations are non-fatal — embedding service failure logs an error but does not block the agent run
- The Agent component automatically persists conversation history — no explicit save calls needed
- RAG search results include a pre-formatted `text` field with `...` between chunks and `---` between entries — suitable for direct prompt injection
- Importance weighting (0.0–1.0) influences but does not solely determine result ranking — vector similarity is the primary factor

## Edge Cases
- **Empty memory store:** Search returns empty results. Agent proceeds without memory context — normal for new tenants.
- **Embedding service unavailable:** Both RAG and Agent components are configured to be non-fatal. Agent runs without memory enrichment.
- **Memory for deleted agent config:** RAG entries reference agentTemplateSlug (not agentConfigId), so they survive config changes and re-deployments. Memories are owned by the tenant, not the config.
- **Namespace collision:** Namespace pattern `tenant_{tenantId}` uses Convex document IDs which are globally unique — no collision possible.
- **Large memory stores:** RAG component handles chunking and indexing efficiently. Compaction job prevents unbounded growth. At 1 run/day, 1 year = ~365 observations per agent per tenant — well within Convex vector search capacity.
- **Duplicate memories from retry:** Deduplication check (vectorScoreThreshold > 0.97) before insert prevents duplicate observations.
- **Cross-agent context:** When `includeAllAgents` is true, search spans the entire tenant namespace. This means observations from the coaching call analyzer are available to future agents (e.g., a lead scorer or content agent).

## Dependencies
- `@convex-dev/rag` — Convex RAG component (embedding, chunking, vector search, namespaces)
- `@convex-dev/agent` — Convex Agent component (thread memory, hybrid search, message persistence)
- `platform-foundation.md` — tenants document for tenantId namespace scoping
- `agent-execution-engine.md` — memory tools registered in agent tool set; called during agent execution
- OpenAI API for `text-embedding-3-small` embeddings (configured once, used by both components)
