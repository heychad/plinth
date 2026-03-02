import { query, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./auth";

export const listAgentRunSteps = query({
  args: {
    runId: v.id("agentRuns"),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);

    // Verify caller has access to the parent run's tenant
    const run = await ctx.db.get(args.runId);
    if (!run) {
      return [];
    }

    if (auth.role === "client") {
      if (auth.tenantId !== run.tenantId) {
        throw new Error("Not authorized");
      }
    } else if (auth.role === "consultant") {
      const tenant = await ctx.db.get(run.tenantId);
      if (!tenant || tenant.consultantId !== auth.consultantId) {
        throw new Error("Not authorized");
      }
    }
    // platform_admin has no restrictions

    const steps = await ctx.db
      .query("agentRunSteps")
      .withIndex("by_runId", (q) => q.eq("runId", args.runId))
      .collect();

    return steps.sort((a, b) => a.stepOrder - b.stepOrder);
  },
});

/**
 * Internal query: list steps for a run ordered by stepOrder.
 * Used by workflow actions to read step state during execution.
 */
export const listStepsByRunId = internalQuery({
  args: {
    runId: v.id("agentRuns"),
  },
  handler: async (ctx, args) => {
    const steps = await ctx.db
      .query("agentRunSteps")
      .withIndex("by_runId", (q) => q.eq("runId", args.runId))
      .collect();
    return steps.sort((a, b) => a.stepOrder - b.stepOrder);
  },
});

/**
 * Internal mutation: create a new step record for a run.
 * Called by executeAgent/executeSimple actions to record each tool call or phase.
 */
export const createStep = internalMutation({
  args: {
    runId: v.id("agentRuns"),
    tenantId: v.id("tenants"),
    stepSlug: v.string(),
    stepDisplayName: v.string(),
    stepOrder: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("agentRunSteps", {
      runId: args.runId,
      tenantId: args.tenantId,
      stepSlug: args.stepSlug,
      stepDisplayName: args.stepDisplayName,
      stepOrder: args.stepOrder,
      status: "pending",
      promptTokens: 0,
      completionTokens: 0,
      costUsd: 0,
      createdAt: now,
    });
  },
});

/**
 * Internal mutation: update step status, usage, and output.
 * Called by executeAgent/executeSimple actions as each step progresses.
 */
export const updateStepStatus = internalMutation({
  args: {
    stepId: v.id("agentRunSteps"),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("skipped")
    ),
    modelUsed: v.optional(v.string()),
    promptTokens: v.optional(v.number()),
    completionTokens: v.optional(v.number()),
    costUsd: v.optional(v.number()),
    output: v.optional(v.any()),
    rawResponse: v.optional(v.any()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const step = await ctx.db.get(args.stepId);
    if (!step) {
      throw new Error(`AgentRunStep not found: ${args.stepId}`);
    }

    const now = Date.now();
    const patch: Record<string, unknown> = {
      status: args.status,
    };

    if (args.modelUsed !== undefined) patch.modelUsed = args.modelUsed;
    if (args.promptTokens !== undefined) patch.promptTokens = args.promptTokens;
    if (args.completionTokens !== undefined)
      patch.completionTokens = args.completionTokens;
    if (args.costUsd !== undefined) patch.costUsd = args.costUsd;
    if (args.output !== undefined) patch.output = args.output;
    if (args.rawResponse !== undefined) patch.rawResponse = args.rawResponse;
    if (args.errorMessage !== undefined) patch.errorMessage = args.errorMessage;

    if (args.status === "running") {
      patch.startedAt = now;
    }

    const terminalStatuses = ["completed", "failed", "skipped"];
    if (terminalStatuses.includes(args.status)) {
      patch.completedAt = now;
      if (step.startedAt) {
        patch.durationMs = now - step.startedAt;
      }
    }

    await ctx.db.patch(args.stepId, patch);
  },
});
