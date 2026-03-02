import { Agent } from "@convex-dev/agent";
import { openai } from "@ai-sdk/openai";
import { components } from "./_generated/api";

// ─── Agent component setup ────────────────────────────────────────────────────
// Configured once — the execution layer imports this and creates threads
// against it. Thread memory (messages) is persisted automatically by the
// Agent component; no explicit save calls are needed in execution code.
//
// Text embedding model: OpenAI text-embedding-3-small (1536 dims) — same model
// used by the RAG component so embeddings are consistent across both tiers.
//
// Context options:
//   - textSearch + vectorSearch = hybrid search across thread message history
//   - messageRange: before=2, after=1 gives surrounding context per match
//
// languageModel is a required constructor field but is overridden at runtime
// per-run in executeAgent (where the Anthropic client is used directly via
// the Agent SDK). The openai.chat model here is a valid AI SDK placeholder.
//
// components.agent is typed as any until codegen runs.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const agentComponent = new Agent((components as any).agent, {
  name: "plinth-agent",
  // Placeholder — overridden per-run in executeAgent with the Anthropic model
  languageModel: openai.chat("gpt-4o-mini"),
  // Embedding model for hybrid vector/text search on thread history
  textEmbeddingModel: openai.embedding("text-embedding-3-small"),
  // Context: hybrid search across thread history with surrounding message window
  contextOptions: {
    searchOptions: {
      limit: 10,
      textSearch: true,
      vectorSearch: true,
      messageRange: { before: 2, after: 1 },
    },
  },
});
