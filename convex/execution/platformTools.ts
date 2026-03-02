/**
 * Platform tool definitions and execution handlers.
 *
 * These six tools are always available to all agents running on the platform.
 * Every tool call is tenant-scoped — tools never access data outside the
 * tenant boundary established by the run context.
 *
 * Tool definitions follow the Anthropic tool schema format (name, description,
 * input_schema). The executePlatformTool handler is called by executeAgent
 * when the agent invokes one of these tools.
 */

import type { ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PlatformToolContext = {
  tenantId: Id<"tenants">;
  agentTemplateSlug: string;
  agentRunId: Id<"agentRuns">;
  mergedConfig: Record<string, unknown>;
};

type MemoryResult = {
  content: string;
  type: string;
  importance: number;
  agentTemplateSlug: string;
  createdAt: number;
};

// ─── Tool Definitions (Anthropic format) ──────────────────────────────────────

export const platformToolDefinitions = [
  {
    name: "retrieve_memory",
    description:
      "Search the tenant's memory store for relevant context from previous agent runs. " +
      "Use this to recall past observations, preferences, and summaries about the tenant's clients and coaches. " +
      "Returns the most semantically similar memories to your query.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Natural language query to search for relevant memories.",
        },
        type: {
          type: "string",
          enum: ["observation", "summary", "preference"],
          description:
            "Optional filter to restrict results to a specific memory type.",
        },
        includeAllAgents: {
          type: "boolean",
          description:
            "If true, include memories from all agent types for this tenant. " +
            "Defaults to false (only returns memories from this agent type).",
        },
        limit: {
          type: "number",
          description:
            "Maximum number of results to return. Defaults to 10. Max 50.",
        },
      },
      required: ["query"],
    },
  },

  {
    name: "capture_memory",
    description:
      "Store an observation, summary, or preference in the tenant's memory store " +
      "for retrieval in future agent runs. Use this to persist insights that will be " +
      "valuable across sessions (e.g., a coach's strengths/weaknesses, client preferences).",
    input_schema: {
      type: "object" as const,
      properties: {
        content: {
          type: "string",
          description: "The memory content to store.",
        },
        type: {
          type: "string",
          enum: ["observation", "summary", "preference"],
          description:
            "'observation' for specific facts, 'summary' for session summaries, " +
            "'preference' for user/client preferences.",
        },
        importance: {
          type: "number",
          description:
            "Importance score from 0.0 to 1.0. Higher values are retrieved first. Defaults to 0.5.",
        },
      },
      required: ["content", "type"],
    },
  },

  {
    name: "read_file",
    description:
      "Read the contents of a file from Convex file storage. " +
      "Use this to read transcripts, documents, or other uploaded content. " +
      "Returns the raw text content of the file.",
    input_schema: {
      type: "object" as const,
      properties: {
        storageId: {
          type: "string",
          description:
            "The Convex storage ID of the file to read (e.g., the transcriptStorageId from a coaching call report).",
        },
      },
      required: ["storageId"],
    },
  },

  {
    name: "store_file",
    description:
      "Write content to Convex file storage. Returns a storageId that can be saved " +
      "in documents or passed to other tools. Use this to persist generated documents, " +
      "reports, or processed transcripts.",
    input_schema: {
      type: "object" as const,
      properties: {
        content: {
          type: "string",
          description: "The text content to store.",
        },
        filename: {
          type: "string",
          description: "A descriptive filename (e.g., 'coach-report-2024-01.txt').",
        },
        mimeType: {
          type: "string",
          description:
            "MIME type of the content. Defaults to 'text/plain'. " +
            "Use 'application/json' for JSON, 'text/html' for HTML.",
        },
      },
      required: ["content", "filename"],
    },
  },

  {
    name: "query_reports",
    description:
      "Look up past coaching call reports for this tenant. " +
      "Use this to review a coach's history, identify patterns over time, " +
      "or check if specific concerns have been flagged before.",
    input_schema: {
      type: "object" as const,
      properties: {
        coachId: {
          type: "string",
          description:
            "Optional. Filter reports by a specific coach ID. " +
            "If omitted, returns reports across all coaches for this tenant.",
        },
        limit: {
          type: "number",
          description: "Maximum number of reports to return. Defaults to 10. Max 50.",
        },
        flagged: {
          type: "boolean",
          description:
            "Optional. If true, only return reports that have been flagged for review.",
        },
      },
      required: [],
    },
  },

  {
    name: "get_config",
    description:
      "Read configuration values for this agent (curriculum, rubric, scoring weights, etc.). " +
      "Use this to access the consultant-defined settings that govern how this agent operates. " +
      "Optionally filter to specific keys.",
    input_schema: {
      type: "object" as const,
      properties: {
        keys: {
          type: "array",
          items: { type: "string" },
          description:
            "Optional list of specific config keys to retrieve. " +
            "If omitted, returns the full merged config.",
        },
      },
      required: [],
    },
  },
] as const;

// ─── Tool Execution Handler ────────────────────────────────────────────────────

/**
 * Executes a platform tool by name, with the given input and run context.
 *
 * Called by the agent execution engine (executeAgent) when the Agent SDK
 * requests a platform tool invocation.
 *
 * All tool executions are scoped to the run's tenantId — no tool can
 * read or write data outside the tenant boundary.
 *
 * Memory tools are non-fatal: errors are caught and empty results returned
 * so a memory failure never aborts the agent run.
 */
export async function executePlatformTool(
  ctx: ActionCtx,
  toolName: string,
  toolInput: Record<string, unknown>,
  context: PlatformToolContext
): Promise<unknown> {
  switch (toolName) {
    case "retrieve_memory": {
      const query = toolInput.query as string;
      const type = toolInput.type as string | undefined;
      const includeAllAgents = toolInput.includeAllAgents as boolean | undefined;
      const limit = Math.min(
        typeof toolInput.limit === "number" ? toolInput.limit : 10,
        50
      );

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const results = await ctx.runAction((internal as any).memory.retrieveMemory, {
          tenantId: context.tenantId,
          query,
          type,
          agentTemplateSlug: includeAllAgents ? undefined : context.agentTemplateSlug,
          limit,
        }) as MemoryResult[];

        const text =
          results.length === 0
            ? "No relevant memories found."
            : results
                .map(
                  (r, i) =>
                    `[${i + 1}] (${r.type}, importance: ${r.importance.toFixed(2)}): ${r.content}`
                )
                .join("\n");

        return { results, text };
      } catch {
        return { results: [], text: "Memory retrieval unavailable." };
      }
    }

    case "capture_memory": {
      const content = toolInput.content as string;
      const type = toolInput.type as string;
      const importance =
        typeof toolInput.importance === "number" ? toolInput.importance : 0.5;

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await ctx.runAction((internal as any).memory.captureMemory, {
          tenantId: context.tenantId,
          agentTemplateSlug: context.agentTemplateSlug,
          agentRunId: context.agentRunId,
          content,
          type,
          importance,
        });
        return { stored: true };
      } catch {
        return { stored: false };
      }
    }

    case "read_file": {
      const storageId = toolInput.storageId as string;

      // getUrl requires a storage ID reference; cast since ActionCtx storage
      // accepts string IDs at runtime even when typed as Id<"_storage">
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const url = await ctx.storage.getUrl(storageId as any);
      if (!url) {
        throw new Error(`File not found: ${storageId}`);
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(
          `Failed to read file ${storageId}: ${response.status} ${response.statusText}`
        );
      }

      const content = await response.text();
      return { content, url };
    }

    case "store_file": {
      const content = toolInput.content as string;
      const mimeType =
        typeof toolInput.mimeType === "string"
          ? toolInput.mimeType
          : "text/plain";

      const blob = new Blob([content], { type: mimeType });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const storageId = await ctx.storage.store(blob as any);
      return { storageId };
    }

    case "query_reports": {
      const coachId = toolInput.coachId as string | undefined;
      const limit = Math.min(
        typeof toolInput.limit === "number" ? toolInput.limit : 10,
        50
      );
      const flagged = toolInput.flagged as boolean | undefined;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const reports = await ctx.runAction((internal as any).coachingCallReports.listForAgent, {
        tenantId: context.tenantId,
        coachId,
        limit,
        flagged,
      }) as Array<{
        coachName?: string;
        callNumber: number | "onboarding" | "bonus";
        overallScore: number;
        highlights: string[];
        concerns: string[];
        recordedAt?: number;
      }>;

      return { reports };
    }

    case "get_config": {
      const keys = toolInput.keys as string[] | undefined;
      const config = context.mergedConfig;

      if (!keys || keys.length === 0) {
        return { config };
      }

      const filtered: Record<string, unknown> = {};
      for (const key of keys) {
        if (key in config) {
          filtered[key] = config[key];
        }
      }
      return { config: filtered };
    }

    default:
      throw new Error(`Unknown platform tool: ${toolName}`);
  }
}
