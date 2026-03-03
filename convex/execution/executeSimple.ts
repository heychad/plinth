"use node";

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import Anthropic from "@anthropic-ai/sdk";

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
  const pricing = MODEL_PRICING[model] ?? MODEL_PRICING["claude-haiku-4-5"];
  return (
    (inputTokens / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output
  );
}

type SimpleOutput = {
  output: Record<string, unknown>;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
};

export const executeSimple = internalAction({
  args: {
    runId: v.id("agentRuns"),
    systemPrompt: v.string(),
    mergedConfig: v.any(),
    model: v.string(),
    input: v.any(),
  },
  handler: async (ctx, args): Promise<SimpleOutput> => {
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Fetch the run to get tenantId
    const run = await ctx.runQuery(internal.agentRuns.getById, {
      runId: args.runId,
    });
    if (!run) {
      throw new Error(`Agent run not found: ${args.runId}`);
    }

    // Create a step record for the single API call
    const stepId = await ctx.runMutation(internal.agentRunSteps.createStep, {
      runId: args.runId,
      tenantId: run.tenantId,
      stepSlug: "llm_call",
      stepDisplayName: "LLM Call",
      stepOrder: 0,
    });

    await ctx.runMutation(internal.agentRunSteps.updateStepStatus, {
      stepId,
      status: "running",
      modelUsed: args.model,
    });

    let response: Anthropic.Message;

    try {
      response = await client.messages.create({
        model: args.model,
        max_tokens: 4096,
        system: args.systemPrompt,
        messages: [
          {
            role: "user",
            content: JSON.stringify(args.input),
          },
        ],
      });
    } catch (err: unknown) {
      const errMsg =
        err instanceof Error ? err.message : "Unknown Anthropic API error";

      await ctx.runMutation(internal.agentRunSteps.updateStepStatus, {
        stepId,
        status: "failed",
        errorMessage: errMsg,
      });

      const apiErr = new Error(`Anthropic API error: ${errMsg}`);
      (apiErr as any).cause = err;
      throw apiErr;
    }

    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const costUsd = computeCost(args.model, inputTokens, outputTokens);

    // Extract text content from response
    const textContent = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    // Try to parse as structured JSON, fall back to plain text wrapper
    let output: Record<string, unknown>;
    try {
      output = JSON.parse(textContent) as Record<string, unknown>;
    } catch {
      output = { text: textContent };
    }

    await ctx.runMutation(internal.agentRunSteps.updateStepStatus, {
      stepId,
      status: "completed",
      modelUsed: args.model,
      promptTokens: inputTokens,
      completionTokens: outputTokens,
      costUsd,
      output,
    });

    return {
      output,
      tokensIn: inputTokens,
      tokensOut: outputTokens,
      costUsd,
    };
  },
});
