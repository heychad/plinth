import { RAG, type EntryId } from "@convex-dev/rag";
import { openai } from "@ai-sdk/openai";
import { internalAction, mutation, query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { components } from "./_generated/api";
import { requireAuth } from "./auth";
import { Id } from "./_generated/dataModel";

// ─── RAG component setup ──────────────────────────────────────────────────────
// Tenant-scoped long-term memory. Filter names match what agents pass when
// capturing / searching. components.rag is typed as any until codegen runs.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const memory = new RAG((components as any).rag, {
  textEmbeddingModel: openai.embedding("text-embedding-3-small"),
  embeddingDimension: 1536,
  filterNames: ["type", "agentTemplateSlug", "agentRunId"],
});

// ─── Namespace helpers ────────────────────────────────────────────────────────

function tenantNamespace(tenantId: Id<"tenants">): string {
  return `tenant_${tenantId}`;
}

function agentNamespace(tenantId: Id<"tenants">, templateSlug: string): string {
  return `tenant_${tenantId}_agent_${templateSlug}`;
}

// ─── captureMemory ────────────────────────────────────────────────────────────

/**
 * Store an observation, summary, or preference into the tenant's RAG namespace.
 * Called by platform tools during agent execution.
 * Non-fatal: errors are logged but never propagate.
 */
export const captureMemory = internalAction({
  args: {
    tenantId: v.id("tenants"),
    content: v.string(),
    type: v.union(
      v.literal("observation"),
      v.literal("summary"),
      v.literal("preference")
    ),
    agentTemplateSlug: v.optional(v.string()),
    agentRunId: v.optional(v.id("agentRuns")),
    metadata: v.optional(v.any()),
    importance: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    try {
      const namespace =
        args.agentTemplateSlug
          ? agentNamespace(args.tenantId, args.agentTemplateSlug)
          : tenantNamespace(args.tenantId);

      // Deduplication: skip if a near-identical entry already exists (> 97% similarity)
      const dedupCheck = await memory.search(ctx, {
        namespace,
        query: args.content,
        limit: 1,
        vectorScoreThreshold: 0.97,
      });

      if (dedupCheck.results.length > 0) {
        console.log(
          `[memory] Skipping near-duplicate memory for tenant ${args.tenantId}`
        );
        return;
      }

      // Build filter values
      const filterValues: Array<{ name: string; value: unknown }> = [
        { name: "type", value: args.type },
      ];
      if (args.agentTemplateSlug) {
        filterValues.push({
          name: "agentTemplateSlug",
          value: args.agentTemplateSlug,
        });
      }
      if (args.agentRunId) {
        filterValues.push({ name: "agentRunId", value: args.agentRunId });
      }

      await memory.add(ctx, {
        namespace,
        text: args.content,
        importance: args.importance,
        filterValues: filterValues as any,
      });
    } catch (error) {
      // Non-fatal — memory failure must never block an agent run
      console.error("[memory] captureMemory failed:", error);
    }
  },
});

// ─── retrieveMemory ───────────────────────────────────────────────────────────

export type MemoryResult = {
  entryId: string;
  text: string;
  score: number;
  type?: string;
  agentTemplateSlug?: string;
};

/**
 * Semantic search over the tenant's RAG namespace.
 * Called by platform tools during agent execution.
 * Non-fatal: returns empty result on failure.
 */
export const retrieveMemory = internalAction({
  args: {
    tenantId: v.id("tenants"),
    query: v.string(),
    type: v.optional(v.string()),
    agentTemplateSlug: v.optional(v.string()),
    includeAllAgents: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ results: MemoryResult[]; text: string }> => {
    try {
      // Decide namespace: tenant-wide vs agent-specific
      const namespace =
        args.includeAllAgents || !args.agentTemplateSlug
          ? tenantNamespace(args.tenantId)
          : agentNamespace(args.tenantId, args.agentTemplateSlug);

      // Build filters for search
      const filters: Array<{ name: string; value: unknown }> = [];
      if (args.type) {
        filters.push({ name: "type", value: args.type });
      }
      if (!args.includeAllAgents && args.agentTemplateSlug) {
        filters.push({
          name: "agentTemplateSlug",
          value: args.agentTemplateSlug,
        });
      }

      const searchOpts: Parameters<typeof memory.search>[1] = {
        namespace,
        query: args.query,
        limit: args.limit ?? 5,
      };
      if (filters.length > 0) {
        searchOpts.filters = filters as any;
      }

      const { results, text, entries } = await memory.search(ctx, searchOpts);

      // Map to MemoryResult — pull type/slug from entry filter values
      const mapped: MemoryResult[] = results.map((r) => {
        const entry = entries.find((e) => e.entryId === r.entryId);
        const filterMap: Record<string, unknown> = {};
        if (entry?.filterValues) {
          for (const fv of entry.filterValues as Array<{
            name: string;
            value: unknown;
          }>) {
            filterMap[fv.name] = fv.value;
          }
        }
        return {
          entryId: r.entryId as string,
          text: r.content.map((c) => c.text).join(" "),
          score: r.score,
          type: filterMap["type"] as string | undefined,
          agentTemplateSlug: filterMap["agentTemplateSlug"] as
            | string
            | undefined,
        };
      });

      return { results: mapped, text };
    } catch (error) {
      // Non-fatal — return empty on failure
      console.error("[memory] retrieveMemory failed:", error);
      return { results: [], text: "" };
    }
  },
});

// ─── deleteMemory ─────────────────────────────────────────────────────────────

/**
 * Delete a specific RAG entry by entryId.
 * Auth: consultant who owns the tenant, or platform_admin.
 * Uses deleteAsync so it can run inside a mutation.
 */
export const deleteMemory = mutation({
  args: {
    tenantId: v.id("tenants"),
    entryId: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);

    // Clients may not delete memories
    if (auth.role === "client") {
      throw new Error("Not authorized");
    }

    if (auth.role === "consultant") {
      const tenant = await ctx.db.get(args.tenantId);
      if (!tenant || tenant.consultantId !== auth.consultantId) {
        throw new Error("Not authorized");
      }
    }
    // platform_admin has no restrictions

    // deleteAsync runs as a mutation — preferred over delete() in mutation context
    await memory.deleteAsync(ctx, {
      entryId: args.entryId as EntryId,
    });
  },
});

// ─── listMemoriesForTenant ────────────────────────────────────────────────────

/**
 * List RAG entries in the tenant namespace (paginated).
 * Auth: consultant who owns the tenant, or platform_admin; clients cannot list.
 */
export const listMemoriesForTenant = query({
  args: {
    tenantId: v.id("tenants"),
    type: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);

    // Clients may not list raw memories
    if (auth.role === "client") {
      throw new Error("Not authorized");
    }

    if (auth.role === "consultant") {
      const tenant = await ctx.db.get(args.tenantId);
      if (!tenant || tenant.consultantId !== auth.consultantId) {
        throw new Error("Not authorized");
      }
    }
    // platform_admin has no restrictions

    const namespace = tenantNamespace(args.tenantId);

    // Resolve the namespace to get its namespaceId
    const ns = await memory.getNamespace(ctx, { namespace });
    if (!ns) {
      // Namespace doesn't exist yet — return empty page
      return { page: [], isDone: true, continueCursor: "" };
    }

    const listOpts: Parameters<typeof memory.list>[1] = {
      namespaceId: ns.namespaceId,
      paginationOpts: args.paginationOpts,
    };

    return await memory.list(ctx, listOpts);
  },
});

// ─── compactMemories ──────────────────────────────────────────────────────────

/**
 * Compact old observation entries into a summary.
 * Finds observations older than olderThanDays, synthesizes via Claude,
 * stores the summary with high importance, deletes source observations.
 * Called by scheduled cron — internal only.
 */
export const compactMemories = internalAction({
  args: {
    tenantId: v.id("tenants"),
    agentTemplateSlug: v.string(),
    olderThanDays: v.number(),
  },
  handler: async (ctx, args): Promise<{ summaryCreated: boolean }> => {
    try {
      const namespace = agentNamespace(args.tenantId, args.agentTemplateSlug);
      const cutoffMs = Date.now() - args.olderThanDays * 24 * 60 * 60 * 1000;

      // Resolve namespace to get namespaceId for listing
      const ns = await memory.getNamespace(ctx, { namespace });
      if (!ns) {
        return { summaryCreated: false };
      }

      // List observation-type entries in this namespace (up to 200)
      const allEntries = await memory.list(ctx, {
        namespaceId: ns.namespaceId,
        limit: 200,
      });

      // Filter to observation entries older than cutoff
      // Entry.createdAt is a number (Unix ms)
      const oldEntries = allEntries.page.filter((entry) => {
        const isObservation = (entry.filterValues as Array<{ name: string; value: unknown }>)
          ?.some((fv) => fv.name === "type" && fv.value === "observation");
        const createdAt =
          typeof (entry as any).createdAt === "number" ? (entry as any).createdAt : 0;
        return isObservation && createdAt < cutoffMs;
      });

      if (oldEntries.length < 10) {
        return { summaryCreated: false };
      }

      // Synthesize via Claude (haiku — lightweight summarization)
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const anthropic = new Anthropic();

      const observationTexts = oldEntries
        .map((e, i) => `${i + 1}. ${(e as any).text ?? ""}`)
        .join("\n");

      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: `Synthesize the following ${oldEntries.length} observations for agent "${args.agentTemplateSlug}" into a concise 2-3 paragraph summary capturing key patterns, recurring themes, and important insights.

Observations:
${observationTexts}

Write a 2-3 paragraph summary:`,
          },
        ],
      });

      const summaryText =
        response.content[0].type === "text" ? response.content[0].text : "";

      if (!summaryText) {
        console.error("[memory] compactMemories: empty summary from Claude");
        return { summaryCreated: false };
      }

      // Store the synthesized summary with high importance
      await memory.add(ctx, {
        namespace,
        text: summaryText,
        importance: 0.9,
        filterValues: [
          { name: "type", value: "summary" },
          { name: "agentTemplateSlug", value: args.agentTemplateSlug },
        ],
      });

      // Delete the source observation entries
      for (const entry of oldEntries) {
        try {
          await memory.delete(ctx, {
            entryId: entry.entryId as EntryId,
          });
        } catch (deleteError) {
          console.error(
            `[memory] Failed to delete observation entry ${entry.entryId}:`,
            deleteError
          );
        }
      }

      return { summaryCreated: true };
    } catch (error) {
      console.error("[memory] compactMemories failed:", error);
      return { summaryCreated: false };
    }
  },
});
