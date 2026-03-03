"use node";

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import Anthropic from "@anthropic-ai/sdk";
import {
  executePlatformTool,
  platformToolDefinitions,
  type PlatformToolContext,
} from "./platformTools";

// Approximate cost per million tokens (USD)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-6": { input: 3.0, output: 15.0 },
  "claude-opus-4-6": { input: 15.0, output: 75.0 },
  "claude-haiku-4-5": { input: 0.8, output: 4.0 },
  "claude-haiku-4-5-20251001": { input: 0.8, output: 4.0 },
};

function computeCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = MODEL_PRICING[model] ?? MODEL_PRICING["claude-sonnet-4-6"];
  return (
    (inputTokens / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output
  );
}

// Tool definition shape for custom tools from agentTemplates.toolDefinitions
type CustomToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

type AgentOutput = {
  output: Record<string, unknown>;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
};

// 9 minutes — leave 1 minute buffer before the 10-minute Convex action limit
const CHECKPOINT_THRESHOLD_MS = 9 * 60 * 1000;

export const executeAgent = internalAction({
  args: {
    runId: v.id("agentRuns"),
    systemPrompt: v.string(),
    mergedConfig: v.any(),
    model: v.string(),
    tools: v.optional(v.array(v.any())),
    integrationCredentials: v.optional(v.any()),
    maxTurns: v.number(),
    enableThinking: v.boolean(),
    // Optional: resume from checkpoint with existing conversation history
    resumeFromHistory: v.optional(v.array(v.any())),
    resumeStepOrder: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<AgentOutput> => {
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Fetch the run to get tenantId, agentConfigId, and input
    const run = await ctx.runQuery(internal.agentRuns.getById, {
      runId: args.runId,
    });
    if (!run) {
      throw new Error(`Agent run not found: ${args.runId}`);
    }

    // Resolve agentTemplateSlug for memory tool context
    // Cast needed: generated API types are stale until next `npx convex dev`
    const internalApi = internal as Record<string, Record<string, unknown>>;
    const agentConfigRaw = await ctx.runQuery(
      internalApi.agentConfigs.getConfigById as Parameters<typeof ctx.runQuery>[0],
      { agentConfigId: run.agentConfigId }
    ) as { templateSlug?: string } | null;
    const agentTemplateSlug = agentConfigRaw?.templateSlug ?? "unknown";

    const toolContext: PlatformToolContext = {
      tenantId: run.tenantId,
      agentTemplateSlug,
      agentRunId: args.runId,
      mergedConfig: (args.mergedConfig as Record<string, unknown>) ?? {},
    };

    // Build Anthropic tool definitions:
    // 1. Always-available platform tools
    // 2. Custom tools from the agent template
    const platformTools: Anthropic.Tool[] = platformToolDefinitions.map(
      (t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema as unknown as Anthropic.Tool.InputSchema,
      })
    );

    const customTools: Anthropic.Tool[] = (
      (args.tools ?? []) as CustomToolDefinition[]
    ).map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
    }));

    const allTools: Anthropic.Tool[] = [...platformTools, ...customTools];

    // Build initial messages — resume from checkpoint or start fresh
    const messages: Anthropic.MessageParam[] = args.resumeFromHistory
      ? (args.resumeFromHistory as Anthropic.MessageParam[])
      : [
          {
            role: "user",
            content:
              typeof args.mergedConfig === "object" &&
              args.mergedConfig !== null &&
              "userMessagePrefix" in (args.mergedConfig as Record<string, unknown>)
                ? String(
                    (args.mergedConfig as Record<string, unknown>).userMessagePrefix
                  ) +
                  "\n\n" +
                  JSON.stringify(run.input)
                : JSON.stringify(run.input),
          },
        ];

    let stepOrder = args.resumeStepOrder ?? 0;
    let totalTokensIn = 0;
    let totalTokensOut = 0;
    let totalCostUsd = 0;
    let finalOutput: Record<string, unknown> = {};
    const startTime = Date.now();

    for (let turn = 0; turn < args.maxTurns; turn++) {
      // Checkpoint: approaching the 10-minute Convex action limit.
      // Save conversation state as a step record and return a checkpoint marker.
      // The workflow can read this and schedule a continuation action.
      if (Date.now() - startTime > CHECKPOINT_THRESHOLD_MS) {
        const checkpointStepId = await ctx.runMutation(
          internal.agentRunSteps.createStep,
          {
            runId: args.runId,
            tenantId: run.tenantId,
            stepSlug: "checkpoint",
            stepDisplayName: "Checkpoint",
            stepOrder: stepOrder++,
          }
        );

        await ctx.runMutation(internal.agentRunSteps.updateStepStatus, {
          stepId: checkpointStepId,
          status: "completed",
          output: {
            _checkpoint: true,
            conversationHistory: messages,
            resumeStepOrder: stepOrder,
            tokensIn: totalTokensIn,
            tokensOut: totalTokensOut,
            costUsd: totalCostUsd,
          },
        });

        return {
          output: { _checkpoint: true, stepOrder },
          tokensIn: totalTokensIn,
          tokensOut: totalTokensOut,
          costUsd: totalCostUsd,
        };
      }

      // Build the request parameters
      const requestParams: Record<string, unknown> = {
        model: args.model,
        // Extended thinking needs higher max_tokens budget
        max_tokens: args.enableThinking ? 16000 : 8192,
        system: args.systemPrompt,
        messages,
        tools: allTools,
      };

      // Extended thinking — critical for scoring accuracy per SIGN-6
      if (args.enableThinking) {
        requestParams.thinking = {
          type: "enabled",
          budget_tokens: 10000,
        };
      }

      let response: Anthropic.Message;
      try {
        response = await client.messages.create(
          requestParams as unknown as Anthropic.MessageCreateParamsNonStreaming
        );
      } catch (err: unknown) {
        const errMsg =
          err instanceof Error ? err.message : "Unknown Anthropic API error";
        const apiErr = new Error(`Anthropic API error on turn ${turn}: ${errMsg}`);
        (apiErr as any).cause = err;
        throw apiErr;
      }

      const inputTokens = response.usage.input_tokens;
      const outputTokens = response.usage.output_tokens;
      const turnCost = computeCost(args.model, inputTokens, outputTokens);

      totalTokensIn += inputTokens;
      totalTokensOut += outputTokens;
      totalCostUsd += turnCost;

      // Add the assistant response to conversation history
      messages.push({ role: "assistant", content: response.content });

      // Separate tool_use blocks from text blocks
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
      );
      const textBlocks = response.content.filter(
        (b): b is Anthropic.TextBlock => b.type === "text"
      );

      if (response.stop_reason === "end_turn" || toolUseBlocks.length === 0) {
        // Agent is done — extract final output text
        const outputText = textBlocks.map((b) => b.text).join("\n");

        // Log the completion turn as a step
        const completionStepId = await ctx.runMutation(
          internal.agentRunSteps.createStep,
          {
            runId: args.runId,
            tenantId: run.tenantId,
            stepSlug: "completion",
            stepDisplayName: "Agent Completion",
            stepOrder,
          }
        );

        await ctx.runMutation(internal.agentRunSteps.updateStepStatus, {
          stepId: completionStepId,
          status: "completed",
          modelUsed: args.model,
          promptTokens: inputTokens,
          completionTokens: outputTokens,
          costUsd: turnCost,
          output: { text: outputText },
        });

        // Try to parse as structured JSON, fall back to plain text wrapper
        try {
          finalOutput = JSON.parse(outputText) as Record<string, unknown>;
        } catch {
          finalOutput = { text: outputText };
        }

        break;
      }

      // Process all tool_use blocks in this turn
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        const toolInput = toolUse.input as Record<string, unknown>;

        // Create the step record for this tool call
        const toolStepId = await ctx.runMutation(
          internal.agentRunSteps.createStep,
          {
            runId: args.runId,
            tenantId: run.tenantId,
            stepSlug: toolUse.name,
            stepDisplayName: toDisplayName(toolUse.name),
            stepOrder: stepOrder++,
          }
        );

        // Mark as running (logs tool call input for real-time UI updates)
        await ctx.runMutation(internal.agentRunSteps.updateStepStatus, {
          stepId: toolStepId,
          status: "running",
          modelUsed: args.model,
          // Attribute turn tokens to the first tool call of the turn
          promptTokens: inputTokens,
          completionTokens: outputTokens,
          costUsd: turnCost,
        });

        let toolResult: unknown;
        let toolError: string | undefined;

        // Check if this is a platform tool or a custom tool
        const isPlatformTool = platformToolDefinitions.some(
          (t) => t.name === toolUse.name
        );

        try {
          if (isPlatformTool) {
            toolResult = await executePlatformTool(
              ctx as Parameters<typeof executePlatformTool>[0],
              toolUse.name,
              toolInput,
              toolContext
            );
          } else {
            // Custom tools defined in agentTemplate.toolDefinitions.
            // These reference internal Convex actions via handlerRef.
            // For now, return a structured error indicating the tool isn't
            // yet wired — the agent can adapt gracefully.
            toolResult = {
              error: `Custom tool '${toolUse.name}' handler not yet wired. Available platform tools: ${platformToolDefinitions.map((t) => t.name).join(", ")}`,
            };
          }
        } catch (err: unknown) {
          toolError =
            err instanceof Error ? err.message : "Tool execution failed";
          toolResult = { error: toolError };
        }

        await ctx.runMutation(internal.agentRunSteps.updateStepStatus, {
          stepId: toolStepId,
          status: toolError ? "failed" : "completed",
          output: toolResult as Record<string, unknown>,
          errorMessage: toolError,
        });

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: JSON.stringify(toolResult),
        });
      }

      // Append tool results as user message and continue the agentic loop
      messages.push({ role: "user", content: toolResults });
    }

    // If we exited the loop due to maxTurns without completing, return what we have
    if (!finalOutput.text && Object.keys(finalOutput).length === 0) {
      finalOutput = {
        text: "Agent reached maximum turns without producing final output.",
        _maxTurnsReached: true,
      };
    }

    return {
      output: finalOutput,
      tokensIn: totalTokensIn,
      tokensOut: totalTokensOut,
      costUsd: totalCostUsd,
    };
  },
});

/** Convert snake_case tool name to Title Case display name. */
function toDisplayName(toolName: string): string {
  return toolName
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
